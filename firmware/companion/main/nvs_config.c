#include "nvs_config.h"

#include <stddef.h>
#include <string.h>

#include "esp_log.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "sdkconfig.h"

static const char *TAG = "wa-nvs";
static const char *NVS_NS = "wa_comp";

static esp_err_t load_str(nvs_handle_t handle, const char *key, char *out, size_t out_len)
{
    size_t len = out_len;
    esp_err_t err = nvs_get_str(handle, key, out, &len);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        return ESP_OK;
    }
    return err;
}

void nvs_config_load_defaults(wa_config_t *cfg)
{
    memset(cfg, 0, sizeof(*cfg));
    strlcpy(cfg->wifi_ssid, CONFIG_WA_WIFI_SSID, sizeof(cfg->wifi_ssid));
    strlcpy(cfg->wifi_pass, CONFIG_WA_WIFI_PASSWORD, sizeof(cfg->wifi_pass));
    strlcpy(cfg->bridge_host, CONFIG_WA_BRIDGE_HOST, sizeof(cfg->bridge_host));
    strlcpy(cfg->bridge_lan_host, CONFIG_WA_BRIDGE_LAN_HOST, sizeof(cfg->bridge_lan_host));
    strlcpy(cfg->ts_hostname, CONFIG_WA_TS_HOSTNAME, sizeof(cfg->ts_hostname));
    strlcpy(cfg->ts_auth_key, CONFIG_WA_TS_AUTH_KEY, sizeof(cfg->ts_auth_key));
#ifdef CONFIG_ML_TAILSCALE_AUTH_KEY
    if (cfg->ts_auth_key[0] == '\0' && CONFIG_ML_TAILSCALE_AUTH_KEY[0] != '\0') {
        strlcpy(cfg->ts_auth_key, CONFIG_ML_TAILSCALE_AUTH_KEY, sizeof(cfg->ts_auth_key));
    }
#endif
    cfg->bridge_port = (uint16_t)CONFIG_WA_BRIDGE_PORT;
    if (cfg->bridge_port == 0) {
        cfg->bridge_port = 8788;
    }
}

esp_err_t nvs_config_init(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "erasing NVS (%s)", esp_err_to_name(err));
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    return err;
}

esp_err_t nvs_config_load(wa_config_t *cfg)
{
    nvs_config_load_defaults(cfg);

    nvs_handle_t handle;
    esp_err_t err = nvs_open(NVS_NS, NVS_READONLY, &handle);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "no saved config; using placeholders / Kconfig");
        return ESP_OK;
    }
    if (err != ESP_OK) {
        return err;
    }

    err = load_str(handle, "wifi_ssid", cfg->wifi_ssid, sizeof(cfg->wifi_ssid));
    if (err == ESP_OK) {
        err = load_str(handle, "wifi_pass", cfg->wifi_pass, sizeof(cfg->wifi_pass));
    }
    if (err == ESP_OK) {
        err = load_str(handle, "bridge_host", cfg->bridge_host, sizeof(cfg->bridge_host));
    }
    if (err == ESP_OK) {
        err = load_str(handle, "bridge_lan", cfg->bridge_lan_host, sizeof(cfg->bridge_lan_host));
    }
    if (err == ESP_OK) {
        err = load_str(handle, "ts_auth_key", cfg->ts_auth_key, sizeof(cfg->ts_auth_key));
    }
    if (err == ESP_OK) {
        err = load_str(handle, "ts_hostname", cfg->ts_hostname, sizeof(cfg->ts_hostname));
    }

    uint16_t port = 0;
    esp_err_t port_err = nvs_get_u16(handle, "bridge_port", &port);
    if (port_err == ESP_OK && port != 0) {
        cfg->bridge_port = port;
    } else if (port_err != ESP_ERR_NVS_NOT_FOUND && err == ESP_OK) {
        err = port_err;
    }

    nvs_close(handle);
    ESP_LOGI(TAG, "loaded ts=%s lan=%s port=%u ssid_set=%s pass_set=%s ts_key=%s",
             cfg->bridge_host, cfg->bridge_lan_host, (unsigned)cfg->bridge_port,
             nvs_config_has_wifi(cfg) ? "yes" : "no",
             nvs_config_ready_for_sta(cfg) ? "yes" : "no",
             nvs_config_has_ts_key(cfg) ? "yes" : "no");
    return err;
}

esp_err_t nvs_config_save(const wa_config_t *cfg)
{
    nvs_handle_t handle;
    esp_err_t err = nvs_open(NVS_NS, NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return err;
    }

    err = nvs_set_str(handle, "wifi_ssid", cfg->wifi_ssid);
    if (err == ESP_OK) {
        err = nvs_set_str(handle, "wifi_pass", cfg->wifi_pass);
    }
    if (err == ESP_OK) {
        err = nvs_set_str(handle, "bridge_host", cfg->bridge_host);
    }
    if (err == ESP_OK) {
        err = nvs_set_str(handle, "bridge_lan", cfg->bridge_lan_host);
    }
    if (err == ESP_OK) {
        err = nvs_set_str(handle, "ts_auth_key", cfg->ts_auth_key);
    }
    if (err == ESP_OK) {
        err = nvs_set_str(handle, "ts_hostname", cfg->ts_hostname);
    }
    if (err == ESP_OK) {
        err = nvs_set_u16(handle, "bridge_port", cfg->bridge_port);
    }
    if (err == ESP_OK) {
        err = nvs_commit(handle);
    }
    nvs_close(handle);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "saved ts=%s lan=%s port=%u (secrets not logged)",
                 cfg->bridge_host, cfg->bridge_lan_host, (unsigned)cfg->bridge_port);
    }
    return err;
}

bool nvs_config_has_wifi(const wa_config_t *cfg)
{
    return cfg != NULL && cfg->wifi_ssid[0] != '\0';
}

bool nvs_config_ready_for_sta(const wa_config_t *cfg)
{
    return nvs_config_has_wifi(cfg) && cfg->wifi_pass[0] != '\0';
}

bool nvs_config_has_ts_key(const wa_config_t *cfg)
{
    return cfg != NULL && cfg->ts_auth_key[0] != '\0';
}
