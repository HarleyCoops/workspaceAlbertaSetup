# Raspberry Pi Out-of-Box Setup

A complete beginner's guide to setting up a WorkspaceAlberta CEO productivity terminal from a sealed box. No prior Raspberry Pi experience required.

Validated on a Raspberry Pi 5 (16GB), Ubuntu Desktop 24.04 LTS ARM64, official 27W USB-C wall supply — hostname example `wa-pi5-christian-01` (2026-08-14/15 unbox). Use this guide so the next Pi does not repeat that setup.

By the end of this guide you will have a working AI-assisted productivity desk: Tailscale for remote support without router hassles, Node 22 and the official DeepSeek Harness CLI (`dsh`), ChatGPT Desktop, Codex CLI, Claude Code, OpenCode / OpenCode2, and the WorkspaceAlberta chat app from this repo. 1Password is optional. Litter (kittylitter.app) is phone-only operator support — customers never see or install it.

---

## 1. What You Need

Before you start, gather these items:

| Item | Notes |
|------|-------|
| **Raspberry Pi 5 16GB** | The 16GB RAM model. Smaller models will work but may run slower with heavy AI workloads. |
| **Power supply** | Official Raspberry Pi **27W USB-C** wall supply (5.1V / 5A). A 45W USB-C PD supply also works. Phone chargers and weak hubs throttle or crash the Pi 5. |
| **Storage** | A high-quality microSD card (32GB minimum, 64GB+ recommended) or an NVMe SSD with a Pi 5-compatible HAT. |
| **Display** | Any monitor with HDMI input. The full terminal spec uses dual 4K monitors, but a single display works fine for initial setup. |
| **Micro-HDMI to HDMI cable** | The Pi 5 uses micro-HDMI ports, not full-size HDMI. |
| **Keyboard and mouse** | USB or Bluetooth. Any keyboard and mouse will work for setup. |
| **Ethernet cable** (recommended) | Wired internet is more reliable during setup. Wi-Fi works but adds troubleshooting steps if it fails. |

---

## 2. Flash the Operating System

The operating system is the software that runs the Pi. You need to write it to your storage card before the Pi can boot.

### Recommended OS

**Ubuntu Desktop 24.04 LTS ARM64** — This is the primary recommendation. Ubuntu 24.04 is officially validated for the ChatGPT/Codex Linux desktop app and provides a smooth, modern desktop experience.

**Alternate:** Raspberry Pi OS Bookworm Desktop (64-bit) also works and boots quickly. The ChatGPT desktop app may show warnings on older OS versions.

### Step-by-step

