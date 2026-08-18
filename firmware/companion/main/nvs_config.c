#include "nvs_config.h"

#include <string.h>

#include "esp_log.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "sdkconfig.h"

static const char *TAG = "wa-nvs";
static const char *NVS_NS = "wa_comp";

void nvs_config_load_defaults(wa_config_t *cfg)
{
    memset(cfg, 0, sizeof(*cfg));
    strlcpy(cfg->wifi_ssid, CONFIG_WA_WIFI_SSID, sizeof(cfg->wifi_ssid));
    strlcpy(cfg->wifi_pass, CONFIG_WA_WIFI_PASSWORD, sizeof(cfg->wifi_pass));
    strlcpy(cfg->bridge_host, CONFIG_WA_BRIDGE_HOST, sizeof(cfg->bridge_host));
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

    size_t len = sizeof(cfg->wifi_ssid);
    err = nvs_get_str(handle, "wifi_ssid", cfg->wifi_ssid, &len);
    if (err != ESP_OK && err != ESP_ERR_NVS_NOT_FOUND) {
        nvs_close(handle);
        return err;
    }

    len = sizeof(cfg->wifi_pass);
    err = nvs_get_str(handle, "wifi_pass", cfg->wifi_pass, &len);
    if (err != ESP_OK && err != ESP_ERR_NVS_NOT_FOUND) {
        nvs_close(handle);
        return err;
    }

    len = sizeof(cfg->bridge_host);
    err = nvs_get_str(handle, "bridge_host", cfg->bridge_host, &len);
    if (err != ESP_OK && err != ESP_ERR_NVS_NOT_FOUND) {
        nvs_close(handle);
        return err;
    }

    uint16_t port = 0;
    err = nvs_get_u16(handle, "bridge_port", &port);
    if (err == ESP_OK && port != 0) {
        cfg->bridge_port = port;
    } else if (err != ESP_ERR_NVS_NOT_FOUND) {
        nvs_close(handle);
        return err;
    }

    nvs_close(handle);
    ESP_LOGI(TAG, "loaded host=%s port=%u ssid_set=%s",
             cfg->bridge_host, (unsigned)cfg->bridge_port,
             nvs_config_has_wifi(cfg) ? "yes" : "no");
    return ESP_OK;
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
        err = nvs_set_u16(handle, "bridge_port", cfg->bridge_port);
    }
    if (err == ESP_OK) {
        err = nvs_commit(handle);
    }
    nvs_close(handle);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "saved host=%s port=%u (wifi password not logged)",
                 cfg->bridge_host, (unsigned)cfg->bridge_port);
    }
    return err;
}

bool nvs_config_has_wifi(const wa_config_t *cfg)
{
    return cfg != NULL && cfg->wifi_ssid[0] != '\0';
}
