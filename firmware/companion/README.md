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
2. If NVS has no Wi-Fi password: open SoftAP `WA-Companion` and/or USB serial config.
3. Join `emc2 Members` (Wi-Fi is the **underlay** only).
4. After Wi-Fi is up, start **MicroLink** so the board is its own tailnet node (`wa-esp32-amoled` on **harleycoops.github**).
5. Home shows connection status, **tailnet IP** once MicroLink is up, last Pi reply, large **Call Pi**.
6. Poll `GET /health` and tap → `POST /ping` to the Pi over Tailscale first (`http://100.106.117.119:8788`). MagicDNS `wa-pi5-christian-01` / `wa-pi5-christian-01.tail397d4d.ts.net` is tried if MicroLink resolve works. LAN `192.168.0.11:8788` is the fallback if Tailscale is down.
7. If Wi-Fi, Tailscale, or the Pi is down, the screen and the serial log say so.

Default target is the live desk Pi Tailscale IP: **`http://100.106.117.119:8788`**.

---

## Live Pi (confirmed)

Do not change running Pi services (Workspace Alberta on **127.0.0.1:8799** stays as-is; no bridge key in `~/.config/workspacealberta/config.json`).

| Fact | Value |
| --- | --- |
| Hostname | `wa-pi5-christian-01` |
| Checkout | `~/workspaceAlbertaSetup` |
| LAN | `192.168.0.11/24` on `wlan0`, gateway `192.168.0.1` |
| Wi-Fi SSID | `emc2 Members` (password **not** in git) |
| Experiment URL (primary) | `http://100.106.117.119:8788` (Tailscale) |
| Experiment URL (fallback) | `http://192.168.0.11:8788` (LAN) |
| MagicDNS | `wa-pi5-christian-01` / `wa-pi5-christian-01.tail397d4d.ts.net` |
| Tailnet | **harleycoops.github** — ESP32 joins as `wa-esp32-amoled` via MicroLink |
| Reserved ports | Do not bind 8799, 3080, 5199, 49374 |
| Pi toolchain | Python 3.12.3. No mosquitto, Flask, or `idf.py` on the Pi |

---

## First-run config (no secrets in git)

**Never commit a Tailscale auth key, Wi-Fi password, or token.** Defaults already set `wifi_ssid=emc2 Members`, `bridge_host=100.106.117.119`, `bridge_lan=192.168.0.11`, `bridge_port=8788`, `ts_hostname=wa-esp32-amoled`. **The Wi-Fi password and Tailscale auth key are entered on the device.**

Repo placeholders only:

- [`secrets.example`](secrets.example) — `wifi_pass=YOUR_WIFI_PASSWORD`, `ts_auth_key=tskey-auth-YOUR_KEY`
- [`sdkconfig.credentials.example`](sdkconfig.credentials.example) — empty `CONFIG_WA_TS_AUTH_KEY` / `CONFIG_ML_TAILSCALE_AUTH_KEY`
- empty `CONFIG_WA_WIFI_PASSWORD` and `CONFIG_WA_TS_AUTH_KEY` in `sdkconfig.defaults`
- `sdkconfig.credentials` is gitignored (copy the example on the flash machine)

Until NVS has a Wi-Fi password, the board stays on the first-run SoftAP / serial setup screen and does not try to join `emc2 Members` as an open network. Until NVS has a Tailscale auth key, MicroLink does not start and HTTP uses the LAN fallback.

### Tailscale auth key (Christian)

1. Generate a **reusable** auth key at https://login.tailscale.com/admin/settings/keys for tailnet **harleycoops.github**.
2. Paste it **only** on the board (SoftAP / USB serial) or in the gitignored `sdkconfig.credentials` on the flash machine. Do not put it in a PR.
3. After the board appears, **Approve** the new node (`wa-esp32-amoled`) in the Tailscale admin if the tailnet requires approval (same as other new nodes).

### SoftAP

1. Power the board. Setup appears because the password is not in NVS.
2. Join Wi-Fi **WA-Companion** (open AP, first-run only).
3. Open `http://192.168.4.1`.
4. SSID and Pi hosts/port are pre-filled. Enter the **emc2 Members** password and the Tailscale auth key. Save — the board reboots.

