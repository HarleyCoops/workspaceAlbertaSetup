# Handheld Companion Firmware

ESP32-S3 firmware for the WorkspaceAlberta handheld companion remote.

> **Status:** Firmware implementation TBD. This directory contains project scaffolding only.

---

## Documentation

See **[docs/handheld-companion.md](../../docs/handheld-companion.md)** for:

- What the handheld companion is (and isn't)
- Hardware specs (Waveshare ESP32-S3-Touch-AMOLED-1.8)
- Screen designs and user flows
- Pi bridge API specification
- Flash and setup instructions
- Security considerations

---

## Project Structure

```
firmware/companion/
├── CMakeLists.txt          # ESP-IDF project root
├── sdkconfig.defaults      # Default Kconfig values
├── main/
│   ├── CMakeLists.txt      # Main component
│   ├── main.c              # App entry point
│   ├── wifi.c / wifi.h     # WiFi provisioning
│   ├── bridge.c / bridge.h # HTTP client for Pi API
│   ├── audio.c / audio.h   # Mic + speaker drivers
│   ├── ui.c / ui.h         # LVGL screens
│   └── nvs_config.c / .h   # NVS helpers
├── components/
│   └── (managed components)
└── README.md               # This file
```

---

## Quick Start (once implemented)

```bash
# Set up ESP-IDF environment
. $IDF_PATH/export.sh

# Configure and build
idf.py set-target esp32s3
idf.py build

# Flash
idf.py -p /dev/ttyUSB0 flash monitor
```

---

## Dependencies

- ESP-IDF v5.2+
- LVGL 9.x (via ESP Component Registry)
- Waveshare ESP32-S3-Touch-AMOLED-1.8 board

---

## License

MIT — see [LICENSE](../../LICENSE) in repo root.
