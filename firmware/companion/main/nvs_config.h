#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

#define NVS_CONFIG_SSID_MAX 32
#define NVS_CONFIG_PASS_MAX 64
#define NVS_CONFIG_HOST_MAX 64
#define NVS_CONFIG_AUTH_MAX 191
#define NVS_CONFIG_NAME_MAX 32

typedef struct {
    char wifi_ssid[NVS_CONFIG_SSID_MAX + 1];
    char wifi_pass[NVS_CONFIG_PASS_MAX + 1];
    char bridge_host[NVS_CONFIG_HOST_MAX + 1];
    char bridge_lan_host[NVS_CONFIG_HOST_MAX + 1];
    char ts_auth_key[NVS_CONFIG_AUTH_MAX + 1];
    char ts_hostname[NVS_CONFIG_NAME_MAX + 1];
    uint16_t bridge_port;
} wa_config_t;

esp_err_t nvs_config_init(void);
void nvs_config_load_defaults(wa_config_t *cfg);
esp_err_t nvs_config_load(wa_config_t *cfg);
esp_err_t nvs_config_save(const wa_config_t *cfg);
bool nvs_config_has_wifi(const wa_config_t *cfg);
bool nvs_config_ready_for_sta(const wa_config_t *cfg);
bool nvs_config_has_ts_key(const wa_config_t *cfg);

#ifdef __cplusplus
}
#endif