1. **Download Raspberry Pi Imager** on your main computer (Windows, Mac, or Linux):
   - [https://www.raspberrypi.com/software/](https://www.raspberrypi.com/software/)
   - Install and open it.

2. **Insert your storage** (microSD card or NVMe SSD via USB adapter) into your main computer.

3. **In Raspberry Pi Imager:**
   - Click **Choose Device** → select **Raspberry Pi 5**.
   - Click **Choose OS** → scroll to **Other general-purpose OS** → **Ubuntu** → **Ubuntu Desktop 24.04 LTS (64-bit)**.
   - Click **Choose Storage** → select your microSD or SSD.

4. **Click Next.** A dialog asks if you want to apply customization.

5. **Click Edit Settings** (recommended):
   - **Hostname:** Enter a name like `wa-pi5-christian-01` or `wa-pi5-yourname-01` (lowercase, no spaces).
   - **Username and password:** Create your admin account. Remember this password — you will need it for `sudo` commands.
   - **Wireless LAN:** If you are using Wi-Fi, enter your network name and password here.
   - **Locale settings:** Set your timezone (e.g., `America/Edmonton` for Alberta).
   - **Services tab (optional):** Enable SSH if you want remote terminal access before Tailscale is set up.

6. **Click Save**, then **Yes** to apply settings.

7. **Wait for the write and verification** to complete. This takes 10–30 minutes depending on your card speed.

8. **Remove the card/SSD** from your computer when finished.

---

## 3. First Boot

1. **Insert the storage** into your Raspberry Pi 5:
   - MicroSD: slot on the underside of the board.
   - NVMe: mounted on a HAT above or below the board (follow your HAT instructions).

2. **Connect the display** using the micro-HDMI cable.

3. **Connect keyboard and mouse.**

4. **Connect Ethernet** (recommended) or ensure Wi-Fi credentials were set during imaging.

5. **Plug in the power supply.** The Pi will boot automatically.

6. **Wait for Ubuntu (or Raspberry Pi OS) to start.** First boot takes longer as the system expands to fill the card and runs initial setup.

7. **Follow the on-screen setup wizard:**
   - Select language and keyboard layout.
   - Connect to Wi-Fi if you did not set it during imaging.
   - Set your timezone if prompted (e.g., **Canada/Edmonton** for Alberta).
   - Create your admin user if you skipped it during imaging.
   - Skip or defer online accounts — you do not need Ubuntu One for this.

8. **Let the system finish any background updates** before proceeding. You may see a "Software Updater" prompt.

---

## 4. Run System Updates

Open a terminal. On Ubuntu Desktop, press `Ctrl+Alt+T` or search for "Terminal" in the applications menu.

Run:

```bash
sudo apt update && sudo apt full-upgrade -y
```

**What this does:** Downloads the latest package lists (`update`) and installs all available upgrades (`full-upgrade`). This ensures your system is current before installing additional software.

**Note:** The CEO installer script will also run updates, so this step is optional if you prefer to let the installer handle it.

If prompted, enter the password you created during setup. You will not see characters as you type — this is normal.

---

## 5. Run the CEO Software Installer

The installer script sets up the CEO productivity tools: Tailscale, Node.js 22 (NodeSource), DeepSeek Harness (`@deepseek-ai/dsh`), Codex CLI, Claude Code, ChatGPT Desktop (Linux arm64 `.deb`), OpenCode / OpenCode2 layout, optional 1Password, and the WorkspaceAlberta chat app.

### Basic install

```bash
git clone https://github.com/HarleyCoops/workspaceAlbertaSetup.git ~/workspaceAlbertaSetup
cd ~/workspaceAlbertaSetup
chmod +x installer/install-ceo-pi.sh
./installer/install-ceo-pi.sh
```

**What this does:**

1. **git clone** downloads the workspaceAlbertaSetup repository to your home folder.
2. **cd** changes into that folder.
3. **chmod +x** makes the installer script executable.
4. **./installer/install-ceo-pi.sh** runs the installer.

The installer will prompt for your `sudo` password. Let it run to completion — it installs packages, configures services, downloads the AI desktop apps, and attempts to install the WorkspaceAlberta chat app from releases.

### With Tailscale auto-join (optional)

If your IT administrator gave you a Tailscale auth key and hostname, you can join the support network automatically:

```bash
export HOSTNAME_FQ="wa-pi5-yourcompany-edmonton-01"
export TS_AUTHKEY="tskey-auth-..."
./installer/install-ceo-pi.sh
```

**What is Tailscale?** Tailscale is a private VPN that lets support staff reach your terminal remotely without opening router ports or exposing your Pi to the public internet. If something goes wrong, your support team can connect securely to troubleshoot.

For the full list of installer options, see [`ceo-pi-setup.md`](ceo-pi-setup.md).

---

## 6. First-Login Checklist

After the installer finishes, open a **new terminal** (or run `source ~/.bashrc`) so the new tools are on your PATH.

### 1. Sign into 1Password (optional)

1Password is useful for secrets but is **not required** for the desk to work. Skip this if you are not using it (`INSTALL_1PASSWORD=0` on the next unbox).

- Open the applications menu and launch **1Password**.
- Sign in with your CEO / business account (or create one at [1password.com](https://1password.com)).
- Enable browser integration if prompted — this unlocks autofill in Chromium/Firefox.
- The 1Password CLI (`op`) is also installed for scripting and automation.

### 2. Sign into ChatGPT Desktop

- Open the applications menu and launch **ChatGPT**.
- Sign in with your OpenAI account (create one at [chat.openai.com](https://chat.openai.com) if needed).
- Once signed in, you can use ChatGPT directly on your desktop.

### 3. Authenticate Codex CLI

In the terminal, run:

```bash
codex
```

A browser window will open. Sign in with your OpenAI account. Once authenticated, Codex CLI can help you write and debug code from the terminal.

### 3b. Authenticate Claude Code

Hugging Face / Llama inside WorkspaceAlberta is **text-only**. Composio tools (Gmail, Drive, Slack, GitHub) require **Claude Code or Codex**.

```bash
claude
```

Sign in when prompted. If `claude` is missing:

```bash
sudo /usr/bin/npm i -g @anthropic-ai/claude-code
```

Use `/usr/bin/npm` — see [Node.js on the Pi](#7-nodejs-deepseek-harness-and-the-chat-app-from-source).

### 4. Authenticate OpenCode

In the terminal, run:

```bash
opencode
```

Follow the authentication prompts for your preferred AI provider.

### 5. Launch WorkspaceAlberta Chat App

If a `.deb` was installed, open **WorkspaceAlberta** from the applications menu.

There is often no release yet. From this repo, the path that actually works on the desk is `git pull`, `pnpm install`, and `pnpm start` (the `scripts/start-desktop.mjs` helper). Vite serves the UI at `http://127.0.0.1:5199`. See [WorkspaceAlberta from this repo](#workspacealberta-from-this-repo) below.

- Open **App Settings** (gear icon in sidebar).
- Paste a [Hugging Face token](https://huggingface.co/settings/tokens) only if you want optional text inference (GLM, Llama, Qwen). HF/Llama cannot drive Composio tools.
- For Gmail / Drive / Slack / GitHub, install and sign in to **Claude Code or Codex**, then paste a Composio Connect key (`ck_…`) in App Settings.

Packaging a `.deb` is optional (`pnpm package:pi`) and is slower than `pnpm start` for first boot.

### 6. Approve Tailscale (if no auth key was provided)

If you ran the installer without a `TS_AUTHKEY`, Tailscale is installed but not connected. To join:

```bash
sudo tailscale up --ssh --hostname="$(hostname)" --advertise-tags="tag:wa-terminal,tag:wa-pi5"
```

This prints a URL. Open it in a browser, sign in to your organization's Tailscale account, and approve the device. Ask your IT administrator if you do not have a Tailscale account.

From a Windows desktop on the same tailnet, `tailscale ssh christian@wa-pi5-christian-01` (use your Pi username and hostname) works. For unattended commands, add a dedicated ed25519 key — see [Dedicated SSH key from Windows](#dedicated-ssh-key-from-windows) below.

---

## 7. Node.js, DeepSeek Harness, and the chat app from source

The CEO installer now installs Node 22 (NodeSource), `build-essential`, `python3`, and `@deepseek-ai/dsh`. If you are on a Pi that was unboxed before that change, run the steps in this section by hand.

### Node 22.19+ (or 24+)

DeepSeek Harness needs **Node 22.19+ or 24+**. NodeSource Node 22 is the supported path. Ubuntu Desktop terminals can pick up an older Node earlier on `PATH` (snap, nvm, or the distro package). Prefer the NodeSource binaries:

```bash
/usr/bin/node -v
/usr/bin/npm -v
```

If `/usr/bin/node` is missing or older than 22.19:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
/usr/bin/node -v
```

Do **not** treat an npm 12 upgrade as a required step. Use the npm that ships with NodeSource Node 22.

### DeepSeek Harness (`dsh`)

DeepSeek Harness is the official published package **`@deepseek-ai/dsh`**. Do **not** clone and build the DeepSeek monorepo on the Pi — that build is too heavy.

Install path that actually works:

```bash
sudo apt-get install -y build-essential python3
sudo /usr/bin/npm i -g @deepseek-ai/dsh
```

`build-essential` must come first. The `node-pty` native addon fails without `g++`.

The binary lands at `/usr/bin/dsh`. Launch it from the **Ubuntu Terminal** app (not from inside the WorkspaceAlberta Electron window). Working directory does not matter:

```bash
dsh web
```

`dsh web` binds **`http://127.0.0.1:3080` only** (not the LAN). Open that URL in a browser on the Pi, then paste a DeepSeek API key in **Settings → Models**.

This key and UI are **separate** from WorkspaceAlberta's in-app DeepSeek driver (App Settings → DeepSeek API key / `DEEPSEEK_API_KEY`). One does not configure the other.

### WorkspaceAlberta from this repo

```bash
cd ~/workspaceAlbertaSetup
git pull
sudo /usr/bin/npm i -g pnpm
pnpm install
pnpm start
```

`pnpm start` runs `scripts/start-desktop.mjs`: harness server (`127.0.0.1:8799`), Vite (`127.0.0.1:5199`), and Electron. A black Electron window usually means Vite is not up yet.

If **pnpm 11** blocks `electron` / `esbuild` postinstall scripts:

```bash
pnpm config set dangerouslyAllowAllBuilds true
pnpm install
```

Live TypeScript needs Node 22+. On Node 20, run `pnpm build:server` first.

### OpenCode2, Codex, ChatGPT Desktop

These are part of the CEO installer. Confirm they landed:

```bash
opencode --version
opencode2 --version
codex --version
dpkg -l | grep chatgpt
```

If `opencode2` is missing, re-run the official installer (`curl -fsSL https://opencode.ai/install | bash`) and see [`opencode2-layout/README.md`](../opencode2-layout/README.md). ChatGPT Desktop is the Linux **arm64** `.deb` from OpenAI, not the Windows/Mac store build.

---

## Dedicated SSH key from Windows

`tailscale ssh <user>@<hostname>` is fine for interactive support. A dedicated ed25519 key is more reliable for unattended commands (scripts, editors, CI-style `ssh host cmd`).

On the Windows desktop (OpenSSH):

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\wa-pi5-ed25519 -C "wa-pi-unbox"
Get-Content $HOME\.ssh\wa-pi5-ed25519.pub
```

On the Pi, append that single public-key line to the login user's `~/.ssh/authorized_keys` (create `~/.ssh` at mode `700` and `authorized_keys` at mode `600` if needed). Use your Pi username (example: `christian`), not a pasted secret.

Then add a Host entry in Windows `~/.ssh/config` (OpenSSH: `C:\Users\<you>\.ssh\config`):

```sshconfig
Host wa-pi5-christian-01
  HostName 100.x.x.x
  User christian
  IdentityFile ~/.ssh/wa-pi5-ed25519
  IdentitiesOnly yes
```

Set `HostName` to the Pi's Tailscale **100.x** IPv4 (`tailscale ip -4` on the Pi). `IdentitiesOnly yes` stops OpenSSH from offering every other key and failing the attempt.

Test from Windows:

```powershell
ssh wa-pi5-christian-01 hostname
```

Do not commit private keys, Tailscale auth keys, or API keys. See [`tailscale-pi-remote-support.md`](tailscale-pi-remote-support.md) for the full support runbook.

---

## 8. You're Done When...

Run these checks to confirm everything is working:

```bash
# Check hostname
hostname

# Check Tailscale connection
tailscale status
tailscale ip -4

# Node + DeepSeek Harness (use these paths, not a shadowed node)
/usr/bin/node -v
/usr/bin/npm -v
/usr/bin/dsh --help

# Check 1Password (optional)
1password --version
op --version

# Check AI tools
codex --version
claude --version
opencode --version
opencode2 --version
dpkg -l | grep chatgpt
dpkg -l | grep workspacealberta
```

**Expected results:**

- `hostname` shows your device name (example: `wa-pi5-christian-01`).
- `tailscale status` shows "Connected" or lists your Tailscale 100.x IP.
- `/usr/bin/node -v` is **v22.19+** or **v24+**.
- `/usr/bin/dsh --help` prints usage. `dsh web` listens on `http://127.0.0.1:3080`.
- `1password --version` and `op --version` print version numbers if you installed 1Password.
- `codex --version`, `claude --version`, and `opencode --version` print version numbers.
- `dpkg -l | grep chatgpt` shows a line with "chatgpt" (the Linux arm64 desktop app).
- WorkspaceAlberta either appears in `dpkg -l` or launches via `pnpm start` (Vite on `127.0.0.1:5199`).

If all checks pass, your CEO productivity terminal is ready to use.

---

## 9. If Something Goes Wrong

### "command not found" after installing Codex or OpenCode

The tools are installed, but your terminal does not see them yet. Fix:

```bash
source ~/.bashrc
```

Or close and reopen the terminal window. The installers add paths to `~/.bashrc`, which loads when you open a new terminal.

### "permission denied" running the installer

You forgot to make the script executable. Fix:

```bash
chmod +x installer/install-ceo-pi.sh
./installer/install-ceo-pi.sh
```

### "sudo: incorrect password" or "user is not in the sudoers file"

You either typed the wrong password or your user does not have administrator access. Fixes:

- Double-check you are typing the password you created during first boot.
- If you did not create a user during imaging, you may be logged in as a default user without sudo. Re-flash the card with proper user settings in Raspberry Pi Imager.

### No network connection

Check physical connections first:

1. Is the Ethernet cable plugged in at both ends? Try a different cable.
2. For Wi-Fi, is the network name and password correct? Open Settings → Wi-Fi and reconnect.
3. Can you reach the router? Run `ping 8.8.8.8` — if it works, DNS may be the issue. Try `ping google.com`.

If Ethernet works but Wi-Fi does not, use Ethernet for setup and troubleshoot Wi-Fi later.

### Tailscale not joining or "failed to connect"

1. Confirm internet connectivity first (`ping 8.8.8.8`).
2. Check if Tailscale is running:

   ```bash
   sudo systemctl status tailscaled
   ```

3. If stopped, start it:

   ```bash
   sudo systemctl start tailscaled
   ```

4. Try joining again:

   ```bash
   sudo tailscale up --advertise-tags="tag:wa-terminal,tag:wa-pi5" --ssh
   ```

5. If you have an auth key but it is expired or invalid, ask your administrator for a fresh key.

### ChatGPT Desktop does not start or shows errors

The desktop app is validated for Ubuntu 24.04/26.04 and Fedora. On Raspberry Pi OS Bookworm it may show compatibility warnings.

- Try running it from the terminal to see error messages:

  ```bash
  chatgpt
  ```

- If it fails due to missing libraries, ensure your system is fully updated:

  ```bash
  sudo apt update && sudo apt full-upgrade -y
  ```

### WorkspaceAlberta chat app not found

If the installer said "No release found", run the app from this repo instead of waiting on a `.deb`:

```bash
cd ~/workspaceAlbertaSetup
git pull
pnpm install
pnpm start
```

`pnpm start` opens Electron after Vite is up on `127.0.0.1:5199`. Packaging (`pnpm package:pi`) is optional.

### `dsh` missing, or `node-pty` / `g++` errors during install

Install the compiler toolchain first, then the published CLI — not a source checkout:

```bash
sudo apt-get install -y build-essential python3
sudo /usr/bin/npm i -g @deepseek-ai/dsh
/usr/bin/dsh --help
```

### `node -v` is 18.x (or another old version) but NodeSource is installed

A desktop terminal picked up an older Node on `PATH`. Call the NodeSource binaries directly:

```bash
/usr/bin/node -v
/usr/bin/npm -v
sudo /usr/bin/npm i -g @deepseek-ai/dsh
```

### `dsh web` is not reachable from another machine

That is expected. The UI binds `127.0.0.1:3080` only. Open it in a browser **on the Pi**, or use an SSH tunnel. Do not run `dsh` inside the WorkspaceAlberta Electron app.

---

## Next Steps

- Read the full software installer reference: [`ceo-pi-setup.md`](ceo-pi-setup.md)
- Learn about remote support: [`tailscale-pi-remote-support.md`](tailscale-pi-remote-support.md)
- Phone-based support with Litter (not customer-facing): [`litter-remote-support.md`](litter-remote-support.md)
- Configure Hugging Face for optional text inference: WorkspaceAlberta → App Settings → HF token. Claude or Codex is required for Composio tools.

---

## Optional: Procurement MCP Tools

The procurement MCP agents (CanadaBuys, etc.) live in a separate repository. If you need them:

```bash
git clone https://github.com/HarleyCoops/WorkspaceAlberta.git ~/WorkspaceAlberta
cd ~/WorkspaceAlberta
python3 -m pip install -r requirements.txt
python3 -m unittest tests.test_canadabuys_mcp_smoke
```
