#!/usr/bin/env python3
"""Verify the public Sine update contract and both served package endpoints.

Run from the repository root after publishing:
    python scripts/verify-release.py --previous 0.1.0-preview.13 --previous-date 2026-11-15T19:02:03.000Z

No third-party libraries, credentials or modifications to the user's browser.
"""
import argparse
import datetime
import io
import json
import pathlib
import urllib.request
import zipfile
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = "NoctHarborStudio/zen-oneplane-horizontal-tabs"
BRANCH = "preview"
ID = "8b2e214c-e1ba-4b81-9fbf-e08161bf2da4"
RAW = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/theme.json"
ZIP = f"https://codeload.github.com/{REPO}/zip/refs/heads/{BRANCH}"
def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "OnePlane-release-check"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()
def date(value):
    parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=datetime.timezone.utc)
def version(value):
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)-preview\.(\d+)", value)
    if not match:
        raise ValueError(f"Unexpected preview version: {value}")
    return tuple(map(int, match.groups()))
def verify_history(local):
    """Check against every earlier manifest on the preview ancestry.

    Comparing only HEAD^ can miss an older high-water mark after a failed
    intermediate publication. Full checkout required for this check.
    """
    shallow = subprocess.check_output(["git", "rev-parse", "--is-shallow-repository"], cwd=ROOT, text=True).strip()
    assert shallow == "false", "Full git history required for Sine timestamp check"
    commits = subprocess.check_output(
        ["git", "log", "--format=%H", "HEAD^", "--", "theme.json"], cwd=ROOT, text=True
    ).splitlines()
    for commit in commits:
        result = subprocess.run(["git", "show", f"{commit}:theme.json"], cwd=ROOT,
                                capture_output=True, text=True)
        if result.returncode != 0:
            # A historical deletion does not have a manifest.
            continue
        prior = json.loads(result.stdout)
        if prior.get("id") != local["id"]:
            continue
        assert date(local["updatedAt"]) > date(prior["updatedAt"]), (
            f"Sine timestamp must exceed {prior['version']} ({prior['updatedAt']}) at {commit[:8]}"
        )

def validate(previous=None, previous_date=None, offline=False, history=False):
    local = json.loads((ROOT / "theme.json").read_text(encoding="utf-8"))
    assert local["id"] == ID
    assert local["homepage"] == f"https://github.com/{REPO}/tree/{BRANCH}"
    if history:
        verify_history(local)
    if previous:
        assert version(local["version"]) > version(previous), "Version did not increase"
    if previous_date:
        assert date(local["updatedAt"]) > date(previous_date), "Sine timestamp did not increase"
    paths = [local["style"]["chrome"], local["preferences"], *local["scripts"], "theme.json"]
    for name in paths:
        assert (ROOT / name).is_file(), f"Missing {name}"
    if not offline:
        remote = json.loads(fetch(RAW))
        assert remote == local, "Raw GitHub has not propagated this manifest"
        with zipfile.ZipFile(io.BytesIO(fetch(ZIP))) as archive:
            for name in paths:
                matches = [p for p in archive.namelist() if p.split("/", 1)[-1] == name]
                assert len(matches) == 1, f"Missing/ambiguous archive member {name}"
                assert archive.read(matches[0]) == (ROOT / name).read_bytes(), f"Stale archive member {name}"
    print(f"Verified {local['version']} ({local['updatedAt']})" + (" locally" if offline else " via Raw and codeload"))
if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--previous")
    p.add_argument("--previous-date")
    p.add_argument("--offline", action="store_true")
    p.add_argument("--history", action="store_true", help="Check the entire preview manifest history")
    args = p.parse_args()
    validate(args.previous, args.previous_date, args.offline, args.history)
