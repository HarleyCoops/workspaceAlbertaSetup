---
name: browser-use-web-automation
description: browser-use-web-automation
---

# Browser Use Web Automation (Pi headless Chromium CDP)

Use for any task that needs a real browser on wa-pi5-christian-01: navigate, scrape, fill forms, click, screenshot, multi-step flows.

## Prerequisites
- Service active: `systemctl --user is-active hermes-browser-cdp.service` → `active`. If not: `systemctl --user restart hermes-browser-cdp.service`.
- Verify CDP: `curl -fsS http://127.0.0.1:9225/json/version` → JSON with `Browser` + `webSocketDebuggerUrl`.
- CLI: `/home/christian/.hermes/bin/browser-use` (browser-use package v0.13.8).

## Invocation (exactly how Hermes drives `browser_exec`)
```bash
export BU_CDP_URL="http://127.0.0.1:9225"
/home/christian/.hermes/bin/browser-use <<'PY'
# one-line plain-language comment (shown as the step label)
ensure_real_tab()
goto_url("https://example.com")
wait_for_load()
print(page_info())
PY
```
Code is piped to stdin and runs as Python with the helpers pre-imported. State (browser + workspace) persists across calls; Python variables do not.

## Helpers (pre-imported)
- `new_tab(url)` / `goto_url(url)` / `wait_for_load()`
- `page_info()` → dict(url, title, w, h, sx, sy, pw, ph)
- `js(expr)` → evaluate JS and return value; wrap function bodies as `js("(() => {...})()")`
- `fill_input(selector, text)`, `click_at_xy(x, y)`
- `capture_screenshot()` → prints a screenshot path
- `cdp("Domain.method", **kwargs)` → raw CDP passthrough
- `ensure_real_tab()` → recover from a stale/internal tab

## Known constraints
- Titles are prefixed with a 🐴 (Browser Use's page indicator). Strip it; ground truth via `js("document.title")` or `curl` of the page.
- Bot-protected portals are NOT scrapeable with this plain headless config: CanadaBuys returns 403, Alberta Purchasing Connection times out. For procurement data use the repo MCP servers (mcp-servers/canadabuys) or the site's API instead.
- CDP is loopback-only (127.0.0.1:9225). Never expose it on LAN/Tailscale.
