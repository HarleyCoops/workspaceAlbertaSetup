#!/usr/bin/env python3
"""LAN-only handheld companion bridge (experiment).

Stdlib only. No authentication. Bind 0.0.0.0:8788 for the Pi LAN test.

Do not expose this port to the internet.
Do not bind 8799 (Workspace Alberta), 3080 (DeepSeek harness), 5199, or 49374.
The handheld defaults to the live desk Pi LAN: http://192.168.0.11:8788
(wa-pi5-christian-01 on wlan0). Tailscale is not the experiment default.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8788
FORBIDDEN_PORTS = {3080, 5199, 8799, 49374}
SERVICE_NAME = "wa-companion-bridge"
MAX_BODY_BYTES = 64 * 1024

logger = logging.getLogger("wa-companion-bridge")


class BridgeState:
    def __init__(self) -> None:
        self.started = time.monotonic()
        self.lock = threading.Lock()
        self.latest_reply = ""
        self.latest_echo: Any = None
        self.latest_created_at = ""

    def uptime_seconds(self) -> int:
        return int(time.monotonic() - self.started)

    def record(self, reply: str, echo: Any, created_at: str) -> None:
        with self.lock:
            self.latest_reply = reply
            self.latest_echo = echo
            self.latest_created_at = created_at

    def latest(self) -> dict[str, Any]:
        with self.lock:
            return {
                "reply": self.latest_reply,
                "text": self.latest_reply,
                "echo": self.latest_echo,
                "created_at": self.latest_created_at,
            }


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def make_handler(state: BridgeState) -> type[BaseHTTPRequestHandler]:
    class CompanionBridgeHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, format: str, *args: Any) -> None:
            logger.info("%s - %s", self.address_string(), format % args)

        def _send_json(self, status: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self) -> tuple[Any | None, str | None]:
            raw_len = self.headers.get("Content-Length", "0")
            try:
                length = int(raw_len)
            except ValueError:
                return None, "invalid Content-Length"
            if length < 0 or length > MAX_BODY_BYTES:
                return None, "body too large or invalid"
            raw = self.rfile.read(length) if length else b"{}"
            if not raw:
                raw = b"{}"
            try:
                return json.loads(raw.decode("utf-8")), None
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                return None, f"invalid JSON: {exc}"

        def do_GET(self) -> None:
            path = self.path.split("?", 1)[0]
            if path == "/health":
                self._send_json(
                    200,
                    {
                        "status": "ok",
                        "service": SERVICE_NAME,
                        "uptime_seconds": state.uptime_seconds(),
                    },
                )
                return
            if path == "/reply/latest":
                self._send_json(200, state.latest())
                return
            if path == "/":
                self._send_json(
                    200,
                    {
                        "service": SERVICE_NAME,
                        "docs": "GET /health, POST /ping, POST /event, GET /reply/latest",
                        "warning": "LAN-only experiment. No auth. Do not expose to the internet.",
                    },
                )
                return
            self._send_json(404, {"ok": False, "error": "not found"})

        def do_POST(self) -> None:
            path = self.path.split("?", 1)[0]
            if path not in ("/ping", "/event"):
                self._send_json(404, {"ok": False, "error": "not found"})
                return

            body, error = self._read_json()
            if error:
                self._send_json(400, {"ok": False, "error": error})
                return

            created_at = utc_now_iso()
            reply = f"Pi heard you at {created_at}"
            logger.info("accepted %s %s", path, json.dumps(body, default=str))
            state.record(reply, body, created_at)
            self._send_json(200, {"ok": True, "reply": reply, "echo": body})

    return CompanionBridgeHandler


def create_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> ThreadingHTTPServer:
    if port in FORBIDDEN_PORTS:
        raise ValueError(
            f"port {port} is reserved (Workspace Alberta / harness / Vite). Use {DEFAULT_PORT}."
        )
    handler = make_handler(BridgeState())
    return ThreadingHTTPServer((host, port), handler)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="WorkspaceAlberta handheld companion bridge (LAN experiment, no auth)."
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help="Bind address (default 0.0.0.0)")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Bind port (default {DEFAULT_PORT}; do not use 8799/3080/5199/49374)",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    try:
        server = create_server(args.host, args.port)
    except ValueError as exc:
        logger.error("%s", exc)
        return 2

    bound_host, bound_port = server.server_address[:2]
    logger.info(
        "listening on http://%s:%s (LAN-only, no auth — do not expose to the internet)",
        bound_host,
        bound_port,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("shutting down")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
