"""P14-08: install and release you can trust (TL-06, SEC-04/05/06/08)."""

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = ROOT / ".github" / "workflows"


def _text(name):
    return (WORKFLOWS / name).read_text(encoding="utf-8")


def _job(name, job):
    """The lines of one job (no YAML parser in the test deps)."""
    m = re.search(rf"^  {job}:\n(.*?)(?=^  \w[\w-]*:\n|\Z)", _text(name), re.S | re.M)
    assert m, job
    return m.group(1)


def test_every_action_is_pinned_to_a_commit():
    for f in WORKFLOWS.glob("*.yml"):
        for line in f.read_text(encoding="utf-8").splitlines():
            m = re.search(r"uses:\s*([^\s#]+)", line)
            if m:
                assert re.fullmatch(r"[\w.-]+/[\w.-]+@[0-9a-f]{40}", m.group(1)), f"{f.name}: {m.group(1)}"


def test_the_default_token_can_only_read():
    for f in WORKFLOWS.glob("*.yml"):
        assert re.search(r"^permissions:\n  contents: read\n", _text(f.name), re.M), f.name


def test_only_the_release_job_can_write_and_it_needs_approval():
    release, apk = _job("android.yml", "release"), _job("android.yml", "apk")
    assert "    environment: release\n" in release
    assert "      contents: write" in release
    assert "startsWith(github.ref, 'refs/tags/v')" in release
    assert "permissions" not in apk
    assert "secrets." not in apk
    assert "    environment: release\n" in _job("make-signing-key.yml", "key")


def test_the_keystore_artifact_is_encrypted():
    text = (WORKFLOWS / "make-signing-key.yml").read_text(encoding="utf-8")
    assert "openssl enc -aes-256-cbc -pbkdf2 -iter 600000" in text
    assert "path: ${{ runner.temp }}/enc/" in text


def test_release_notes_list_hashes_and_the_signing_code(tmp_path):
    apk = tmp_path / "fitness-os-0.6.0-friends.apk"
    apk.write_bytes(b"apk")
    cert = ":".join(["AB", "CD", "EF", "01"] * 8)
    out = subprocess.run(
        [str(ROOT / "scripts" / "release-notes.sh"), "0.6.0", cert, str(apk)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    assert "Signing code: `ABCD-EF01`" in out
    assert "fitness-os-0.6.0-friends.apk | `" in out
    assert "dd37c2d7274f7ea982cb83390c36918fee9ce8889073c44b68cdc00bdb8c3e04" in out  # sha256 of b"apk"
    assert "don't uninstall" in out
    bad = subprocess.run([str(ROOT / "scripts" / "release-notes.sh"), "0.6.0", "nope", str(apk)], capture_output=True)
    assert bad.returncode != 0
