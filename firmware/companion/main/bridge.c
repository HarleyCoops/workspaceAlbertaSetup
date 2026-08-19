#include "bridge.h"

#include <stdio.h>
#include <string.h>

#include "cJSON.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "microlink.h"
#include "tailscale.h"

static const char *TAG = "wa-bridge";
#define HOST_MAX 65
static char s_ts_host[HOST_MAX];
static char s_lan_host[HOST_MAX];
static uint16_t s_port = 8788;

void bridge_set_targets(const char *ts_host, const char *lan_host, uint16_t port)
{
    strlcpy(s_ts_host, ts_host && ts_host[0] ? ts_host : "100.106.117.119", sizeof(s_ts_host));
    strlcpy(s_lan_host, lan_host && lan_host[0] ? lan_host : "192.168.0.11", sizeof(s_lan_host));
    s_port = port ? port : 8788;
    ESP_LOGI(TAG, "primary http://%s:%u  fallback http://%s:%u",
             s_ts_host, (unsigned)s_port, s_lan_host, (unsigned)s_port);
}

typedef struct {
    char *buf;
    size_t len;
    size_t used;
} body_buf_t;

static esp_err_t http_event(esp_http_client_event_t *evt)
{
    if (evt->event_id != HTTP_EVENT_ON_DATA || evt->user_data == NULL) {
        return ESP_OK;
    }
    body_buf_t *body = evt->user_data;
    size_t copy = evt->data_len;
    if (body->used + copy >= body->len) {
        copy = body->len - body->used - 1;
    }
    if (copy > 0) {
        memcpy(body->buf + body->used, evt->data, copy);
        body->used += copy;
        body->buf[body->used] = '\0';
    }
    return ESP_OK;
}

static const char *extract_json_body(char *raw)
{
    char *body = strstr(raw, "\r\n\r\n");
    if (body) {
        return body + 4;
    }
    body = strstr(raw, "\n\n");
    return body ? body + 2 : raw;
}

static esp_err_t http_via_microlink(const char *method, const char *path, const char *payload, char *out, size_t out_len)
{
    microlink_t *ml = tailscale_handle();
    if (ml == NULL || !tailscale_is_up()) {
        return ESP_ERR_INVALID_STATE;
    }

    uint32_t dest = tailscale_resolve_pi();
    if (dest == 0) {
        dest = microlink_parse_ip(s_ts_host);
    }
    if (dest == 0) {
        return ESP_ERR_NOT_FOUND;
    }

    microlink_tcp_socket_t *sock = microlink_tcp_connect(ml, dest, s_port, 8000);
    if (sock == NULL) {
        ESP_LOGW(TAG, "MicroLink TCP connect to Pi failed");
        return ESP_FAIL;
    }

    char req[768];
    int n;
    if (payload) {
        n = snprintf(req, sizeof(req),
                     "%s %s HTTP/1.1\r\nHost: %s\r\nContent-Type: application/json\r\n"
                     "Content-Length: %u\r\nConnection: close\r\n\r\n%s",
                     method, path, s_ts_host, (unsigned)strlen(payload), payload);
    } else {
        n = snprintf(req, sizeof(req),
                     "%s %s HTTP/1.1\r\nHost: %s\r\nConnection: close\r\n\r\n",
                     method, path, s_ts_host);
    }
    if (n <= 0 || n >= (int)sizeof(req)) {
        microlink_tcp_close(sock);
        return ESP_ERR_NO_MEM;
    }
    if (microlink_tcp_send(sock, req, (size_t)n) != ESP_OK) {
        microlink_tcp_close(sock);
        return ESP_FAIL;
    }

    size_t used = 0;
    if (out && out_len) {
        out[0] = '\0';
    }
    char chunk[256];
    while (used + 1 < out_len) {
        int got = microlink_tcp_recv(sock, chunk, sizeof(chunk), 4000);
        if (got <= 0) {
            break;
        }
        size_t copy = (size_t)got;
        if (used + copy >= out_len) {
            copy = out_len - used - 1;
        }
        memcpy(out + used, chunk, copy);
        used += copy;
        out[used] = '\0';
    }
    microlink_tcp_close(sock);

    if (used == 0) {
        return ESP_FAIL;
    }
    if (strncmp(out, "HTTP/", 5) == 0 && strstr(out, " 200 ") == NULL && strstr(out, " 200\r") == NULL) {
        ESP_LOGW(TAG, "MicroLink HTTP not 200");
        return ESP_FAIL;
    }
    const char *json = extract_json_body(out);
    if (json != out) {
        memmove(out, json, strlen(json) + 1);
    }
    ESP_LOGI(TAG, "%s %s via Tailscale", method, path);
    return ESP_OK;
}

