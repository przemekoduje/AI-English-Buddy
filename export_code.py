import os
import datetime

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
        "package-lock.json", "CALY_KOD_PROJEKTU.md", "export_code.py", 
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
            
    print(f"Pomyślnie wyeksportowano {len(files_to_export)} plików ({total_lines} linii) do pliku: {output_file}")

if __name__ == "__main__":
    export_all_code()
