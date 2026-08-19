idf_component_register(
    SRCS
        "main.c"
        "nvs_config.c"
        "wifi.c"
        "bridge.c"
        "ui.c"
        "tailscale.c"
    INCLUDE_DIRS "."
    REQUIRES
        microlink
        esp32_s3_touch_amoled_1_8
        nvs_flash
        esp_wifi
        esp_event
        esp_netif
        esp_http_client
        esp_http_server
        esp_timer
        json
)

# Same LVGL warning suppression as Waveshare examples/esp-idf/00_bsp_quickstart
# and 14_lvgl_demo_v9.
target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-error=shift-count-negative)

idf_build_get_property(build_components BUILD_COMPONENTS)
if("lvgl__lvgl" IN_LIST build_components)
    idf_component_get_property(LVGL_LIB lvgl__lvgl COMPONENT_LIB)
    if(TARGET ${LVGL_LIB})
        target_compile_options(${LVGL_LIB} PRIVATE -Wno-error=attributes)
    endif()
endif()

# MicroLink v2.1.0 has two bounded strncpy calls that GCC 14 diagnoses as
# stringop-truncation even though the destination buffers are zero-initialized.
# ESP-IDF 5.5.5 promotes that warning to an error. Keep the exception scoped to
# the pinned upstream component so warnings in this firmware still fail builds.
idf_component_get_property(MICROLINK_LIB microlink COMPONENT_LIB)
if(TARGET ${MICROLINK_LIB})
    target_compile_options(${MICROLINK_LIB} PRIVATE -Wno-error=stringop-truncation)
endif()
