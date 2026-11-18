#!/usr/bin/env python3
"""Verify Nocturne's Sine package, publication history and served endpoints.

A publication changes the manifest or an installed file. Each such commit
on preview must advance both metadata fields; docs/source-only commits may
retain them. Rollback is a new publication, never a reused version.
"""
import argparse
import datetime
import io
import json
import pathlib
import re
import subprocess
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = "NoctHarborStudio/zen-oneplane-horizontal-tabs"
BRANCH = "preview"
ID = "8b2e214c-e1ba-4b81-9fbf-e08161bf2da4"
HOMEPAGE = f"https://github.com/{REPO}/tree/{BRANCH}"
RAW = f"https://raw.githubusercontent.com/{REPO}"
ZIP = f"https://codeload.github.com/{REPO}/zip"

def require(condition, message):
    if not condition:
        raise ValueError(message)

def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Nocturne-release-check"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()

def git(*args, optional=False):
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True)
    if optional and result.returncode:
        return None
    result.check_returncode()
    return result.stdout

def date(value):
    parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=datetime.timezone.utc)

def version(value):
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)-preview\.(\d+)", value)
    require(match is not None, f"Unexpected preview version: {value}")
    return tuple(map(int, match.groups()))

def package_paths(manifest):
    paths = ["theme.json", manifest["style"]["chrome"], manifest["preferences"], *manifest.get("scripts", {})]
    require(len(paths) == len(set(paths)), "Duplicate installed package path")
    for name in paths:
        require(isinstance(name, str) and name and "\\" not in name and ":" not in name
                and not name.startswith("-") and not pathlib.PurePosixPath(name).is_absolute()
                and all(part not in ("", ".", "..") for part in name.split("/")),
                f"Unsafe installed path: {name}")
    return paths

def manifest_at(commit):
    raw = git("show", f"{commit}:theme.json", optional=True)
    return json.loads(raw) if raw is not None else None

def parent(commit):
    raw = git("rev-parse", "--verify", f"{commit}^1", optional=True)
    return raw.decode().strip() if raw is not None else None

def package_changed(old, new):
    before = manifest_at(old) if old else None
    after = manifest_at(new)
    if before is None or after is None:
        return before != after
    paths = sorted(set(package_paths(before)) | set(package_paths(after)))
    return bool(git("diff", "--name-only", old, new, "--", *paths).strip())

def check_publication(commit, local):
    require(local["id"] == ID and local["homepage"] == HOMEPAGE, "Sine identity or homepage changed")
    current_version, current_date = version(local["version"]), date(local["updatedAt"])
    package = git("show", f"{commit}:package.json", optional=True)
    require(package is not None and json.loads(package)["version"] == local["version"],
            f"Manifest and package versions differ at {commit[:8]}")
    for name in package_paths(local):
        require(git("cat-file", "-t", f"{commit}:{name}", optional=True) == b"blob\n",
                f"Missing installed file {name} at {commit[:8]}")
    prior = parent(commit)
    if prior is None:
        return
    # First-parent history is the preview publication lineage, not unpublished
    # side-branch candidates merged later. Inspect all historical manifest epochs.
    commits = git("log", "--first-parent", "--format=%H", prior, "--", "theme.json").decode().splitlines()
    for sha in commits:
        old = manifest_at(sha)
        if old is None or old.get("id") != ID:
            continue
        require(current_version > version(old["version"]),
                f"Version must exceed {old['version']} at {sha[:8]}")
        require(current_date > date(old["updatedAt"]),
                f"Sine timestamp must exceed {old['version']} ({old['updatedAt']}) at {sha[:8]}")

