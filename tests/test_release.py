"""Regression tests using temporary real Git histories; no network."""
import contextlib
import importlib.util
import io
import json
import pathlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location("verify_release", pathlib.Path(__file__).resolve().parents[1] / "scripts/verify-release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        self.root_patch = patch.object(release, "ROOT", self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.git("init", "-q")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "user.name", "Release test")
        self.write("chrome.css", "a{}")
        self.write("preferences.json", "[]")
        self.write("layout.uc.mjs", "// initial")
        self.metadata(1)
        self.first = self.commit("initial")

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.root, text=True).strip()

    def write(self, path, data):
        (self.root / path).write_text(data, encoding="utf-8")

    def metadata(self, n, timestamp=None):
        ver = f"0.3.0-preview.{n}"
        self.write("theme.json", json.dumps({"id": release.ID, "homepage": release.HOMEPAGE,
            "version": ver, "updatedAt": timestamp or f"2026-11-{n:02d}T00:00:00Z",
            "style": {"chrome": "chrome.css"}, "preferences": "preferences.json",
            "scripts": {"layout.uc.mjs": {"include": ["chrome://browser/content/browser.xhtml"]}}}))
        self.write("package.json", json.dumps({"version": ver}))

    def commit(self, msg):
        self.git("add", ".")
        self.git("commit", "-qm", msg)
        return self.git("rev-parse", "HEAD")

    def check(self, before=None):
        with contextlib.redirect_stdout(io.StringIO()):
            release.validate(offline=True, history=True, before=before)

    def publish(self, n, content="// updated"):
        self.metadata(n)
        self.write("layout.uc.mjs", content)
        return self.commit("publication")

    def test_initial_and_docs_only_dispatch(self):
        self.check()
        self.write("README.md", "docs")
        self.commit("docs")
        self.check(self.first)
        self.check()
        self.check("0" * 40)

    def test_publication_followed_by_docs_in_multi_commit_push(self):
        self.publish(2)
        self.write("README.md", "docs")
        self.commit("docs")
        self.check(self.first)
        self.check()

    def test_multiple_valid_publications(self):
        self.publish(2)
        self.publish(3, "// third")
        self.check(self.first)

    def test_runtime_change_without_metadata_rejected_even_after_docs(self):
        self.write("chrome.css", "b{}")
        self.commit("unversioned")
        self.write("README.md", "docs")
        self.commit("docs")
        with self.assertRaisesRegex(ValueError, "Version must exceed"):
            self.check()
        with self.assertRaises(ValueError):
            self.check(self.first)

    def test_invalid_intermediate_publication_rejected_on_push(self):
        self.write("chrome.css", "b{}")
        self.commit("unversioned")
        self.publish(2)
        with self.assertRaisesRegex(ValueError, "Version must exceed"):
            self.check(self.first)

    def test_intermediate_manifest_package_mismatch_rejected(self):
        self.metadata(2)
        self.write("package.json", '{"version":"0.3.0-preview.1"}')
        self.commit("mismatched publication")
        self.publish(3)
        with self.assertRaisesRegex(ValueError, "versions differ"):
            self.check(self.first)

    def test_intermediate_missing_installed_file_rejected(self):
        self.metadata(2)
        (self.root / "layout.uc.mjs").unlink()
        self.commit("missing installed file")
        self.publish(3)
        with self.assertRaisesRegex(ValueError, "Missing installed file"):
            self.check(self.first)

    def test_version_high_water_even_after_older_metadata(self):
        self.publish(5)
        self.metadata(2, "2026-11-06T00:00:00Z")
        self.commit("bad rollback")
        self.metadata(3, "2026-11-07T00:00:00Z")
        self.commit("still below high water")
        with self.assertRaisesRegex(ValueError, "Version must exceed"):
            self.check()

    def test_timestamp_high_water(self):
        self.publish(5)
        self.metadata(6, "2026-11-04T00:00:00Z")
        self.commit("old timestamp")
        with self.assertRaisesRegex(ValueError, "timestamp must exceed"):
            self.check()

    def test_rollback_payload_as_new_publication(self):
        self.publish(2)
        self.publish(3, "// initial")
        self.check(self.first)

    def test_pref_and_manifest_changes_are_package_changes(self):
        self.write("preferences.json", '[{"property":"example"}]')
        self.commit("unversioned pref")
        with self.assertRaises(ValueError):
            self.check()

    def test_dirty_installed_file_and_package_version_rejected(self):
        self.write("chrome.css", "dirty")
        with self.assertRaisesRegex(ValueError, "Working package differs"):
            self.check()
        self.git("checkout", "--", "chrome.css")
        self.write("package.json", '{"version":"0.3.0-preview.99"}')
        with self.assertRaisesRegex(ValueError, "versions differ"):
            self.check()

    def test_non_ancestor_push_base_rejected(self):
        with self.assertRaisesRegex(ValueError, "first-parent ancestry"):
            self.check("f" * 40)

    def archive(self, bad=False):
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as z:
            for path in release.package_paths(release.manifest_at(self.first)):
                z.writestr("package/" + path, b"bad" if bad and path == "chrome.css" else (self.root / path).read_bytes())
        return data.getvalue()

    def served(self, heads, bad_branch=False, bad_immutable=False):
        local = release.manifest_at(self.first)
        def fetch(url):
            if url.endswith("theme.json"):
                return json.dumps(local).encode()
            return self.archive(bad_immutable if url.endswith(self.first) else bad_branch)
        with patch.object(release, "remote_head", side_effect=heads), patch.object(release, "fetch", side_effect=fetch):
            with contextlib.redirect_stdout(io.StringIO()) as out:
                release.verify_served(local, release.package_paths(local))
            return out.getvalue()

    def test_current_and_superseded_served_package(self):
        self.assertIn("current public", self.served([self.first, self.first]))
        self.assertIn("superseded", self.served(["new"]))
        self.assertIn("changed during", self.served([self.first, "new"], bad_branch=True))

    def test_real_archive_mismatch_not_hidden(self):
        with self.assertRaisesRegex(ValueError, "Stale archive member"):
            self.served([self.first, self.first], bad_branch=True)
        with self.assertRaisesRegex(ValueError, "Stale archive member"):
            self.served(["new"], bad_immutable=True)

if __name__ == "__main__":
    unittest.main()
