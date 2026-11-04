"""Guards for the phase 1 Android shell: it must open the same site the
app links to everywhere else, and never allow plain HTTP."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "android-shell" / "capacitor.config.json").read_text(encoding="utf-8"))


def _render_base_url() -> str:
    text = (ROOT / "render.yaml").read_text(encoding="utf-8")
    match = re.search(r"key: APP_BASE_URL\s+value: (\S+)", text)
    assert match, "render.yaml should set APP_BASE_URL"
    return match.group(1)


def test_shell_opens_the_render_site():
    assert CONFIG["server"]["url"] == _render_base_url()


def test_shell_is_https_only_and_stays_on_its_host():
    server = CONFIG["server"]
    assert server["url"].startswith("https://")
    assert server["cleartext"] is False
    assert server["allowNavigation"] == [server["url"].removeprefix("https://")]
    assert CONFIG["android"]["allowMixedContent"] is False


def test_offline_page_exists():
    assert (ROOT / "android-shell" / "www" / CONFIG["server"]["errorPath"]).is_file()
