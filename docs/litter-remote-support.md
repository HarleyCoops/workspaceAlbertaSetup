# Litter Mobile Support Client

A quick reference for Christian's phone-based remote support workflow using [KittyLitter/Litter](https://kittylitter.app/).

---

## What Litter Is (and Isn't)

| Is | Is Not |
|----|--------|
| A native iOS/Android client for Codex and OpenCode | A customer-facing app |
| Christian's phone support tool | Part of the desk SKU |
| An SSH client over Tailscale | A replacement for Tailscale |
| Optional on-site tool via Alleycat QR | A replacement for Composio |

**Bottom line:** Litter is an operator convenience—connect to a customer Pi from your phone, run Codex or OpenCode, fix the problem, disconnect. Customers never see or install it.

---

## Prerequisites

| Component | Where |
|-----------|-------|
| **Tailscale on Pi** | Installed by `install-ceo-pi.sh`; device joins with `tag:wa-terminal` / `tag:wa-pi5` |
| **Tailscale on phone** | [iOS App Store](https://apps.apple.com/app/tailscale/id1470499037) / Google Play; same tailnet as the Pi |
| **Codex and/or OpenCode on Pi** | Installed by the CEO installer |
| **Litter on iPhone** | [KittyLitter on App Store](https://apps.apple.com/ca/app/kittylitter/id6759521788) |

---

## Deploy-Time: Unique Hostname

Each customer Pi needs a unique Tailscale hostname so you can identify it later.

```bash
export HOSTNAME_FQ="wa-customer-acme"
export TS_AUTHKEY="tskey-auth-..."
./installer/install-ceo-pi.sh
```

The installer sets the Pi's Tailscale hostname to `$HOSTNAME_FQ` and joins the tailnet. Write the hostname on the shipping label or in your CRM.

---

## Support-Time: Phone → Pi

1. **Tailscale up on phone** — Open Tailscale, confirm you're connected to the same tailnet.
2. **Open Litter** — Tap **SSH** or **Connections**.
3. **Add connection** (first time):
   - Host: `user@wa-customer-acme` (MagicDNS hostname)
   - Auth: Tailscale SSH handles it; no password needed if ACLs allow your user
4. **Connect** — Litter opens a terminal session over the Tailscale tunnel.
5. **Run Codex or OpenCode**:
   ```bash
   codex
   # or
   opencode
   ```
6. **Fix the issue**, then disconnect.

### If MagicDNS Is Unavailable

Use the Tailscale IP instead:

```
user@100.x.y.z
```

Find IPs in the Tailscale admin console or run `tailscale status` on a connected device.

---

## Optional: Alleycat QR (On-Site)

When you're physically at a customer location and Tailscale isn't reachable:

1. On the Pi, open a terminal and run Alleycat (if installed) to display a QR code.
2. In Litter, tap **Alleycat** and scan the QR.
3. Litter establishes a P2P connection without Tailscale.

Use this sparingly—Tailscale SSH is more secure and auditable.

---

## Fleet Tips

| Concern | Guidance |
|---------|----------|
| **ACLs** | Only `group:support` should SSH to `tag:wa-terminal`. See [`tailscale-pi-remote-support.md`](tailscale-pi-remote-support.md) for policy examples. |
| **Secrets** | Store TS auth keys in 1Password, not plaintext files. Never commit keys. |
| **Litter ≠ Composio** | Litter is an SSH/terminal client. Composio is the app-integration layer (Gmail, Slack, etc.). They don't overlap. |
| **Hostname conventions** | `wa-customer-<name>` or `wa-pi5-<customer>-<location>-<n>` keeps the admin console readable. |

---

## Links

- **Litter website:** <https://kittylitter.app/>
- **Litter on App Store:** <https://apps.apple.com/ca/app/kittylitter/id6759521788>
- **Tailscale remote support runbook:** [`tailscale-pi-remote-support.md`](tailscale-pi-remote-support.md)
