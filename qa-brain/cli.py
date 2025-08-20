#!/usr/bin/env python3
"""
QA Brain Starter — lightweight CLI
Usage:
  python -m qa_brain.cli doctor
  python -m qa_brain.cli run --pack smoke
  python -m qa_brain.cli run --pack all
  python -m qa_brain.cli run --pack ui
  python -m qa_brain.cli run --pack api
  python -m qa_brain.cli evals --min-score 0.95
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from typing import List, Tuple

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def _which(cmd: str) -> str:
    return shutil.which(cmd) or ""

def _run(cmd: List[str], cwd: str = REPO_ROOT) -> int:
    print(f"➤ {' '.join(cmd)}")
    try:
        return subprocess.call(cmd, cwd=cwd)
    except FileNotFoundError:
        print(f"✖ Command not found: {cmd[0]}")
        return 127

def _ok(label: str):
    print(f"✅ {label}")

def _warn(label: str):
    print(f"⚠️  {label}")

def _fail(label: str):
    print(f"❌ {label}")

def check_file(path: str) -> bool:
    full = os.path.join(REPO_ROOT, path)
    ok = os.path.exists(full)
    print(f"{'✓' if ok else '✗'} {path}")
    return ok

def _doctor() -> int:
    print("🩺 qa-brain doctor — environment sanity checks\n")

    # Required commands
    node = _which("node")
    npm = _which("npm")
    npx = _which("npx")

    if node: _ok(f"node found at {node}")
    else:    _fail("node not found in PATH")

    if npm:  _ok(f"npm found at {npm}")
    else:    _fail("npm not found in PATH")

    if npx:  _ok(f"npx found at {npx}")
    else:    _fail("npx not found in PATH")

    # Playwright runner (installed via NPM)
    has_pw = False
    if npx:
        code = _run(["npx", "playwright", "--version"])
        has_pw = (code == 0)
        if has_pw: _ok("Playwright available via npx")
        else:      _warn("Playwright not detected — run: npx playwright install --with-deps")

    # Project files
    print("\n📁 Required files:")
    files_ok = all([
        check_file("package.json"),
        check_file("playwright.config.ts"),
        check_file("examples/ui/login.spec.ts"),
        check_file("examples/api/healthcheck.spec.ts"),
        check_file(".github/workflows/qa.yml"),
    ])

    # Optional LLM eval harness
    print("\n🧪 Optional LLM eval harness:")
    evals_present = all([
        check_file("llm-evals/golden.yaml"),
        check_file("llm-evals/run_eval.ts"),
    ])
    if evals_present:
        _ok("LLM eval harness present")
    else:
        _warn("LLM eval harness not found (optional)")

    # Env vars (non-fatal)
    print("\n🔐 Environment variables (non-fatal hints):")
    for var in ["APP_BASE_URL", "API_BASE_URL", "E2E_USER", "E2E_PASS"]:
        val = os.environ.get(var)
        if val:
            _ok(f"{var} set")
        else:
            _warn(f"{var} not set")

    # Final verdict
    print("\n— Doctor summary —")
    if not (node and npm and npx and has_pw and files_ok):
        _fail("Environment not fully ready")
        return 1
    _ok("Environment looks good")
    return 0

def _run_pack(pack: str) -> int:
    """
    Thin wrapper around npm scripts / Playwright to keep a single entrypoint.
    """
    if pack == "smoke":
        return _run(["npx", "playwright", "test", "--grep", "@risk:high|@risk:medium"])
    if pack == "all":
        return _run(["npx", "playwright", "test"])
    if pack == "ui":
        return _run(["npx", "playwright", "test", "--project=ui-chromium"])
    if pack == "api":
        return _run(["npx", "playwright", "test", "--project=api"])
    print(f"Unknown pack: {pack}. Use one of: smoke, all, ui, api.")
    return 2

def _evals(min_score: float) -> int:
    # Prefer npm script if available
    pkg_path = os.path.join(REPO_ROOT, "package.json")
    try:
        with open(pkg_path, "r", encoding="utf-8") as f:
            pkg = json.load(f)
    except Exception:
        pkg = {}

    has_script = "scripts" in pkg and "evals" in pkg["scripts"]

    if has_script:
        return _run(["npm", "run", "evals", "--", "--min-score", str(min_score)])

    # Fallback: call ts-node directly (requires dev deps installed)
    if not _which("npx"):
        _fail("npx not found; cannot run TypeScript harness")
        return 127
    return _run(["npx", "ts-node", "llm-evals/run_eval.ts", "--min-score", str(min_score)])

def main(argv: List[str] = None) -> int:
    parser = argparse.ArgumentParser(prog="qa-brain", description="QA Brain Starter CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_doc = sub.add_parser("doctor", help="Run environment sanity checks")
    p_doc.set_defaults(func=lambda _: _doctor())

    p_run = sub.add_parser("run", help="Run test packs via Playwright")
    p_run.add_argument("--pack", choices=["smoke", "all", "ui", "api"], default="smoke",
                       help="Which pack to run (default: smoke)")
    p_run.set_defaults(func=lambda args: _run_pack(args.pack))

    p_eval = sub.add_parser("evals", help="Run LLM eval harness")
    p_eval.add_argument("--min-score", type=float, default=0.95, help="Minimum passing score (default 0.95)")
    p_eval.set_defaults(func=lambda args: _evals(args.min_score))

    args = parser.parse_args(argv)
    return int(args.func(args))

if __name__ == "__main__":
    sys.exit(main())
