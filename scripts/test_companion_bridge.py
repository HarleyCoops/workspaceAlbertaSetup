#!/usr/bin/env python3
"""Tests for the LAN companion bridge listener (stdlib only)."""

from __future__ import annotations

import importlib.util
import json
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

_SPEC_PATH = Path(__file__).with_name("companion-bridge.py")
_SPEC = importlib.util.spec_from_file_location("companion_bridge", _SPEC_PATH)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError(f"cannot load {_SPEC_PATH}")
companion_bridge = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(companion_bridge)

FORBIDDEN_PORTS = companion_bridge.FORBIDDEN_PORTS
SERVICE_NAME = companion_bridge.SERVICE_NAME
create_server = companion_bridge.create_server


def _json(method: str, url: str, body: dict | None = None) -> tuple[int, dict]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"} if body is not None else {}
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=3) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        payload = json.loads(exc.read().decode("utf-8"))
        return exc.code, payload


class CompanionBridgeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = create_server("127.0.0.1", 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.server.server_address[:2]
        self.base = f"http://{host}:{port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)

    def test_health(self) -> None:
        status, payload = _json("GET", f"{self.base}/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["service"], SERVICE_NAME)
        self.assertIsInstance(payload["uptime_seconds"], int)
        self.assertGreaterEqual(payload["uptime_seconds"], 0)

    def test_ping_and_latest(self) -> None:
        body = {
            "device": "wa-companion",
            "event": "ping",
            "uptime_ms": 1234,
            "ip": "192.168.1.50",
        }
        status, payload = _json("POST", f"{self.base}/ping", body)
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertIn("Pi heard you at ", payload["reply"])
        self.assertEqual(payload["echo"], body)

        latest_status, latest = _json("GET", f"{self.base}/reply/latest")
        self.assertEqual(latest_status, 200)
        self.assertEqual(latest["reply"], payload["reply"])
        self.assertEqual(latest["text"], payload["reply"])
        self.assertEqual(latest["echo"], body)
        self.assertTrue(latest["created_at"])

    def test_event_alias(self) -> None:
        status, payload = _json("POST", f"{self.base}/event", {"device": "wa-companion", "event": "ping"})
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["echo"]["event"], "ping")

    def test_invalid_json(self) -> None:
        req = Request(
            f"{self.base}/ping",
            data=b"not-json",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(HTTPError) as ctx:
            urlopen(req, timeout=3)
        self.assertEqual(ctx.exception.code, 400)

    def test_unknown_path(self) -> None:
        status, payload = _json("GET", f"{self.base}/approvals/pending")
        self.assertEqual(status, 404)
        self.assertFalse(payload["ok"])

    def test_refuses_reserved_ports(self) -> None:
        for port in FORBIDDEN_PORTS:
            with self.subTest(port=port):
                with self.assertRaises(ValueError):
                    create_server("127.0.0.1", port)


class CompanionBridgeImportTests(unittest.TestCase):
    def test_default_port_is_8788(self) -> None:
        self.assertEqual(companion_bridge.DEFAULT_PORT, 8788)
        self.assertNotIn(companion_bridge.DEFAULT_PORT, FORBIDDEN_PORTS)


if __name__ == "__main__":
    try:
        unittest.main()
    except URLError as exc:
        raise SystemExit(f"local HTTP test failed: {exc}") from exc
