#!/usr/bin/env python3
"""
Strażnik integralności ekosystemu przemokoduje.com (Speakling + KeepGoals + Portal).
Uruchamiany automatycznie podczas wdrożenia:
1. Synchronizuje repozytorium KeepGoals z GitHub (git pull --ff-only origin main).
2. Sprawdza, czy build KeepGoals (frontend/dist) odpowiada najnowszemu commitowi KeepGoals — jeśli nie, przebudowuje go.
3. Kopiuje aktualny build KeepGoals do frontend/build/keepgoals/.
4. Zapisuje hash commita Speakling w frontend/build/.speakling-commit.
5. Weryfikuje obecność i spójność wszystkich 4 modułów przed publikacją na Firebase Hosting:
   - Portal główny (frontend/build/index.html)
   - Speakling Desktop (frontend/build/speakling.html + static/js/main.*.js)
   - Speakling Mobile (frontend/build/speakling/mobile/index.html)
   - KeepGoals (frontend/build/keepgoals/index.html + keepgoals/assets/*.js)
"""

import glob
import os
import shutil
import subprocess
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BUILD_DIR = os.path.join(ROOT_DIR, "frontend", "build")


def run_cmd(cmd, cwd, check=False):
    try:
        res = subprocess.run(
            cmd,
            cwd=cwd,
            shell=(os.name == "nt"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if check and res.returncode != 0:
            raise RuntimeError(f"Command failed ({cmd}): {res.stderr.strip()}")
        return res.returncode, res.stdout.strip(), res.stderr.strip()
    except Exception as exc:
        if check:
            raise
        return 1, "", str(exc)


def get_git_head(repo_dir):
    code, out, _ = run_cmd(["git", "rev-parse", "HEAD"], cwd=repo_dir)
    return out if code == 0 else ""


def find_keepgoals_dir():
    parent = os.path.dirname(ROOT_DIR)
    for candidate in ("KeepGoals", "keepGoals", "keepgoals"):
        path = os.path.join(parent, candidate)
        if os.path.isdir(os.path.join(path, "frontend")):
            return path
    return None


def sync_and_build_keepgoals():
    kg_dir = find_keepgoals_dir()
    if not kg_dir:
        print("[WARN] Nie znaleziono lokalnego katalogu KeepGoals obok AI-English-Buddy.")
        return

    print(f"[KeepGoals] Synchronizacja repozytorium Git w: {kg_dir} ...")
    run_cmd(["git", "fetch", "origin", "main"], cwd=kg_dir)
    code, out, err = run_cmd(["git", "pull", "--ff-only", "origin", "main"], cwd=kg_dir)
    if code == 0:
        print(f"[KeepGoals] git pull: {out or 'aktualne'}")
    else:
        print(f"[KeepGoals] Uwaga przy git pull (używam stanu lokalnego): {err}")

    kg_head = get_git_head(kg_dir)
    kg_frontend = os.path.join(kg_dir, "frontend")
    kg_dist = os.path.join(kg_frontend, "dist")
    kg_index = os.path.join(kg_dist, "index.html")
    stamp_file = os.path.join(kg_dist, ".keepgoals-commit")

    built_commit = ""
    if os.path.isfile(stamp_file):
        with open(stamp_file, "r", encoding="utf-8") as f:
            built_commit = f.read().strip()

    needs_build = (not os.path.isfile(kg_index)) or (kg_head and built_commit != kg_head)
    if needs_build:
        print(f"[KeepGoals] Budowanie najnowszego frontendu KeepGoals (commit {kg_head[:7] if kg_head else 'local'})...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        code, out, err = run_cmd([npm_cmd, "run", "build"], cwd=kg_frontend)
        if code != 0:
            print(f"[ERROR] Błąd budowania KeepGoals:\n{err}\n{out}", file=sys.stderr)
            sys.exit(1)
        if kg_head and os.path.isdir(kg_dist):
            with open(stamp_file, "w", encoding="utf-8") as f:
                f.write(kg_head)
    else:
        print(f"[KeepGoals] Build frontend/dist jest aktualny (commit {kg_head[:7]}).")

    target_kg = os.path.join(BUILD_DIR, "keepgoals")
    if os.path.isdir(target_kg):
        shutil.rmtree(target_kg)
    shutil.copytree(kg_dist, target_kg)
    print(f"[KeepGoals] Skopiowano {kg_dist} -> {target_kg}")


def record_speakling_commit():
    sp_head = get_git_head(ROOT_DIR)
    if sp_head and os.path.isdir(BUILD_DIR):
        with open(os.path.join(BUILD_DIR, ".speakling-commit"), "w", encoding="utf-8") as f:
            f.write(sp_head)


def verify_bundle_integrity():
    print("=== Weryfikacja integralności pakietu produkcyjnego przemokoduje.com ===")
    errors = []

    portal_index = os.path.join(BUILD_DIR, "index.html")
    if not os.path.isfile(portal_index):
        errors.append("Brak pliku głównego portalu: frontend/build/index.html")

    speakling_html = os.path.join(BUILD_DIR, "speakling.html")
    speakling_js = glob.glob(os.path.join(BUILD_DIR, "static", "js", "main.*.js"))
    if not os.path.isfile(speakling_html) or not speakling_js:
        errors.append("Brak zbudowanej aplikacji Speakling Desktop (speakling.html / static/js/main.*.js)")

    mobile_html = os.path.join(BUILD_DIR, "speakling", "mobile", "index.html")
    if not os.path.isfile(mobile_html):
        errors.append("Brak zbudowanej aplikacji Speakling Mobile (speakling/mobile/index.html)")

    kg_html = os.path.join(BUILD_DIR, "keepgoals", "index.html")
    kg_js = glob.glob(os.path.join(BUILD_DIR, "keepgoals", "assets", "*.js"))
    if not os.path.isfile(kg_html) or not kg_js:
        errors.append("Brak zbudowanej aplikacji KeepGoals (keepgoals/index.html / keepgoals/assets/*.js)")

    if errors:
        print("\n[BLOKADA WDROŻENIA] Wykryto naruszenie integralności pakietu:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    print(f"[OK] Portal główny:        {portal_index}")
    print(f"[OK] Speakling Desktop:    {os.path.basename(speakling_js[0])}")
    print(f"[OK] Speakling Mobile:     {mobile_html}")
    print(f"[OK] KeepGoals:            {os.path.basename(kg_js[0])}")
    print("=== Integralność wszystkich aplikacji potwierdzona! ===")


if __name__ == "__main__":
    sync_and_build_keepgoals()
    record_speakling_commit()
    verify_bundle_integrity()
