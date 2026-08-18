#!/usr/bin/env python3
"""Sanity checks for the companion experiment files (no secrets, required paths)."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIRMWARE = ROOT / "firmware" / "companion"
FORBIDDEN_PORTS = {3080, 5199, 8799, 49374}


class CompanionLayoutTests(unittest.TestCase):
    def test_required_firmware_files(self) -> None:
        required = [
            FIRMWARE / "CMakeLists.txt",
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
        self.assertIn("YOUR_WIFI_PASSWORD", secrets)
        self.assertIn('CONFIG_WA_WIFI_PASSWORD=""', defaults)
        self.assertIn("CONFIG_WA_BRIDGE_PORT=8788", defaults)
        self.assertNotIn("wifi_pass=", defaults)
        self.assertRegex(secrets, r"wifi_pass=YOUR_WIFI_PASSWORD")

    def test_bridge_default_port(self) -> None:
        script = (ROOT / "scripts" / "companion-bridge.py").read_text(encoding="utf-8")
        self.assertIn("DEFAULT_PORT = 8788", script)
        for port in FORBIDDEN_PORTS:
            self.assertIn(str(port), script)

    def test_docs_mark_experiment(self) -> None:
        docs = (ROOT / "docs" / "handheld-companion.md").read_text(encoding="utf-8")
        self.assertIn("Experiment callback slice", docs)
        self.assertIn("8788", docs)
        self.assertIn("remains the Workspace Alberta chat app", docs)


if __name__ == "__main__":
    unittest.main()
