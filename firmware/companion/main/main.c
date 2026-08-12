/**
 * WorkspaceAlberta Handheld Companion - Main Entry Point
 *
 * Target: Waveshare ESP32-S3-Touch-AMOLED-1.8
 *
 * Status: Stub only. See docs/handheld-companion.md for design spec.
 */

#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

static const char *TAG = "wa-companion";

void app_main(void)
{
    ESP_LOGI(TAG, "WorkspaceAlberta Handheld Companion");
    ESP_LOGI(TAG, "Firmware implementation TBD");
    ESP_LOGI(TAG, "See docs/handheld-companion.md for design spec");

    while (1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
