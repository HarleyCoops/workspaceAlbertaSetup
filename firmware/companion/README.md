# Handheld Companion Firmware (experiment)

ESP-IDF firmware for Christian’s **Waveshare ESP32-S3-Touch-AMOLED-1.8 V2** board.

This is the **callback experiment**, not the full product in [`docs/handheld-companion.md`](../../docs/handheld-companion.md). There is no push-to-talk, no approvals UI, and no Whisper. The board joins Wi-Fi, polls the Pi, and shows the reply from **Call Pi**.

| Full product (spec only) | This experiment (implemented) |
| --- | --- |
| 5 screens, PTT, approvals | Boot + first-run setup + home |
| Bridge on the WA harness | Standalone Pi listener on **:8788** |
| Port 8799 (Workspace Alberta app) | **Do not bind 8799** |

---

## Hardware (V2 only)

Confirmed on the board sticker: **V2**.

| Piece | V2 |
| --- | --- |
| MCU | ESP32-S3, 16MB flash, 8MB OPI PSRAM |
| Display | CO5300, 368×448 AMOLED, QSPI |
| Touch | CST820 |
| Other | IMU QMI8658, RTC PCF85063, PMIC AXP2101, audio ES8311 |
| Buttons | USB-C, BOOT, PWR |

**Do not use V1 SH8601 / FT3168 paths.**

Official sources used (pins were not invented):

- https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.8
- V2 Arduino header: `examples/arduino-v2/libraries/Mylibrary/pin_config.h`
- ESP-IDF examples: `examples/esp-idf/00_bsp_quickstart`, `10_wifi_station`, `14_lvgl_demo_v9`
- Managed BSP: [`waveshare/esp32_s3_touch_amoled_1_8` ^2.0.3](https://components.espressif.com/components/waveshare/esp32_s3_touch_amoled_1_8)
- Docs: https://docs.waveshare.com/ESP32-S3-Touch-AMOLED-1.8
- Wiki: https://www.waveshare.com/wiki/ESP32-S3-Touch-AMOLED-1.8

Firmware calls `bsp_display_start()` from that BSP. GPIOs are the BSP’s. The Arduino V2 header is listed below only so a reviewer can see the first-party numbers:

```
# examples/arduino-v2/libraries/Mylibrary/pin_config.h
LCD_SDIO0=4 LCD_SDIO1=5 LCD_SDIO2=6 LCD_SDIO3=7
LCD_SCLK=11 LCD_CS=12  LCD_WIDTH=368 LCD_HEIGHT=448
IIC_SDA=15 IIC_SCL=14 TP_INT=21
```

BSP v2.0.3 drives **CO5300** and auto-detects CST816S-compatible touch (the V2 chip is CST820; Waveshare’s own Arduino V2 tree still uses CST816x-family APIs for that compatible driver). Waveshare’s `00_bsp_quickstart` README states the same.

---

## What the board does

1. Boot screen (dark pine `#071417`, prairie amber `#D4A373`).
2. If NVS/Kconfig have no `wifi_ssid`: open SoftAP `WA-Companion` and/or USB serial config.
3. On Wi-Fi: `GET http://{bridge_host}:8788/health` every 5 seconds.
4. Home: connection status, last Pi reply (2–3 lines), large **Call Pi**.
5. Tap → `POST /ping` with `{device,event,uptime_ms,ip}`. Show `reply` on screen.
6. If Wi-Fi or the Pi is down, the screen and the serial log say so.

Default bridge port is **8788**. Point `bridge_host` at the Pi’s LAN IP (for example `192.168.1.42` on wa-pi5). This experiment does not resolve `.local` names.

---

## First-run config (no secrets in git)

Never commit real Wi-Fi passwords or tokens. Repo placeholders:

- [`secrets.example`](secrets.example)
- empty `CONFIG_WA_WIFI_SSID` / `CONFIG_WA_WIFI_PASSWORD` in `sdkconfig.defaults`

### SoftAP

1. Power the board. Setup screen appears if SSID is empty.
2. Join Wi-Fi **WA-Companion** (open AP, first-run only).
3. Open `http://192.168.4.1`.
4. Enter SSID, password, Pi LAN IP, port `8788`. Save — the board reboots.

### USB serial

USB-C is the ESP32-S3 native USB port (Waveshare docs). After `idf.py monitor`:

```
set wifi_ssid YOUR_SSID
set wifi_pass YOUR_PASSWORD
set bridge_host 192.168.1.42
set bridge_port 8788
save
```

`show` prints the host/port and whether a password is set (it does not print the password).

---

## Flash on USB-C (developer machine)

Need **ESP-IDF v5.5.x** (Waveshare’s verified matrix is IDF `>=5.5,<6.1`; their CI uses 5.5.5). This repo does not compile ESP-IDF in CI — build on a machine with IDF installed.

```bash
cd firmware/companion
. $IDF_PATH/export.sh
idf.py set-target esp32s3
idf.py build
idf.py -p /dev/ttyACM0 flash monitor
```

If the port is missing, hold **BOOT**, tap **PWR** / replug USB-C, then flash. Other common names: `/dev/ttyUSB0`, macOS `/dev/cu.usbmodem*`, Windows `COMx`.

Component Manager downloads `waveshare/esp32_s3_touch_amoled_1_8` into `managed_components/` (gitignored).

---

## Run the Pi listener (wa-pi5)

On the Raspberry Pi, **not** on :8799 (Workspace Alberta) and **not** on :3080 (DeepSeek harness):

```bash
cd ~/workspaceAlbertaSetup
python3 scripts/companion-bridge.py
```

Listens on `0.0.0.0:8788`. **LAN-only, no auth. Do not expose to the internet.**

Example systemd user unit (do not enable it from this repo automatically):

```bash
mkdir -p ~/.config/systemd/user
cp scripts/companion-bridge.service ~/.config/systemd/user/
# edit ExecStart if the clone path is not ~/workspaceAlbertaSetup
systemctl --user daemon-reload
systemctl --user start companion-bridge.service
```

Smoke-check from the Pi or another LAN host:

```bash
curl -s http://127.0.0.1:8788/health
curl -s -X POST http://127.0.0.1:8788/ping \
  -H 'Content-Type: application/json' \
  -d '{"device":"wa-companion","event":"ping","uptime_ms":1,"ip":"127.0.0.1"}'
```

Then tap **Call Pi** on the board.

---

## Project layout

```
firmware/companion/
├── CMakeLists.txt
├── sdkconfig.defaults
├── partitions.csv          # Waveshare 00_bsp_quickstart table (16MB)
├── secrets.example
├── main/
│   ├── idf_component.yml   # idf >=5.5,<6.1 ; BSP ^2.0.3
│   ├── Kconfig.projbuild
│   ├── main.c
│   ├── nvs_config.c/.h
│   ├── wifi.c/.h           # STA + first-run SoftAP portal
│   ├── bridge.c/.h         # GET /health, POST /ping
│   └── ui.c/.h             # LVGL via BSP
└── README.md
```

---

## License

MIT — see [LICENSE](../../LICENSE) in the repo root.