def verify_history(local, before=None):
    require(git("rev-parse", "--is-shallow-repository").strip() == b"false",
            "Full git history required for Sine publication check")
    head = git("rev-parse", "HEAD").decode().strip()
    paths = package_paths(local)
    for name in paths:
        require(git("show", f"{head}:{name}") == (ROOT / name).read_bytes(),
                f"Working package differs from HEAD: {name}")
    # Find the last actual installed-package change, even after many docs commits.
    boundary = git("log", "--first-parent", "--full-history", "-1", "--format=%H",
                   head, "--", *paths).decode().strip()
    require(bool(boundary), "Cannot identify publication boundary")
    check_publication(boundary, local)
    if before and not re.fullmatch(r"0+", before):
        require(re.fullmatch(r"[0-9a-fA-F]{40}", before) is not None, "Invalid push base SHA")
        lineage = git("rev-list", "--first-parent", head).decode().splitlines()
        require(before in lineage, "Push base is not on preview first-parent ancestry")
        commits = git("rev-list", "--first-parent", "--reverse", f"{before}..{head}").decode().splitlines()
        for sha in commits:
            if package_changed(parent(sha), sha):
                published = manifest_at(sha)
                require(published is not None, "Installed manifest removed")
                if sha != boundary:
                    check_publication(sha, published)
        print("Push range:", "package changed" if package_changed(before, head) else "package unchanged")
    print(f"Publication boundary: {boundary[:12]} ({'publication' if boundary == head else 'unchanged package'})")

def verify_archive(data, paths):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for name in paths:
            matches = [p for p in archive.namelist() if p.split("/", 1)[-1] == name]
            require(len(matches) == 1, f"Missing/ambiguous archive member {name}")
            require(archive.read(matches[0]) == (ROOT / name).read_bytes(), f"Stale archive member {name}")

def remote_head():
    # Query the public ref, not a potentially stale local tracking branch.
    result = git("ls-remote", f"https://github.com/{REPO}.git", f"refs/heads/{BRANCH}").decode().split()
    require(len(result) == 2 and result[1] == f"refs/heads/{BRANCH}", "Cannot resolve public preview HEAD")
    return result[0]

def verify_served(local, paths):
    head = git("rev-parse", "HEAD").decode().strip()
    require(json.loads(fetch(f"{RAW}/{head}/theme.json")) == local, "Immutable Raw manifest mismatch")
    verify_archive(fetch(f"{ZIP}/{head}"), paths)
    print(f"Verified immutable package {head[:12]}")
    if remote_head() != head:
        print("Public preview check superseded by a newer/different HEAD; immutable package verified")
        return
    try:
        require(json.loads(fetch(f"{RAW}/{BRANCH}/theme.json")) == local, "Raw GitHub has not propagated this manifest")
        verify_archive(fetch(f"{ZIP}/refs/heads/{BRANCH}"), paths)
    except Exception:
        if remote_head() != head:
            print("Public preview changed during verification; immutable package verified")
            return
        raise
    if remote_head() != head:
        print("Public preview changed during verification; immutable package verified")
        return
    print("Verified current public Raw and codeload package")

def validate(previous=None, previous_date=None, offline=False, history=False, before=None):
    local = json.loads((ROOT / "theme.json").read_text(encoding="utf-8"))
    require(local["id"] == ID and local["homepage"] == HOMEPAGE, "Sine identity or homepage changed")
    version(local["version"])
    date(local["updatedAt"])
    require(local["version"] == json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"],
            "Manifest and package versions differ")
    paths = package_paths(local)
    for name in paths:
        require((ROOT / name).is_file(), f"Missing {name}")
    if history:
        verify_history(local, before)
    if previous:
        require(version(local["version"]) > version(previous), "Version did not increase")
    if previous_date:
        require(date(local["updatedAt"]) > date(previous_date), "Sine timestamp did not increase")
    if not offline:
        verify_served(local, paths)
    print(f"Verified {local['version']} ({local['updatedAt']})" + (" locally" if offline else ""))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--previous")
    p.add_argument("--previous-date")
    p.add_argument("--offline", action="store_true")
    p.add_argument("--history", action="store_true", help="Check preview publication boundary and historical high-water")
    p.add_argument("--before", help="Previous preview HEAD from push event; check each package-changing commit")
    args = p.parse_args()
    if args.before and not args.history:
        p.error("--before requires --history")
    validate(args.previous, args.previous_date, args.offline, args.history, args.before)
