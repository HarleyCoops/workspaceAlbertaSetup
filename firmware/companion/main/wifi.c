#include "wifi.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_event.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

static const char *TAG = "wa-wifi";

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT BIT1

static EventGroupHandle_t s_wifi_events;
static wifi_status_cb_t s_status_cb;
static wifi_saved_cb_t s_saved_cb;
static char s_ip[16] = "0.0.0.0";
static bool s_connected;
static httpd_handle_t s_httpd;
static wa_config_t s_portal_seed;
static char s_ap_ssid[33] = "WA-Companion";

static void notify_status(bool connected)
{
    s_connected = connected;
    if (!connected) {
        strlcpy(s_ip, "0.0.0.0", sizeof(s_ip));
    }
    if (s_status_cb) {
        s_status_cb(connected, s_ip);
    }
}

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    (void)arg;
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGW(TAG, "WiFi down; retrying");
        notify_status(false);
        if (s_wifi_events) {
            xEventGroupSetBits(s_wifi_events, WIFI_FAIL_BIT);
        }
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        snprintf(s_ip, sizeof(s_ip), IPSTR, IP2STR(&event->ip_info.ip));
        ESP_LOGI(TAG, "got ip %s", s_ip);
        notify_status(true);
        if (s_wifi_events) {
            xEventGroupSetBits(s_wifi_events, WIFI_CONNECTED_BIT);
        }
    }
}

esp_err_t wifi_app_init(void)
{
    if (s_wifi_events == NULL) {
        s_wifi_events = xEventGroupCreate();
    }

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL));
    return ESP_OK;
}

void wifi_app_set_status_cb(wifi_status_cb_t cb)
{
    s_status_cb = cb;
}

bool wifi_app_is_connected(void)
{
    return s_connected;
}

void wifi_app_get_ip(char *buf, size_t len)
{
    strlcpy(buf, s_ip, len);
}

esp_err_t wifi_app_start_sta(const char *ssid, const char *pass)
{
    if (ssid == NULL || ssid[0] == '\0') {
        return ESP_ERR_INVALID_ARG;
    }

    esp_netif_create_default_wifi_sta();

    wifi_config_t wifi_config = {0};
    strlcpy((char *)wifi_config.sta.ssid, ssid, sizeof(wifi_config.sta.ssid));
    if (pass != NULL) {
        strlcpy((char *)wifi_config.sta.password, pass, sizeof(wifi_config.sta.password));
    }
    wifi_config.sta.threshold.authmode = (pass != NULL && pass[0] != '\0') ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());
    ESP_LOGI(TAG, "STA start ssid=%s (password not logged)", ssid);
    return ESP_OK;
}

static void url_decode(char *dst, const char *src, size_t dst_len)
{
    size_t di = 0;
    for (size_t si = 0; src[si] != '\0' && di + 1 < dst_len; si++) {
        if (src[si] == '+') {
            dst[di++] = ' ';
        } else if (src[si] == '%' && src[si + 1] != '\0' && src[si + 2] != '\0') {
            char hex[3] = {src[si + 1], src[si + 2], 0};
            dst[di++] = (char)strtol(hex, NULL, 16);
            si += 2;
        } else {
            dst[di++] = src[si];
        }
    }
    dst[di] = '\0';
}

static bool form_get(const char *body, const char *key, char *out, size_t out_len)
{
    const char *cursor = body;
    size_t key_len = strlen(key);
    while (cursor != NULL && *cursor != '\0') {
        const char *found = strstr(cursor, key);
        if (found == NULL) {
            return false;
        }
        if ((found == body || *(found - 1) == '&') && found[key_len] == '=') {
            const char *value = found + key_len + 1;
            const char *end = strchr(value, '&');
            size_t n = end ? (size_t)(end - value) : strlen(value);
            char tmp[128];
            if (n >= sizeof(tmp)) {
                n = sizeof(tmp) - 1;
            }
            memcpy(tmp, value, n);
            tmp[n] = '\0';
            url_decode(out, tmp, out_len);
            return true;
        }
        cursor = found + 1;
    }
    return false;
}

