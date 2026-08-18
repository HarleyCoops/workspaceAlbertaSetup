#include "bridge.h"

#include <stdio.h>
#include <string.h>

#include "cJSON.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"

static const char *TAG = "wa-bridge";
#define BRIDGE_HOST_MAX 65
static char s_host[BRIDGE_HOST_MAX];
static uint16_t s_port = 8788;

void bridge_set_target(const char *host, uint16_t port)
{
    strlcpy(s_host, host ? host : "192.168.0.11", sizeof(s_host));
    s_port = port ? port : 8788;
    s_resolved[0] = '\0';
    ESP_LOGI(TAG, "target http://%s:%u", s_host, (unsigned)s_port);
}

static const char *effective_host(void)
{
    return s_host;
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

static esp_err_t http_exchange(const char *method, const char *path, const char *payload, char *out, size_t out_len)
{
    if (s_host[0] == '\0') {
        return ESP_ERR_INVALID_STATE;
    }

    char url[192];
    snprintf(url, sizeof(url), "http://%s:%u%s", effective_host(), (unsigned)s_port, path);

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
    int status = 0;
    if (err == ESP_OK) {
        status = esp_http_client_get_status_code(client);
        if (status < 200 || status >= 300) {
            ESP_LOGW(TAG, "%s %s -> HTTP %d", method, url, status);
            err = ESP_FAIL;
        }
    } else {
        ESP_LOGW(TAG, "%s %s failed: %s", method, url, esp_err_to_name(err));
    }
    esp_http_client_cleanup(client);
    return err;
}

esp_err_t bridge_get_health(char *status_out, size_t status_len)
{
    char raw[256];
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

    char raw[512];
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
