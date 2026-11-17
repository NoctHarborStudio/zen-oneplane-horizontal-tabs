#!/usr/bin/env python3
"""Validate a preview transition without requiring a release for docs-only changes."""
import argparse
import datetime
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()

def manifest(ref):
    return json.loads(git("show", f"{ref}:theme.json"))

def version(value):
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)-preview\.(\d+)", value)
    assert match, f"Invalid preview version: {value}"
    return tuple(map(int, match.groups()))

def timestamp(value):
    parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None, "updatedAt must include a timezone"
    return parsed

def non_runtime(path):
    return (path in {"README.md", "CHANGELOG.md", "scripts/check-publication.py"}
            or path.startswith("docs/")
            or path.startswith(".github/workflows/"))

def validate(base):
    current = json.loads((ROOT / "theme.json").read_text(encoding="utf-8"))
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert current["version"] == package["version"], "Manifest/package version mismatch"
    if not base:
        print("Manual verification: current package metadata; no publication transition")
        return
    previous = manifest(base)
    assert current["id"] == previous["id"], "Sine identity changed"
    assert current["homepage"] == previous["homepage"], "Sine homepage changed"
    changes = git("diff", "--name-only", "--no-renames", base, "HEAD").splitlines()
    if current == previous:
        invalid = [path for path in changes if not non_runtime(path)]
        assert not invalid, f"Runtime/package changes require a new release: {invalid}"
        print("Documentation/CI-only transition: manifest unchanged")
        return
    assert version(current["version"]) > version(previous["version"]), "Version did not increase"
    assert timestamp(current["updatedAt"]) > timestamp(previous["updatedAt"]), "Timestamp did not increase"
    for commit in git("log", "--format=%H", base, "--", "theme.json").splitlines():
        try:
            prior = manifest(commit)
        except subprocess.CalledProcessError:
            continue
        if prior.get("id") == current["id"]:
            assert timestamp(current["updatedAt"]) > timestamp(prior["updatedAt"]), (
                f"Timestamp must exceed {prior['version']} at {commit[:8]}")
    print("Monotonic Sine release transition verified")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base")
    validate(parser.parse_args().base)