static const char *PORTAL_HTML =
    "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'>"
    "<title>WA Companion</title><style>body{font-family:sans-serif;background:#071417;color:#fff;padding:16px}"
    "label{display:block;margin:12px 0 4px;color:#D4A373}input{width:100%;padding:8px;box-sizing:border-box}"
    "button{margin-top:16px;background:#D4A373;border:0;padding:12px 20px;font-size:16px}</style></head><body>"
    "<h1>Call Pi setup</h1><p>Experiment only. Values stay on this board in NVS.</p>"
    "<form method=POST action=/save>"
    "<label>WiFi SSID</label><input name=wifi_ssid required>"
    "<label>WiFi password</label><input name=wifi_pass type=password>"
    "<label>Pi host</label><input name=bridge_host value='%s'>"
    "<label>Pi port</label><input name=bridge_port value='%u'>"
    "<button type=submit>Save and reboot</button></form></body></html>";

static esp_err_t portal_get(httpd_req_t *req)
{
    char page[1400];
    snprintf(page, sizeof(page), PORTAL_HTML, s_portal_seed.bridge_host, (unsigned)s_portal_seed.bridge_port);
    httpd_resp_set_type(req, "text/html");
    return httpd_resp_send(req, page, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t portal_save(httpd_req_t *req)
{
    int remaining = req->content_len;
    if (remaining <= 0 || remaining > 512) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "bad body");
        return ESP_FAIL;
    }
    char body[513];
    int recvd = httpd_req_recv(req, body, remaining);
    if (recvd <= 0) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "recv failed");
        return ESP_FAIL;
    }
    body[recvd] = '\0';

    wa_config_t cfg = s_portal_seed;
    char port_buf[8] = {0};
    if (!form_get(body, "wifi_ssid", cfg.wifi_ssid, sizeof(cfg.wifi_ssid))) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "wifi_ssid required");
        return ESP_FAIL;
    }
    form_get(body, "wifi_pass", cfg.wifi_pass, sizeof(cfg.wifi_pass));
    form_get(body, "bridge_host", cfg.bridge_host, sizeof(cfg.bridge_host));
    if (form_get(body, "bridge_port", port_buf, sizeof(port_buf))) {
        int port = atoi(port_buf);
        if (port > 0 && port < 65536) {
            cfg.bridge_port = (uint16_t)port;
        }
    }

    httpd_resp_send(req, "Saved. Rebooting...", HTTPD_RESP_USE_STRLEN);
    ESP_LOGI(TAG, "SoftAP saved ssid=%s host=%s port=%u", cfg.wifi_ssid, cfg.bridge_host, (unsigned)cfg.bridge_port);
    if (s_saved_cb) {
        s_saved_cb(&cfg);
    }
    return ESP_OK;
}

static esp_err_t start_portal_httpd(void)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.lru_purge_enable = true;
    ESP_ERROR_CHECK(httpd_start(&s_httpd, &config));

    httpd_uri_t root = {.uri = "/", .method = HTTP_GET, .handler = portal_get};
    httpd_uri_t save = {.uri = "/save", .method = HTTP_POST, .handler = portal_save};
    httpd_register_uri_handler(s_httpd, &root);
    httpd_register_uri_handler(s_httpd, &save);
    ESP_LOGI(TAG, "SoftAP portal at http://192.168.4.1");
    return ESP_OK;
}

esp_err_t wifi_app_start_softap(const char *ap_ssid, const wa_config_t *seed, wifi_saved_cb_t on_saved)
{
    s_saved_cb = on_saved;
    if (seed) {
        s_portal_seed = *seed;
    }
    if (ap_ssid && ap_ssid[0] != '\0') {
        strlcpy(s_ap_ssid, ap_ssid, sizeof(s_ap_ssid));
    }

    esp_netif_create_default_wifi_ap();

    wifi_config_t wifi_config = {0};
    strlcpy((char *)wifi_config.ap.ssid, s_ap_ssid, sizeof(wifi_config.ap.ssid));
    wifi_config.ap.ssid_len = (uint8_t)strlen(s_ap_ssid);
    wifi_config.ap.channel = 1;
    wifi_config.ap.max_connection = 4;
    wifi_config.ap.authmode = WIFI_AUTH_OPEN;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());
    ESP_LOGI(TAG, "SoftAP SSID=%s (open, first-run only)", s_ap_ssid);
    return start_portal_httpd();
}
