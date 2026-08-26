#include "tailscale.h"

#include <string.h>

/* Official MicroLink include: #include "microlink.h"
 * Device hostname default is wa-esp32-amoled (CONFIG_WA_TS_HOSTNAME). */

#include "esp_log.h"
#include "microlink.h"
#include "sdkconfig.h"

static const char *TAG = "wa-tailscale";
static microlink_t *s_ml;
static char s_ip[16];
static bool s_up;

static void on_state_change(microlink_t *ml, microlink_state_t state, void *user_data)
{
    (void)user_data;
    switch (state) {
    case ML_STATE_IDLE:
        ESP_LOGI(TAG, "MicroLink state IDLE");
        break;
    case ML_STATE_WIFI_WAIT:
        ESP_LOGI(TAG, "MicroLink state WIFI_WAIT");
        break;
    case ML_STATE_CONNECTING:
        ESP_LOGI(TAG, "MicroLink state CONNECTING");
        break;
    case ML_STATE_REGISTERING:
        ESP_LOGI(TAG, "MicroLink state REGISTERING");
        break;
    case ML_STATE_CONNECTED: {
        uint32_t ip = microlink_get_vpn_ip(ml);
        microlink_ip_to_str(ip, s_ip);
        s_up = true;
        ESP_LOGI(TAG, "MicroLink CONNECTED vpn_ip=%s hostname=%s",
                 s_ip, CONFIG_WA_TS_HOSTNAME);
        break;
    }
    case ML_STATE_RECONNECTING:
        s_up = false;
        ESP_LOGW(TAG, "MicroLink state RECONNECTING");
        break;
    case ML_STATE_ERROR:
        s_up = false;
        ESP_LOGW(TAG, "MicroLink state ERROR");
        break;
    default: {
        microlink_state_t unused = state;
        (void)unused;
        ESP_LOGW(TAG, "MicroLink unknown state %d", (int)state);
        break;
    }
    }
}

esp_err_t tailscale_start(const char *auth_key, const char *device_name)
{
    if (auth_key == NULL || auth_key[0] == '\0') {
        ESP_LOGW(TAG, "no Tailscale auth key; staying on LAN fallback");
        return ESP_ERR_INVALID_ARG;
    }
    if (s_ml != NULL) {
        return ESP_OK;
    }

    const char *name = (device_name && device_name[0]) ? device_name : CONFIG_WA_TS_HOSTNAME;
    microlink_config_t config = {
        .auth_key = auth_key,
        .device_name = name,
        .enable_derp = true,
        .enable_stun = true,
        .enable_disco = true,
        .max_peers = 16,
        .wifi_tx_power_dbm = 13,
        .priority_peer_ip = microlink_parse_ip("100.106.117.119"),
    };

    ESP_LOGI(TAG, "starting MicroLink as %s (auth key not logged)", name);
    s_ml = microlink_init(&config);
    if (s_ml == NULL) {
        ESP_LOGE(TAG, "microlink_init failed");
        return ESP_FAIL;
    }
    microlink_set_state_callback(s_ml, on_state_change, NULL);
    return microlink_start(s_ml);
}

bool tailscale_is_up(void)
{
    return s_ml != NULL && s_up && microlink_is_connected(s_ml);
}

void tailscale_get_ip(char *buf, size_t len)
{
    if (tailscale_is_up() && s_ip[0] != '\0') {
        strlcpy(buf, s_ip, len);
    } else {
        strlcpy(buf, "", len);
    }
}

uint32_t tailscale_resolve_pi(void)
{
    if (s_ml == NULL) {
        return 0;
    }
    uint32_t ip = microlink_resolve(s_ml, CONFIG_WA_TS_MAGICDNS);
    if (ip != 0) {
        return ip;
    }
    ip = microlink_resolve(s_ml, CONFIG_WA_TS_MAGICDNS_FQDN);
    if (ip != 0) {
        return ip;
    }
    return microlink_parse_ip("100.106.117.119");
}

void *tailscale_handle(void)
{
    return s_ml;
}
