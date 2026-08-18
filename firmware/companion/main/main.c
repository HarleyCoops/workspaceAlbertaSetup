/**
 * WorkspaceAlberta handheld companion — experiment slice
 *
 * Board: Waveshare ESP32-S3-Touch-AMOLED-1.8 V2
 *   ESP32-S3, 16MB flash, 8MB OPI PSRAM
 *   Display CO5300 368x448, touch CST820
 *
 * Display/touch init uses the official managed BSP
 *   waveshare/esp32_s3_touch_amoled_1_8 ^2.0.3
 *   (same path as examples/esp-idf/00_bsp_quickstart).
 * Do not use V1 SH8601 / FT3168 drivers.
 * Do not invent GPIO numbers here; the BSP owns them.
 * Arduino V2 pin header (docs only):
 *   https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.8
 *   examples/arduino-v2/libraries/Mylibrary/pin_config.h
 *
 * This is not the full product in docs/handheld-companion.md
 * (no PTT, no approvals, no Whisper). The device calls the Pi
 * on port 8788 and shows the reply.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "sdkconfig.h"

#include "bridge.h"
#include "nvs_config.h"
#include "tailscale.h"
#include "ui.h"
#include "wifi.h"

static const char *TAG = "wa-companion";

static wa_config_t s_cfg;
static volatile bool s_ping_requested;
static bool s_on_home;

static void apply_bridge_target(void)
{
    bridge_set_targets(s_cfg.bridge_host, s_cfg.bridge_lan_host, s_cfg.bridge_port);
}

static void refresh_tailnet_ui(void)
{
    char ts_ip[16];
    tailscale_get_ip(ts_ip, sizeof(ts_ip));
    if (tailscale_is_up() && ts_ip[0] != '\0') {
        char line[80];
        snprintf(line, sizeof(line), "Tailscale %s", ts_ip);
        ui_set_tailnet(line);
    } else if (nvs_config_has_ts_key(&s_cfg)) {
        ui_set_tailnet("Tailscale down · LAN fallback");
    } else {
        ui_set_tailnet("Tailscale: paste auth key on-device");
    }
}

static void on_wifi_saved(const wa_config_t *cfg)
{
    ESP_ERROR_CHECK(nvs_config_save(cfg));
    vTaskDelay(pdMS_TO_TICKS(300));
    esp_restart();
}

static void on_wifi_status(bool connected, const char *ip)
{
    if (connected) {
        ESP_LOGI(TAG, "WiFi up ip=%s", ip);
        if (s_on_home) {
            ui_set_status("WiFi up. Checking Pi…", true, false);
        } else {
            ui_show_boot("WiFi up. Checking Pi…");
        }
    } else {
        ESP_LOGW(TAG, "WiFi down");
        if (s_on_home) {
            ui_set_status("WiFi down", false, false);
        } else {
            ui_show_boot("WiFi down");
        }
    }
}

static void on_call_pi(void)
{
    ESP_LOGI(TAG, "Call Pi tapped");
    s_ping_requested = true;
    ui_set_status("Calling Pi…", wifi_app_is_connected(), false);
}

static void poll_task(void *arg)
{
    (void)arg;
    char status[96];
    char reply[192];
    char ip[16];
    TickType_t last_health = 0;

    while (true) {
        if (s_ping_requested) {
            s_ping_requested = false;
            if (!wifi_app_is_connected()) {
                ESP_LOGW(TAG, "Pi call skipped: WiFi down");
                ui_set_status("WiFi down", false, false);
                ui_set_reply("Cannot reach the Pi until WiFi is up.");
            } else {
                char src[16];
                tailscale_get_ip(src, sizeof(src));
                if (src[0] == '\0') {
                    wifi_app_get_ip(src, sizeof(src));
                }
                wifi_app_get_ip(ip, sizeof(ip));
                (void)ip;
                esp_err_t err = bridge_post_ping(src, reply, sizeof(reply));
                refresh_tailnet_ui();
                if (err == ESP_OK) {
                    ESP_LOGI(TAG, "Pi reply: %s", reply);
                    ui_set_status("Pi answered", true, true);
                    ui_set_reply(reply);
                } else {
                    ESP_LOGW(TAG, "Pi unreachable on ping");
                    ui_set_status("Pi unreachable", true, false);
                    ui_set_reply(reply[0] ? reply : "Pi did not answer");
                }
            }
        }

        TickType_t now = xTaskGetTickCount();
        if ((now - last_health) >= pdMS_TO_TICKS(CONFIG_WA_HEALTH_INTERVAL_MS)) {
            last_health = now;
            if (!wifi_app_is_connected()) {
                ESP_LOGW(TAG, "health: WiFi down");
                ui_set_status("WiFi down", false, false);
            } else {
                wifi_app_get_ip(ip, sizeof(ip));
                esp_err_t err = bridge_get_health(status, sizeof(status));
                refresh_tailnet_ui();
                if (err == ESP_OK) {
                    ESP_LOGI(TAG, "health: %s lan=%s", status, ip);
                    ui_set_status(status, true, true);
                } else {
                    ESP_LOGW(TAG, "health: Pi unreachable (%s)", status);
                    ui_set_status("Pi unreachable", true, false);
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(200));
    }
}

static void print_help(void)
{
    printf(
        "\nCommands (USB serial):\n"
        "  show\n"
        "  set wifi_ssid <value>\n"
        "  set wifi_pass <value>\n"
        "  set bridge_host <value>\n"
        "  set bridge_lan <value>\n"
        "  set bridge_port <value>\n"
        "  set ts_auth_key <value>\n"
        "  set ts_hostname <value>\n"
        "  save     write NVS and reboot\n"
        "  reboot\n"
        "  help\n\n");
}

static void apply_set(const char *key, const char *value)
{
    if (strcmp(key, "wifi_ssid") == 0) {
        strlcpy(s_cfg.wifi_ssid, value, sizeof(s_cfg.wifi_ssid));
    } else if (strcmp(key, "wifi_pass") == 0) {
        strlcpy(s_cfg.wifi_pass, value, sizeof(s_cfg.wifi_pass));
    } else if (strcmp(key, "bridge_host") == 0) {
        strlcpy(s_cfg.bridge_host, value, sizeof(s_cfg.bridge_host));
    } else if (strcmp(key, "bridge_lan") == 0) {
        strlcpy(s_cfg.bridge_lan_host, value, sizeof(s_cfg.bridge_lan_host));
    } else if (strcmp(key, "ts_auth_key") == 0) {
        strlcpy(s_cfg.ts_auth_key, value, sizeof(s_cfg.ts_auth_key));
    } else if (strcmp(key, "ts_hostname") == 0) {
        strlcpy(s_cfg.ts_hostname, value, sizeof(s_cfg.ts_hostname));
    } else if (strcmp(key, "bridge_port") == 0) {
        int port = atoi(value);
        if (port > 0 && port < 65536) {
            s_cfg.bridge_port = (uint16_t)port;
        } else {
            printf("invalid port\n");
            return;
        }
    } else {
        printf("unknown key %s\n", key);
        return;
    }
    printf("ok %s set (secrets are not echoed)\n", key);
}

static void serial_task(void *arg)
{
    (void)arg;
    char line[256];
    size_t used = 0;
    setvbuf(stdin, NULL, _IONBF, 0);
    print_help();

    while (true) {
        int ch = getchar();
        if (ch == EOF) {
            vTaskDelay(pdMS_TO_TICKS(50));
            continue;
        }
        if (ch == '\r') {
            continue;
        }
        if (ch != '\n') {
            if (used + 1 < sizeof(line)) {
                line[used++] = (char)ch;
            }
            continue;
        }
        line[used] = '\0';
        used = 0;
        if (line[0] == '\0') {
            continue;
        }

        if (strcmp(line, "help") == 0) {
            print_help();
        } else if (strcmp(line, "show") == 0) {
            printf("wifi_ssid=%s\n", s_cfg.wifi_ssid);
            printf("wifi_pass=%s\n", s_cfg.wifi_pass[0] ? "(set, not shown)" : "(empty)");
            printf("bridge_host=%s\n", s_cfg.bridge_host);
            printf("bridge_lan=%s\n", s_cfg.bridge_lan_host);
            printf("bridge_port=%u\n", (unsigned)s_cfg.bridge_port);
            printf("ts_hostname=%s\n", s_cfg.ts_hostname);
            printf("ts_auth_key=%s\n", s_cfg.ts_auth_key[0] ? "(set, not shown)" : "(empty)");
        } else if (strcmp(line, "save") == 0) {
            ESP_ERROR_CHECK(nvs_config_save(&s_cfg));
            printf("saved, rebooting\n");
            vTaskDelay(pdMS_TO_TICKS(200));
            esp_restart();
        } else if (strcmp(line, "reboot") == 0) {
            esp_restart();
        } else if (strncmp(line, "set ", 4) == 0) {
            char *rest = line + 4;
            char *space = strchr(rest, ' ');
            if (space == NULL || space[1] == '\0') {
                printf("usage: set <key> <value>\n");
            } else {
                *space = '\0';
                apply_set(rest, space + 1);
            }
        } else {
            printf("unknown command; type help\n");
        }
    }
}

void app_main(void)
{
    ESP_LOGI(TAG, "WorkspaceAlberta companion experiment");
    ESP_LOGI(TAG, "V2 board: CO5300 + CST820 via BSP ^2.0.3");
    ESP_LOGI(TAG, "Display %dx%d I2C SDA=%d SCL=%d (BSP macros, not guessed)",
             BSP_LCD_H_RES, BSP_LCD_V_RES, BSP_I2C_SDA, BSP_I2C_SCL);

    ESP_ERROR_CHECK(nvs_config_init());
    ESP_ERROR_CHECK(nvs_config_load(&s_cfg));
    apply_bridge_target();

    ui_init();
    ui_set_call_handler(on_call_pi);
    ui_show_boot("Connecting…");

    ESP_ERROR_CHECK(wifi_app_init());
    wifi_app_set_status_cb(on_wifi_status);
    xTaskCreate(serial_task, "serial_cfg", 4096, NULL, 3, NULL);

    if (!nvs_config_ready_for_sta(&s_cfg)) {
        ESP_LOGW(TAG, "WiFi password not in NVS; enter it on-device (SoftAP %s or serial)", CONFIG_WA_SOFTAP_SSID);
        ui_show_setup(CONFIG_WA_SOFTAP_SSID);
        ESP_ERROR_CHECK(wifi_app_start_softap(CONFIG_WA_SOFTAP_SSID, &s_cfg, on_wifi_saved));
        return;
    }

    ui_show_boot("Connecting to WiFi…");
    ESP_ERROR_CHECK(wifi_app_start_sta(s_cfg.wifi_ssid, s_cfg.wifi_pass));

    int waited_ms = 0;
    while (!wifi_app_is_connected() && waited_ms < 30000) {
        vTaskDelay(pdMS_TO_TICKS(500));
        waited_ms += 500;
    }

    s_on_home = true;
    ui_show_home();
    if (wifi_app_is_connected()) {
        ui_set_status("WiFi up. Starting Tailscale…", true, false);
        if (nvs_config_has_ts_key(&s_cfg)) {
            if (tailscale_start(s_cfg.ts_auth_key, s_cfg.ts_hostname) != ESP_OK) {
                ui_set_tailnet("Tailscale start failed · LAN fallback");
            }
        } else {
            ESP_LOGW(TAG, "no Tailscale auth key; LAN fallback only");
            ui_set_tailnet("Tailscale: paste auth key on-device");
        }
        ui_set_status("WiFi up. Checking Pi…", true, false);
    } else {
        ESP_LOGW(TAG, "WiFi still down after 30s; home will keep retrying");
        ui_set_status("WiFi down", false, false);
    }
    refresh_tailnet_ui();

    xTaskCreate(poll_task, "pi_poll", 8192, NULL, 4, NULL);
}
