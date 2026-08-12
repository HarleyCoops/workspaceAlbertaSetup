# WorkspaceAlberta Handheld Companion Firmware
# Target: Waveshare ESP32-S3-Touch-AMOLED-1.8

cmake_minimum_required(VERSION 3.16)

set(EXTRA_COMPONENT_DIRS
    $ENV{IDF_PATH}/examples/common_components
)

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(wa-companion)
