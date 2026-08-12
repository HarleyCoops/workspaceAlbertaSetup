# Handheld Companion Remote — v1 Design

A wireless companion remote for WorkspaceAlberta CEO terminals, built on the **Waveshare ESP32-S3-Touch-AMOLED-1.8** board.

> **This document is both a beginner-friendly setup guide and an engineering spec.** Read it end to end before starting firmware development.

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

### Project structure (scaffold)

```
firmware/companion/
├── CMakeLists.txt
├── sdkconfig.defaults
├── main/
│   ├── CMakeLists.txt
│   ├── main.c              # App entry, task init
│   ├── wifi.c / wifi.h     # WiFi provisioning + reconnect
│   ├── bridge.c / bridge.h # HTTP client for Pi bridge API
│   ├── audio.c / audio.h   # Mic capture, speaker playback
│   ├── ui.c / ui.h         # LVGL screens + event handlers
│   └── nvs_config.c / .h   # NVS read/write helpers
├── components/
│   └── lvgl/               # LVGL as managed component
└── README.md               # Points here
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
| Pi Host | IP address or hostname (e.g., `192.168.1.100` or `wa-pi5.local`) |
| Pi Port | Default `8799`, editable |
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
4. Enter Pi host: the IP or hostname of your WorkspaceAlberta Pi (e.g., `192.168.1.100` or `wa-pi5.local`)
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
- Pi bridge host and port

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

## Implementation Status

| Component | Status |
|-----------|--------|
| Design doc | ✅ Complete (this document) |
| Firmware scaffold | 🔜 Stub created, implementation TBD |
| Bridge API on Pi | 🔜 Spec complete, implementation TBD |
| LVGL UI screens | 🔜 Design complete, implementation TBD |
| Push-to-talk audio | 🔜 Spec complete, implementation TBD |
| Hardware validation | 🔜 Board ordered, testing TBD |

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
