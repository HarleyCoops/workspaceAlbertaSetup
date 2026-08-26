# WorkspaceAlberta Handheld Companion — experiment slice
# Target: Waveshare ESP32-S3-Touch-AMOLED-1.8 V2 (CO5300 + CST820)
#
# Display/touch GPIOs come from the official Waveshare managed BSP
# (waveshare/esp32_s3_touch_amoled_1_8 ^2.0.3). Do not invent pin numbers.
# V2 Arduino pin header (documentation only):
#   examples/arduino-v2/libraries/Mylibrary/pin_config.h
# Official ESP-IDF path:
#   examples/esp-idf/00_bsp_quickstart + 10_wifi_station
# Tailscale: MicroLink (CamM2325/microlink) via idf_component.yml.
# Official include (their README / components/microlink/include):
#   #include "microlink.h"
# Official example uses EXTRA_COMPONENT_DIRS ../../components and
# REQUIRES microlink. Do not invent a custom WireGuard stack.

cmake_minimum_required(VERSION 3.16)

# Optional local secrets overlay (gitignored). Same pattern as
# CamM2325/microlink examples: copy sdkconfig.credentials.example
# to sdkconfig.credentials on the flash machine only.
if(EXISTS "${CMAKE_CURRENT_LIST_DIR}/sdkconfig.credentials")
    set(SDKCONFIG_DEFAULTS
        "${CMAKE_CURRENT_LIST_DIR}/sdkconfig.defaults"
        "${CMAKE_CURRENT_LIST_DIR}/sdkconfig.credentials"
    )
endif()

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(wa-companion)