### USB serial

USB-C is the ESP32-S3 native USB port (Waveshare docs). After `idf.py monitor`:

```
set wifi_ssid emc2 Members
set wifi_pass YOUR_WIFI_PASSWORD
set bridge_host 100.106.117.119
set bridge_lan 192.168.0.11
set bridge_port 8788
set ts_hostname wa-esp32-amoled
set ts_auth_key tskey-auth-YOUR_KEY
save
```

`show` prints the hosts/port and whether a password or auth key is set (it does not print secrets).

---

## Flash on USB-C (developer machine)

Need **ESP-IDF v5.5.x** (Waveshare’s verified matrix is IDF `>=5.5,<6.1`). This firmware is compiled in CI with the exact official `espressif/idf:v5.5.5` image. `dependencies.lock` pins the resolved Waveshare BSP, display/touch drivers, LVGL, MicroLink v2.1.0 commit, and sibling WireGuard component.

```bash
cd firmware/companion
. $IDF_PATH/export.sh
idf.py set-target esp32s3
idf.py build
idf.py -p /dev/ttyACM0 flash monitor
```

If the port is missing, hold **BOOT**, tap **PWR** / replug USB-C, then flash. Other common names: `/dev/ttyUSB0`, macOS `/dev/cu.usbmodem*`, Windows `COMx`.

Component Manager downloads `waveshare/esp32_s3_touch_amoled_1_8` and **MicroLink v2.1.0** (`#include "microlink.h"`, verified from [CamM2325/microlink](https://github.com/CamM2325/microlink) `components/microlink/include/microlink.h`) into `managed_components/` (gitignored). Their official example uses `EXTRA_COMPONENT_DIRS ../../components` and `REQUIRES microlink`; this project pulls the same component via `idf_component.yml` at tag `v2.1.0`.

ESP-IDF 5.5.5 uses GCC 14 and promotes `stringop-truncation` to an error. MicroLink v2.1.0 contains two bounded, null-terminated `strncpy` patterns that trigger that diagnostic. The project downgrades only that warning and only on the `microlink` component target; warnings in the companion firmware remain errors.

MicroLink’s recommended board is **ESP32-S3 + 8MB OPI PSRAM** (they also list a Waveshare AMOLED 2.06). This V2 1.8 board matches that class. Do not implement a custom Tailscale/WireGuard stack.

Optional local secrets overlay (never commit it):

```bash
cp sdkconfig.credentials.example sdkconfig.credentials
# paste CONFIG_WA_TS_AUTH_KEY / CONFIG_ML_TAILSCALE_AUTH_KEY locally
```

---

## Run the Pi listener (wa-pi5-christian-01)

On the Raspberry Pi, from `~/workspaceAlbertaSetup`. **Not** on :8799 (Workspace Alberta, loopback-only) and **not** on :3080 (DeepSeek harness). Do not edit running WA services.

```bash
cd ~/workspaceAlbertaSetup
python3 scripts/companion-bridge.py
```

Listens on `0.0.0.0:8788` so it is reachable on **both** Tailscale (`100.106.117.119`) and LAN (`192.168.0.11`). **No auth. Do not expose to the internet.** Do not touch :3080, :8799, :5199, or :49374.

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
├── dependencies.lock       # Reproducible IDF 5.5.5 component graph
├── sdkconfig.defaults
├── sdkconfig.credentials.example   # empty placeholders; copy locally
├── partitions.csv          # Waveshare 00_bsp_quickstart table (16MB)
├── secrets.example
├── main/
│   ├── idf_component.yml   # BSP ^2.0.3 + MicroLink v2.1.0
│   ├── Kconfig.projbuild
│   ├── main.c
│   ├── nvs_config.c/.h
│   ├── wifi.c/.h           # STA + first-run SoftAP portal
│   ├── tailscale.c/.h      # MicroLink wrapper (wa-esp32-amoled)
│   ├── bridge.c/.h         # Tailscale HTTP then LAN fallback
│   └── ui.c/.h             # LVGL via BSP; home shows tailnet IP
└── README.md
```

---

## License

MIT — see [LICENSE](../../LICENSE) in the repo root.
