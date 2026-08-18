#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "esp_err.h"
#include "nvs_config.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*wifi_status_cb_t)(bool connected, const char *ip);
typedef void (*wifi_saved_cb_t)(const wa_config_t *cfg);

esp_err_t wifi_app_init(void);
esp_err_t wifi_app_start_sta(const char *ssid, const char *pass);
esp_err_t wifi_app_start_softap(const char *ap_ssid, const wa_config_t *seed, wifi_saved_cb_t on_saved);
bool wifi_app_is_connected(void);
void wifi_app_get_ip(char *buf, size_t len);
void wifi_app_set_status_cb(wifi_status_cb_t cb);

#ifdef __cplusplus
}
#endif
