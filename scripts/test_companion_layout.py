#!/usr/bin/env python3
"""Sanity checks for the companion experiment files (no secrets, required paths)."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIRMWARE = ROOT / "firmware" / "companion"
FORBIDDEN_PORTS = {3080, 5199, 8799, 49374}


class CompanionLayoutTests(unittest.TestCase):
    def test_required_firmware_files(self) -> None:
        required = [
            FIRMWARE / "CMakeLists.txt",
            FIRMWARE / "dependencies.lock",
            FIRMWARE / "sdkconfig.defaults",
            FIRMWARE / "partitions.csv",
            FIRMWARE / "secrets.example",
            FIRMWARE / "README.md",
            FIRMWARE / "main" / "CMakeLists.txt",
            FIRMWARE / "main" / "idf_component.yml",
            FIRMWARE / "main" / "Kconfig.projbuild",
            FIRMWARE / "main" / "main.c",
            FIRMWARE / "main" / "wifi.c",
            FIRMWARE / "main" / "wifi.h",
            FIRMWARE / "main" / "bridge.c",
            FIRMWARE / "main" / "bridge.h",
            FIRMWARE / "main" / "ui.c",
            FIRMWARE / "main" / "ui.h",
            FIRMWARE / "main" / "nvs_config.c",
            FIRMWARE / "main" / "nvs_config.h",
            FIRMWARE / "main" / "tailscale.c",
            FIRMWARE / "main" / "tailscale.h",
            FIRMWARE / "sdkconfig.credentials.example",
            ROOT / ".github" / "workflows" / "companion-firmware.yml",
        ]
        missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
        self.assertEqual(missing, [])

    def test_bsp_is_v2(self) -> None:
        yml = (FIRMWARE / "main" / "idf_component.yml").read_text(encoding="utf-8")
        self.assertIn("waveshare/esp32_s3_touch_amoled_1_8", yml)
        self.assertIn("^2.0.3", yml)
        self.assertIn('idf: ">=5.5,<6.1"', yml)
        self.assertIn("CO5300", yml)
        self.assertNotIn("version: \"^1\"", yml)

    def test_partitions_referenced_and_present(self) -> None:
        defaults = (FIRMWARE / "sdkconfig.defaults").read_text(encoding="utf-8")
        self.assertIn('CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions.csv"', defaults)
        table = (FIRMWARE / "partitions.csv").read_text(encoding="utf-8")
        self.assertIn("nvs,", table)
        self.assertIn("factory,", table)

    def test_placeholders_only(self) -> None:
        secrets = (FIRMWARE / "secrets.example").read_text(encoding="utf-8")
        defaults = (FIRMWARE / "sdkconfig.defaults").read_text(encoding="utf-8")
        creds_example = (FIRMWARE / "sdkconfig.credentials.example").read_text(encoding="utf-8")
        self.assertIn("YOUR_WIFI_PASSWORD", secrets)
        self.assertIn("wifi_ssid=emc2 Members", secrets)
        self.assertIn("bridge_host=100.106.117.119", secrets)
        self.assertIn("bridge_lan=192.168.0.11", secrets)
        self.assertIn("ts_auth_key=tskey-auth-YOUR_KEY", secrets)
        self.assertIn('CONFIG_WA_WIFI_SSID="emc2 Members"', defaults)
        self.assertIn('CONFIG_WA_WIFI_PASSWORD=""', defaults)
        self.assertIn('CONFIG_WA_BRIDGE_HOST="100.106.117.119"', defaults)
        self.assertIn('CONFIG_WA_BRIDGE_LAN_HOST="192.168.0.11"', defaults)
        self.assertIn("CONFIG_WA_BRIDGE_PORT=8788", defaults)
        self.assertIn('CONFIG_WA_TS_AUTH_KEY=""', defaults)
        self.assertIn('CONFIG_ML_TAILSCALE_AUTH_KEY=""', defaults)
        self.assertIn('CONFIG_WA_TS_HOSTNAME="wa-esp32-amoled"', defaults)
        self.assertNotIn("wifi_pass=", defaults)
        self.assertRegex(secrets, r"wifi_pass=YOUR_WIFI_PASSWORD")
        self.assertIn('CONFIG_WA_TS_AUTH_KEY=""', creds_example)
        self.assertIn('CONFIG_ML_TAILSCALE_AUTH_KEY=""', creds_example)

    def test_microlink_component(self) -> None:
        yml = (FIRMWARE / "main" / "idf_component.yml").read_text(encoding="utf-8")
        cmake = (FIRMWARE / "main" / "CMakeLists.txt").read_text(encoding="utf-8")
        tailscale = (FIRMWARE / "main" / "tailscale.c").read_text(encoding="utf-8")
        self.assertIn("github.com/CamM2325/microlink.git", yml)
        self.assertIn("v2.1.0", yml)
        self.assertIn("path: components/microlink", yml)
        self.assertIn("REQUIRES", cmake)
        self.assertIn("microlink", cmake)
        self.assertIn('#include "microlink.h"', tailscale)
        self.assertIn("microlink_init", tailscale)
        self.assertIn("microlink_start", tailscale)
        kconfig = (FIRMWARE / "main" / "Kconfig.projbuild").read_text(encoding="utf-8")
        self.assertIn("wa-esp32-amoled", kconfig)
        gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("firmware/companion/sdkconfig.credentials", gitignore)
        self.assertNotIn("firmware/companion/dependencies.lock", gitignore)
        self.assertIn("Wno-error=stringop-truncation", cmake)

    def test_locked_build_graph(self) -> None:
        lock = (FIRMWARE / "dependencies.lock").read_text(encoding="utf-8")
        self.assertIn("version: 5.5.5", lock)
        self.assertIn("version: 2.0.3", lock)
        self.assertIn("espressif/esp_lcd_co5300:", lock)
        self.assertIn("version: 2.1.0", lock)
        self.assertIn("microlink:", lock)
        self.assertIn("wireguard_lwip:", lock)
        self.assertIn("version: 5a60e240c5a469999ddaa503dae52417a8b7c6c4", lock)
        self.assertIn("target: esp32s3", lock)

    def test_firmware_build_workflow(self) -> None:
        workflow = (ROOT / ".github" / "workflows" / "companion-firmware.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("espressif/idf:v5.5.5", workflow)
        self.assertIn("idf.py set-target esp32s3", workflow)
        self.assertIn("idf.py build", workflow)

    def test_no_committed_secrets(self) -> None:
        scanned = []
        paths = [
            FIRMWARE / "sdkconfig.defaults",
            FIRMWARE / "sdkconfig.credentials.example",
            FIRMWARE / "secrets.example",
            FIRMWARE / "main" / "Kconfig.projbuild",
            FIRMWARE / "main" / "wifi.c",
            FIRMWARE / "main" / "nvs_config.c",
            FIRMWARE / "main" / "tailscale.c",
            FIRMWARE / "README.md",
            ROOT / "docs" / "handheld-companion.md",
        ]
        for path in paths:
            text = path.read_text(encoding="utf-8")
            scanned.append(path.name)
            for match in re.findall(r"tskey-auth-[A-Za-z0-9_-]+", text):
                self.assertIn(
                    "YOUR_KEY",
                    match,
                    f"real-looking Tailscale auth key in {path}: {match}",
                )
            self.assertNotRegex(text, r"wifi_pass=(?!YOUR_WIFI_PASSWORD).+")
        self.assertTrue(scanned)

    def test_bridge_default_port(self) -> None:
        script = (ROOT / "scripts" / "companion-bridge.py").read_text(encoding="utf-8")
        self.assertIn("DEFAULT_PORT = 8788", script)
        for port in FORBIDDEN_PORTS:
            self.assertIn(str(port), script)

    def test_docs_mark_experiment(self) -> None:
        docs = (ROOT / "docs" / "handheld-companion.md").read_text(encoding="utf-8")
        self.assertIn("Experiment callback slice", docs)
        self.assertIn("8788", docs)
        self.assertIn("192.168.0.11", docs)
        self.assertIn("100.106.117.119", docs)
        self.assertIn("wa-pi5-christian-01", docs)
        self.assertIn("emc2 Members", docs)
        self.assertIn("wa-esp32-amoled", docs)
        self.assertIn("MicroLink", docs)
        self.assertIn("harleycoops.github", docs)
        self.assertIn("0.0.0.0:8788", docs)
        self.assertIn("remains the Workspace Alberta chat app", docs)


if __name__ == "__main__":
    unittest.main()
