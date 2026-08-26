# Handheld Companion Remote — v1 Design

A wireless companion remote for WorkspaceAlberta CEO terminals, built on the **Waveshare ESP32-S3-Touch-AMOLED-1.8** board.

> **This document is the full product spec (5 screens, PTT, approvals).** It is **not** fully implemented. What exists today is a smaller **experiment callback slice**: the V2 board calls a standalone Pi listener on **port 8788** and shows the reply. See [Experiment callback slice](#experiment-callback-slice-implemented) and [`firmware/companion/README.md`](../firmware/companion/README.md).
>
> Port **8799** remains the Workspace Alberta chat app. Port **3080** remains the DeepSeek harness. Do not put this experiment on those ports.

---

## What It Is

The handheld companion is a **status display + push-to-talk + approval remote** for the Raspberry Pi CEO terminal. It lets operators glance at agent status, approve or deny pending actions, and issue voice commands — all without walking to the desk or pulling up a laptop.

**Think walkie-talkie control panel, not second computer.**

### Non-goals (what it is NOT)

| ❌ Not this | ✅ Instead |
|-------------|-----------|
| A standalone chat app or full desktop | A thin remote for the Pi brain |
| Running local LLMs on the ESP32 | Forwarding voice/approvals to the Pi |
| Storing credentials or chat history | Stateless display; Pi owns all data |
| Internet-routable public API | LAN-only or Tailscale mesh |
| Complex multi-screen navigation | 4–5 simple screens max |

The **Raspberry Pi** runs WorkspaceAlberta, agents, and the harness server. The handheld **only** displays status, records push-to-talk audio, and relays approve/deny taps.

---

## Hardware: Waveshare ESP32-S3-Touch-AMOLED-1.8

| Feature | Spec | v1 Usage |
|---------|------|----------|
| MCU | ESP32-S3 dual-core 240 MHz, 8 MB PSRAM | ✅ Main controller |
| Display | 1.8" 368×448 AMOLED, capacitive touch | ✅ Status screens + touch buttons |
| Connectivity | WiFi 802.11 b/g/n, Bluetooth 5.0 LE | ✅ WiFi for bridge API |
| Audio | Onboard digital mic + speaker driver | ✅ Push-to-talk + audio feedback |
| Power | AXP2101 PMIC, LiPo battery support | ✅ Portable handheld use |
| Expansion | QWIIC/Stemma QT, GPIO header | 🔜 Future: haptic feedback |

**Why this board?** Compact all-in-one with touch AMOLED, mic, speaker, and battery management — no soldering required for the v1 prototype.

### Board documentation

- [Waveshare Wiki: ESP32-S3-Touch-AMOLED-1.8](https://www.waveshare.com/wiki/ESP32-S3-Touch-AMOLED-1.8)
- [Schematic PDF](https://www.waveshare.com/w/upload/9/9d/ESP32-S3-Touch-AMOLED-1.8_Schematic.pdf)

---

## Firmware Stack

### Framework: ESP-IDF + LVGL

| Layer | Technology | Notes |
|-------|------------|-------|
| RTOS | FreeRTOS (bundled with ESP-IDF) | Task scheduling, WiFi stack |
| GUI | LVGL 9.x | Touch-enabled UI widgets |
| Storage | NVS (Non-Volatile Storage) | WiFi creds, Pi host, settings |
| HTTP | ESP-IDF `esp_http_client` | Bridge API calls |
| Audio | ESP-IDF I2S driver | Mic capture, speaker playback |

**Why ESP-IDF over Arduino?** Full control of WiFi power management, lower memory overhead, and better LVGL integration for production firmware.

### Project structure (experiment + later product)

The experiment implements `main`, `wifi`, `bridge`, `tailscale`, `ui`, and `nvs_config`. `audio` is still TBD for the full product. LVGL arrives through the Waveshare BSP, not a checked-in `components/lvgl`. Tailscale is **MicroLink** (`#include "microlink.h"`), not a custom WireGuard stack.

```
firmware/companion/
├── CMakeLists.txt
├── sdkconfig.defaults
├── sdkconfig.credentials.example  # empty placeholders; copy locally
├── partitions.csv          # Required; referenced by sdkconfig.defaults
├── secrets.example         # Placeholders only
├── main/
│   ├── CMakeLists.txt
│   ├── idf_component.yml   # BSP ^2.0.3 + MicroLink v2.1.0
│   ├── main.c              # Experiment entry
│   ├── wifi.c / wifi.h     # STA + first-run SoftAP
│   ├── tailscale.c / .h    # MicroLink after Wi-Fi
│   ├── bridge.c / bridge.h # HTTP → :8788 (Tailscale, then LAN)
│   ├── ui.c / ui.h         # Boot / setup / home (shows tailnet IP)
│   └── nvs_config.c / .h   # wifi, Tailscale key, Pi hosts
└── README.md
```

---

## Screens

The handheld has 5 screens, navigable by touch and swipe.

### 1. Boot Screen

**Purpose:** Shown on power-on while WiFi connects.

| Element | Description |
|---------|-------------|
| Logo | WorkspaceAlberta wordmark, dark pine `#071417` background |
| Spinner | Prairie amber `#D4A373` animated ring |
| Status text | "Connecting to WiFi…" / "Connecting to Pi…" |

**Transitions:**
- WiFi + bridge healthy → Home
- WiFi fails after 30s → Setup
- Bridge unreachable after 10s (WiFi OK) → Home with "Pi offline" banner

### 2. Setup Screen (First Run / Settings → Reconfigure)

**Purpose:** Configure WiFi network and Pi host address.

| Element | Description |
|---------|-------------|
| WiFi SSID | Touch to scan + select, or manual entry |
| WiFi Password | On-screen keyboard (masked input) |
| Pi Host | Experiment default is the Pi Tailscale IP `100.106.117.119` (`wa-pi5-christian-01`), with LAN fallback `192.168.0.11`. Wi-Fi is the underlay; Tailscale/MicroLink is the path to the Pi. |
| Pi Port | Full-product sketch: `8799`. **Experiment (implemented): `8788`.** Do not bind 8799 for the listener. |
| Save button | Writes to NVS, attempts connection |

**Flow:**
1. Scan WiFi → user picks SSID → enter password
2. Enter Pi host (or mDNS hostname if supported)
3. Save → attempts connect → success → Home / failure → error toast, retry

**Stored in NVS:**
- `wifi_ssid` (string, max 32 chars)
- `wifi_pass` (string, max 64 chars)
- `bridge_host` (string, max 64 chars)
- `bridge_port` (u16, default 8799)

### 3. Home Screen

**Purpose:** Primary status display + push-to-talk.

| Element | Description |
|---------|-------------|
| Status indicator | Green dot = connected, amber = degraded, red = offline |
| Last reply preview | 2–3 lines of most recent agent response |
| Timestamp | "2 min ago" relative time |
| Push-to-talk button | Large amber button, bottom center |
| Pending count badge | Red badge if approvals waiting (tap → Approvals) |

**Push-to-talk flow:**
1. User presses and holds the PTT button
2. Amber border pulses; mic records (16-bit PCM, 16 kHz mono)
3. User releases; audio uploads via `POST /voice`
4. Spinner while Pi transcribes + processes
5. Reply appears in preview; full reply via `GET /reply/latest`

**Auto-refresh:** Polls `GET /health` every 10s, `GET /reply/latest` every 5s (when screen active).

### 4. Approvals Screen

**Purpose:** List pending tool/action approvals from agents.

| Element | Description |
|---------|-------------|
| List | Scrollable cards, newest first |
| Card | Bot name, action summary, timestamp |
| Approve button | Green checkmark → `POST /approvals/{id}` with `approved: true` |
| Deny button | Red X → `POST /approvals/{id}` with `approved: false` |

**Pull-to-refresh** or auto-refresh every 10s.

**Empty state:** "No pending approvals ✓" centered, muted text.

### 5. Settings Screen

**Purpose:** Reconfigure WiFi/host, view device info, power options.

| Element | Description |
|---------|-------------|
| Reconfigure WiFi | Opens Setup screen |
| Device info | Firmware version, MAC, IP, battery % |
| Brightness slider | AMOLED brightness 10–100% |
| Sleep timeout | 30s / 1m / 5m / Never |
| Power off | Graceful shutdown |

---

## Pi Companion Bridge API

The Pi runs a lightweight HTTP bridge (extension of the harness server or standalone service on the same port). The handheld calls these endpoints over LAN.

### `GET /health`

**Purpose:** Check if the bridge is alive and get basic status.

**Response:**
```json
{
  "status": "ok",
  "uptime_seconds": 3600,
  "pending_approvals": 2,
  "last_activity": "2026-08-12T15:30:00Z"
}
```

### `GET /approvals/pending`

**Purpose:** List pending approval requests.

**Response:**
```json
{
  "approvals": [
    {
      "id": "apr_abc123",
      "bot_name": "Procurement Bot",
      "action": "Send email to vendor@example.com",
      "created_at": "2026-08-12T15:28:00Z"
    }
  ]
}
```

### `POST /approvals/{id}`

**Purpose:** Approve or deny a pending action.

**Request:**
```json
{
  "approved": true
}
```

**Response:**
```json
{
  "id": "apr_abc123",
  "status": "approved",
  "executed_at": "2026-08-12T15:31:00Z"
}
```

### `POST /voice`

**Purpose:** Upload push-to-talk audio for transcription and processing.

**Request:**
- Content-Type: `audio/wav` or `application/octet-stream`
- Body: Raw WAV (16-bit PCM, 16 kHz mono) or raw PCM samples

**Response:**
```json
{
  "transcript": "Check the status of the CanadaBuys tender",
  "reply_id": "rpl_xyz789",
  "processing": true
}
```

The Pi transcribes (Whisper or similar), routes to the appropriate agent, and stores the reply.

### `GET /reply/latest`

**Purpose:** Fetch the most recent agent reply for display.

**Response:**
```json
{
  "reply_id": "rpl_xyz789",
  "bot_name": "Procurement Bot",
  "text": "The CanadaBuys tender W7714-12345 closes on August 15. Current status: Open for bids.",
  "created_at": "2026-08-12T15:31:30Z"
}
```

---

## Flash and Setup

### Prerequisites

1. **ESP-IDF v5.2+** installed ([Getting Started Guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/get-started/))
2. **USB-C cable** (data-capable, not charge-only)
3. **LiPo battery** (3.7V, 500–1000 mAh recommended) — optional but recommended for portable use

### First-time flash

```bash
# Clone the repo (if not already)
git clone https://github.com/HarleyCoops/workspaceAlbertaSetup.git
cd workspaceAlbertaSetup/firmware/companion

# Set up ESP-IDF environment
. $IDF_PATH/export.sh

# Configure target
idf.py set-target esp32s3

# Build
idf.py build

# Flash (hold BOOT button on board if needed)
idf.py -p /dev/ttyUSB0 flash

# Monitor serial output
idf.py -p /dev/ttyUSB0 monitor
```

**Note:** On macOS, the port is typically `/dev/cu.usbserial-*`. On Windows, use `COMx`.

### First-run WiFi setup

1. Power on the handheld (USB or battery)
2. Boot screen shows "Connecting…" then fails → Setup screen
3. Select WiFi network, enter password
4. Enter the **emc2 Members** password and a Tailscale auth key (on-device only). Experiment port is **8788** (8799 is the Workspace Alberta app). Default Pi host is Tailscale `100.106.117.119` with LAN fallback `192.168.0.11`. Never commit the password or auth key.
5. Tap Save → connects → Home screen appears

### Enable bridge on Pi

The bridge API must be enabled on the Pi's harness server. Add to your Pi's `~/.config/workspacealberta/config.json`:

```json
{
  "bridge": {
    "enabled": true,
    "bind": "0.0.0.0",
    "port": 8799
  }
}
```

Or set environment variable before starting the harness:

```bash
export WA_BRIDGE_ENABLED=1
```

**Restart the harness server** for changes to take effect.

> **Note:** The bridge API is part of the WorkspaceAlberta harness. See the root [README.md](../README.md) for harness setup.

---

## Security Notes

### LAN/Tailscale only — no public exposure

The bridge API has **no authentication** in v1. It is designed for:

- **Private LAN** — Pi and handheld on the same home/office network
- **Tailscale mesh** — Pi and handheld both joined to the same tailnet

**Never expose the bridge port (8799) to the public internet.**

If using Tailscale:
1. Join both Pi and handheld to the same tailnet
2. Use the Pi's Tailscale IP (e.g., `100.x.x.x`) as the bridge host
3. Traffic is encrypted and authenticated by Tailscale

### No secrets in firmware

The handheld stores **only**:
- WiFi SSID and password (in NVS, encrypted at rest by ESP32-S3)
- Tailscale auth key (NVS or gitignored `sdkconfig.credentials` — never committed)
- Pi Tailscale host, LAN fallback host, and port

It does **not** store:
- API keys (HF token, etc.)
- Chat history or transcripts
- User credentials

All sensitive data stays on the Pi in `~/.config/workspacealberta/`.

### Future: mTLS or token auth

v2 may add:
- Bridge API token (generated on Pi, entered once on handheld)
- mTLS with device certificates
- Tailscale-only mode (rejects non-Tailscale connections)

---

## Brand Guidelines

| Element | Value |
|---------|-------|
| Background | Dark pine `#071417` |
| Accent | Prairie amber `#D4A373` |
| Text (primary) | White `#FFFFFF` |
| Text (muted) | `#A0A0A0` |
| Success | `#4ADE80` (green) |
| Error/Danger | `#EF4444` (red) |

**Typography:** Use a clean sans-serif (e.g., Inter or system default). LVGL's built-in fonts work; custom fonts can be added later.

**Logo:** WorkspaceAlberta wordmark, amber on dark pine, displayed on boot and in Settings.

---

## Relationship to Other Docs

| Document | Scope |
|----------|-------|
| [pi-out-of-box-setup.md](pi-out-of-box-setup.md) | Setting up the Pi hardware + OS |
| [ceo-pi-setup.md](ceo-pi-setup.md) | Installing WorkspaceAlberta software on the Pi |
| This document | Handheld companion design + firmware |

The handheld is a **companion** to the Pi, not a replacement. Set up the Pi first using the linked guides, then add the handheld as a remote.

**This is separate from ChatGPT Desktop / Codex Desktop.** Those apps run on the Pi's monitor. The handheld is a physical remote for away-from-desk use.

---

## Experiment callback slice (implemented)

Christian’s board is **V2** (CO5300 + CST820). The experiment uses ESP-IDF and Waveshare’s managed BSP `waveshare/esp32_s3_touch_amoled_1_8` **^2.0.3** — the same path as their `examples/esp-idf/00_bsp_quickstart` and `10_wifi_station`. It does **not** use V1 SH8601/FT3168 drivers.

| Piece | Where | Notes |
|-------|--------|-------|
| Device firmware | [`firmware/companion/`](../firmware/companion/) | Boot, SoftAP/serial/NVS config, home, **Call Pi** |
| Pi listener | [`scripts/companion-bridge.py`](../scripts/companion-bridge.py) | Python 3 stdlib `http.server`, bind `0.0.0.0:8788` |
| systemd example | [`scripts/companion-bridge.service`](../scripts/companion-bridge.service) | User unit example; do not enable it automatically |

**Live desk Pi (confirmed). Do not change running Pi services.**

| Fact | Value |
|------|--------|
| Hostname | `wa-pi5-christian-01` |
| Checkout | `~/workspaceAlbertaSetup` (`firmware/companion`, this doc) |
| LAN | `192.168.0.11/24` on `wlan0`, gateway `192.168.0.1` |
| Wi-Fi SSID | `emc2 Members` (password entered on the handheld, never committed) |
| Experiment URL (primary) | `http://100.106.117.119:8788` (Tailscale) |
| Experiment URL (fallback) | `http://192.168.0.11:8788` (LAN, if MicroLink is down) |
| Tailscale | ESP32 joins **harleycoops.github** as `wa-esp32-amoled` via [MicroLink](https://github.com/CamM2325/microlink) v2.1.0 (`#include "microlink.h"`). Pi: `100.106.117.119` / `wa-pi5-christian-01.tail397d4d.ts.net` |
| :8799 | Workspace Alberta, loopback-only; no bridge key in `~/.config/workspacealberta/config.json` |
| Pi software | Python 3.12.3. No mosquitto, Flask, or `idf.py` on the Pi |

**Run on wa-pi5-christian-01** (does not enable systemd; does not touch :8799):

```bash
cd ~/workspaceAlbertaSetup
python3 scripts/companion-bridge.py
```

Listener stays `0.0.0.0:8788` so it is reachable on **both LAN and Tailscale**. No authentication. Do not expose port 8788 to the internet. Do not bind 8799, 3080, 5199, or 49374.

Endpoints (kept small so a later full companion can keep using them):

- `GET /health` → `{"status":"ok","service":"wa-companion-bridge","uptime_seconds":N}`
- `POST /ping` and `POST /event` → log JSON, return `{"ok":true,"reply":"Pi heard you at <iso time>","echo": <body>}`
- `GET /reply/latest` → last ping/event reply text

On the board: NVS/Kconfig defaults are `wifi_ssid=emc2 Members`, `bridge_host=100.106.117.119`, `bridge_lan=192.168.0.11`, `bridge_port=8788`, `ts_hostname=wa-esp32-amoled`. **Wi-Fi is the underlay; Tailscale is the path to the Pi.** First-run still needs the Wi-Fi password **and** a reusable Tailscale auth key entered on-device (SoftAP `WA-Companion` at `http://192.168.4.1`, USB serial `set wifi_pass` / `set ts_auth_key` / `save`, or gitignored `sdkconfig.credentials`). Christian generates the key at https://login.tailscale.com/admin/settings/keys for tailnet harleycoops.github and may need to **Approve** `wa-esp32-amoled` in the Tailscale admin. Never commit the password or auth key. Placeholders live in [`firmware/companion/secrets.example`](../firmware/companion/secrets.example).

The home screen shows the tailnet IP once MicroLink is up.

Flash steps: [`firmware/companion/README.md`](../firmware/companion/README.md). Default target is `http://100.106.117.119:8788`.

The screens, PTT, approvals, and Whisper sections below are still the **target product**. They are not this experiment.

---

## Implementation Status

| Component | Status |
|-----------|--------|
| Design doc | ✅ Complete (this document is the full product spec) |
| Experiment callback slice | ✅ Device ↔ Pi on **:8788** (Wi-Fi underlay, MicroLink tailnet, LAN fallback) |
| Firmware (full 5-screen product) | 🔜 PTT, approvals, settings still TBD |
| Full bridge on the WA app (:8799) | 🔜 Not implemented; experiment is a standalone listener |
| LVGL UI (full spec) | 🔜 Experiment home only |
| Push-to-talk audio / Whisper | 🔜 Spec complete, implementation TBD |
| Hardware validation | 🔜 V2 board confirmed; flash/run on-desk still TBD |

---

## Appendix: Parts List

| Item | Source | Notes |
|------|--------|-------|
| Waveshare ESP32-S3-Touch-AMOLED-1.8 | [Waveshare](https://www.waveshare.com/esp32-s3-touch-amoled-1.8.htm), Amazon, AliExpress | ~$25–35 USD |
| LiPo battery 3.7V 1000mAh | Amazon, Adafruit | JST-PH 2.0 connector; check polarity |
| USB-C data cable | Any | Must be data-capable, not charge-only |
| 3D-printed enclosure | TBD | CAD files to be added |

---

## Appendix: Useful Links

- [ESP-IDF Programming Guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/)
- [LVGL Documentation](https://docs.lvgl.io/)
- [ESP32-S3 Technical Reference Manual](https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf)
- [AXP2101 Datasheet](http://www.x-powers.com/en.php/Info/product_detail/article_id/55) (PMIC)