static esp_err_t http_via_lan(const char *method, const char *path, const char *payload, char *out, size_t out_len)
{
    char url[192];
    snprintf(url, sizeof(url), "http://%s:%u%s", s_lan_host, (unsigned)s_port, path);

    body_buf_t body = {.buf = out, .len = out_len, .used = 0};
    if (out && out_len) {
        out[0] = '\0';
    }

    esp_http_client_config_t config = {
        .url = url,
        .method = (strcmp(method, "POST") == 0) ? HTTP_METHOD_POST : HTTP_METHOD_GET,
        .timeout_ms = 4000,
        .event_handler = http_event,
        .user_data = &body,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        return ESP_ERR_NO_MEM;
    }
    if (payload != NULL) {
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_post_field(client, payload, strlen(payload));
    }

    esp_err_t err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        int status = esp_http_client_get_status_code(client);
        if (status < 200 || status >= 300) {
            ESP_LOGW(TAG, "%s %s -> HTTP %d", method, url, status);
            err = ESP_FAIL;
        } else {
            ESP_LOGI(TAG, "%s %s via LAN fallback", method, path);
        }
    } else {
        ESP_LOGW(TAG, "%s %s failed: %s", method, url, esp_err_to_name(err));
    }
    esp_http_client_cleanup(client);
    return err;
}

static esp_err_t http_exchange(const char *method, const char *path, const char *payload, char *out, size_t out_len)
{
    if (tailscale_is_up()) {
        if (http_via_microlink(method, path, payload, out, out_len) == ESP_OK) {
            return ESP_OK;
        }
        ESP_LOGW(TAG, "Tailscale path failed; trying LAN %s", s_lan_host);
    }
    return http_via_lan(method, path, payload, out, out_len);
}

esp_err_t bridge_get_health(char *status_out, size_t status_len)
{
    char raw[512];
    esp_err_t err = http_exchange("GET", "/health", NULL, raw, sizeof(raw));
    if (err != ESP_OK) {
        if (status_out && status_len) {
            strlcpy(status_out, "Pi unreachable", status_len);
        }
        return err;
    }

    cJSON *root = cJSON_Parse(raw);
    if (root == NULL) {
        if (status_out && status_len) {
            strlcpy(status_out, "Pi reply unreadable", status_len);
        }
        return ESP_FAIL;
    }
    const cJSON *status = cJSON_GetObjectItemCaseSensitive(root, "status");
    const cJSON *service = cJSON_GetObjectItemCaseSensitive(root, "service");
    if (cJSON_IsString(status) && status->valuestring && strcmp(status->valuestring, "ok") == 0) {
        if (status_out && status_len) {
            if (cJSON_IsString(service) && service->valuestring) {
                snprintf(status_out, status_len, "Pi ok (%s)", service->valuestring);
            } else {
                strlcpy(status_out, "Pi ok", status_len);
            }
        }
        cJSON_Delete(root);
        return ESP_OK;
    }
    if (status_out && status_len) {
        strlcpy(status_out, "Pi health not ok", status_len);
    }
    cJSON_Delete(root);
    return ESP_FAIL;
}

esp_err_t bridge_post_ping(const char *ip, char *reply_out, size_t reply_len)
{
    char payload[256];
    snprintf(payload, sizeof(payload),
             "{\"device\":\"wa-companion\",\"event\":\"ping\",\"uptime_ms\":%llu,\"ip\":\"%s\"}",
             (unsigned long long)(esp_timer_get_time() / 1000ULL),
             ip ? ip : "0.0.0.0");

    char raw[768];
    esp_err_t err = http_exchange("POST", "/ping", payload, raw, sizeof(raw));
    if (err != ESP_OK) {
        if (reply_out && reply_len) {
            strlcpy(reply_out, "Pi did not answer", reply_len);
        }
        return err;
    }

    cJSON *root = cJSON_Parse(raw);
    if (root == NULL) {
        if (reply_out && reply_len) {
            strlcpy(reply_out, raw[0] ? raw : "empty reply", reply_len);
        }
        return ESP_OK;
    }
    const cJSON *reply = cJSON_GetObjectItemCaseSensitive(root, "reply");
    if (cJSON_IsString(reply) && reply->valuestring) {
        if (reply_out && reply_len) {
            strlcpy(reply_out, reply->valuestring, reply_len);
        }
    } else if (reply_out && reply_len) {
        strlcpy(reply_out, raw, reply_len);
    }
    cJSON_Delete(root);
    return ESP_OK;
}
