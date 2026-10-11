import os
import datetime

def export_paywall_bundle():
    """Tworzy zwięzły, wyspecjalizowany plik KOD_SUBSKRYPCJA_PAYWALL.md mieszczący się w całości w każdym oknie czatu AI."""
    root_dir = os.path.abspath(".")
    output_file = os.path.join(root_dir, "KOD_SUBSKRYPCJA_PAYWALL.md")
    
    app_py_path = os.path.join(root_dir, "backend", "app.py")
    sub_backend_code = ""
    if os.path.exists(app_py_path):
        with open(app_py_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        # Wyodrębniamy kluczowe sekcje z backend/app.py:
        # 1. Definicje planów, Stripe, webhooki, helpery subskrypcji (linie ~1135 - 1685)
        # 2. Blokady paywalla w endpointach (Media Buddy, Mastery Path, Live Token)
        sub_section = "".join(lines[1134:1685])
        
        # Paywall w Media Buddy
        media_guard = "".join(lines[2659:2675])
        
        # Paywall w Mastery Path
        mastery_guard = "".join(lines[4734:4746])
        
        # TTS mode check dla planu Starter
        tts_guard = "".join(lines[5216:5230])
        
        # Live token quota check
        live_token_guard = "".join(lines[6298:6325])
        
        sub_backend_code = f"""# ========================================================
# 1. GŁÓWNY MODUŁ SUBSKRYPCJI, STRIPE, WEBHOOKÓW I LIMITÓW
# (Z pliku backend/app.py: linie 1135-1685)
# ========================================================
{sub_section}

# ========================================================
# 2. BRAMKA PAYWALLA W MODULE MEDIA BUDDY (YouTube)
# (Z pliku backend/app.py: /api/media/transcript)
# ========================================================
{media_guard}
... (dalsza część pobierania napisów)

# ========================================================
# 3. BRAMKA PAYWALLA W MODULE MASTERY PATH (3 kroki)
# (Z pliku backend/app.py: /api/mastery-prepare)
# ========================================================
{mastery_guard}
... (dalsza część przygotowania etapów treningu)

# ========================================================
# 4. WYMUSZENIE DARMOWEGO EDGE TTS DLA PLANU STARTER
# (Z pliku backend/app.py: generate_tts_base64)
# ========================================================
{tts_guard}
...

# ========================================================
# 5. TWARDY LIMIT MINUT DLA GEMINI LIVE ORB (KOD 403)
# (Z pliku backend/app.py: /api/live/token)
# ========================================================
{live_token_guard}
"""

    frontend_files = [
        "frontend/src/components/Paywall/PaywallModal.js",
        "frontend/src/components/Paywall/PaywallModal.css",
        "frontend/src/services/GeminiLiveClient.js",
        "frontend/src/components/TopBar.js",
        "frontend/src/components/Sidebar.js",
        "frontend/src/App.js"
    ]
    
    with open(output_file, "w", encoding="utf-8") as out:
        out.write("# Speakling — Kompletny Moduł Subskrypcji, Paywalla i Limitów AI\n")
        out.write(f"Wygenerowano: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        out.write("> Dedykowany, lekki pakiet kodu dla zewnętrznych modeli AI (ChatGPT, Claude, DeepSeek). Zawiera 100% logiki subskrypcji, Stripe, limitów minut Gemini Live i blokad paywalla bez obcinania.\n\n")
        out.write("## Spis Zawartości Pakietu\n")
        out.write("1. `backend/app.py` — Silnik subskrypcji, plany, Stripe Checkout, Webhooks, Portal, liczniki minut, blokady 403\n")
        for i, fpath in enumerate(frontend_files, 2):
            out.write(f"{i}. `{fpath}`\n")
        out.write("\n---\n\n")
        
        # 1. Backend
        out.write("## 1. Plik: `backend/app.py` (Kluczowe sekcje subskrypcji, Stripe i bramek limitów)\n\n```python\n")
        out.write(sub_backend_code)
        out.write("\n```\n\n---\n\n")
        
        # 2. Frontend files
        for idx, fpath in enumerate(frontend_files, 2):
            full_path = os.path.join(root_dir, fpath)
            lang = "javascript" if fpath.endswith(".js") else ("css" if fpath.endswith(".css") else "text")
            out.write(f"## {idx}. Plik: `{fpath}`\n\n```{lang}\n")
            if os.path.exists(full_path):
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    out.write(f.read())
            else:
                out.write(f"// Plik {fpath} nie został odnaleziony.\n")
            out.write("\n```\n\n---\n\n")
            
    print(f"Pomyślnie wygenerowano wyspecjalizowany plik: {output_file}")


def export_clean_code():
    root_dir = os.path.abspath(".")
    output_file = os.path.join(root_dir, "KOD_PROJEKTU.md")
    
    # Extensions to include
    allowed_extensions = {".py", ".js", ".jsx", ".ts", ".tsx", ".css", ".html"}
    
    # Folders to completely ignore
    ignore_dirs = {
        "node_modules", "venv", ".git", "__pycache__", "dist", "build", 
        ".expo", ".next", "coverage", ".gemini", "brain", "scratch"
    }
    
    # Specific dead, archived, temporary or test files to skip
    ignore_files = {
        "package-lock.json", "CALY_KOD_PROJEKTU.md", "KOD_PROJEKTU.md", "export_code.py", 
        "firebase_service_account.json", "yarn.lock", "mock_db.json",
        "app_old.py", "App copy.js", "App.test.js", "get_logs.py", "get_raw_logs.py",
        "test_live_api.py", "test_openai.py"
    }
    
    files_to_export = []
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Filter directories in-place
        dirnames[:] = [d for d in dirnames if d not in ignore_dirs and not d.startswith(".")]
        
        for filename in filenames:
            if filename in ignore_files or filename.startswith(".") or filename.startswith("test_") or filename.startswith("test-"):
                continue
            ext = os.path.splitext(filename)[1].lower()
            if ext in allowed_extensions:
                full_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(full_path, root_dir)
                
                # Sort by folder priority (backend first, then frontend, then mobile)
                priority = 3
                if rel_path.startswith("backend"):
                    priority = 0
                elif rel_path.startswith("frontend"):
                    priority = 1
                elif rel_path.startswith("mobile"):
                    priority = 2
                files_to_export.append((priority, rel_path, full_path, ext))
                
    files_to_export.sort(key=lambda x: (x[0], x[1]))
    
    with open(output_file, "w", encoding="utf-8") as out:
        out.write(f"# Kod Projektu AI-English-Buddy (Speakling)\n")
        out.write(f"Wygenerowano: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        out.write(f"> Skondensowany eksport aktywnych plików produkcyjnych (bez plików testowych, mocków i kopii archiwalnych).\n\n")
        out.write("## Spis Treści\n")
        for idx, (_, rel_path, _, _) in enumerate(files_to_export, 1):
            anchor = f"plik-{rel_path.lower().replace('/', '').replace('.', '').replace('-', '').replace('_', '')}"
            out.write(f"{idx}. [`{rel_path}`](#{idx}-plik-{rel_path.replace('/', '').replace('.', '')})\n")
        out.write("\n---\n\n")
        
        total_lines = 0
        for idx, (_, rel_path, full_path, ext) in enumerate(files_to_export, 1):
            lang = ext[1:] if ext[1:] else "text"
            if lang in ("js", "jsx"):
                lang = "javascript"
            elif lang in ("ts", "tsx"):
                lang = "typescript"
            elif lang == "py":
                lang = "python"
                
            out.write(f"## {idx}. Plik: `{rel_path}`\n\n")
            out.write(f"```{lang}\n")
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                    lines = content.count("\n") + 1
                    total_lines += lines
                    out.write(content)
                    if not content.endswith("\n"):
                        out.write("\n")
            except Exception as e:
                out.write(f"// Błąd odczytu pliku: {e}\n")
            out.write("```\n\n---\n\n")
            
    print(f"Pomyślnie wygenerowano KOD_PROJEKTU.md ({len(files_to_export)} plików, {total_lines} linii): {output_file}")


def export_all_code():
    root_dir = os.path.abspath(".")
    output_file = os.path.join(root_dir, "CALY_KOD_PROJEKTU.md")
    
    # Extensions to include
    allowed_extensions = {".py", ".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".json"}
    
    # Folders to completely ignore
    ignore_dirs = {
        "node_modules", "venv", ".git", "__pycache__", "dist", "build", 
        ".expo", ".next", "coverage", ".gemini", "brain", "scratch"
    }
    
    # Specific large/binary or generated json files to skip
    ignore_files = {
        "package-lock.json", "CALY_KOD_PROJEKTU.md", "KOD_PROJEKTU.md", "export_code.py", 
        "firebase_service_account.json", "yarn.lock"
    }
    
    files_to_export = []
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Filter directories in-place
        dirnames[:] = [d for d in dirnames if d not in ignore_dirs and not d.startswith(".")]
        
        for filename in filenames:
            if filename in ignore_files or filename.startswith("."):
                continue
            ext = os.path.splitext(filename)[1].lower()
            if ext in allowed_extensions:
                full_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(full_path, root_dir)
                # Sort by folder priority (backend, frontend, mobile)
                priority = 3
                if rel_path.startswith("backend"):
                    priority = 0
                elif rel_path.startswith("frontend"):
                    priority = 1
                elif rel_path.startswith("mobile"):
                    priority = 2
                files_to_export.append((priority, rel_path, full_path, ext))
                
    files_to_export.sort(key=lambda x: (x[0], x[1]))
    
    with open(output_file, "w", encoding="utf-8") as out:
        out.write(f"# Cały Kod Projektu AI-English-Buddy\n")
        out.write(f"Wygenerowano: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        out.write("## Spis Treści\n")
        for idx, (_, rel_path, _, _) in enumerate(files_to_export, 1):
            out.write(f"{idx}. `{rel_path}`\n")
        out.write("\n---\n\n")
        
        total_lines = 0
        for idx, (_, rel_path, full_path, ext) in enumerate(files_to_export, 1):
            lang = ext[1:] if ext[1:] else "text"
            if lang in ("js", "jsx"):
                lang = "javascript"
            elif lang in ("ts", "tsx"):
                lang = "typescript"
            elif lang == "py":
                lang = "python"
                
            out.write(f"## {idx}. Plik: `{rel_path}`\n\n")
            out.write(f"```{lang}\n")
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                    lines = content.count("\n") + 1
                    total_lines += lines
                    out.write(content)
                    if not content.endswith("\n"):
                        out.write("\n")
            except Exception as e:
                out.write(f"// Błąd odczytu pliku: {e}\n")
            out.write("```\n\n---\n\n")
            
    print(f"Pomyślnie wyeksportowano CALY_KOD_PROJEKTU.md ({len(files_to_export)} plików, {total_lines} linii): {output_file}")

if __name__ == "__main__":
    export_paywall_bundle()
    export_clean_code()
    export_all_code()

