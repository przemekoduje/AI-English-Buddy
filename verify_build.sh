#!/bin/bash
# Skrypt weryfikujący gotowość wdrożeniową projektu Speakling (AI-English-Buddy)

set -e # Przerwij wykonywanie w przypadku błędu

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # Brak koloru

echo -e "${GREEN}=== Rozpoczynam weryfikację projektu Speakling ===${NC}"

# 1. Sprawdzenie kluczowych plików konfiguracyjnych backendu
echo "1. Weryfikacja plików backendu..."
if [ -f "backend/Dockerfile" ]; then
    echo -e "  - backend/Dockerfile: ${GREEN}OK${NC}"
else
    echo -e "  - backend/Dockerfile: ${RED}BRAK${NC}" && exit 1
fi

if [ -f "backend/requirements.txt" ]; then
    echo -e "  - backend/requirements.txt: ${GREEN}OK${NC}"
    if grep -q "gunicorn" backend/requirements.txt; then
        echo -e "    - gunicorn w requirements.txt: ${GREEN}OK${NC}"
    else
        echo -e "    - gunicorn w requirements.txt: ${RED}BRAK${NC}" && exit 1
    fi
else
    echo -e "  - backend/requirements.txt: ${RED}BRAK${NC}" && exit 1
fi

# Kompilacja testowa backendu (składnia Pythona)
if [ -d "backend/venv" ]; then
    echo "  - Sprawdzanie składni kodu backend/app.py przy użyciu venv..."
    ./backend/venv/bin/python -m py_compile backend/app.py
    echo -e "  - backend/app.py: ${GREEN}Składnia OK${NC}"
fi

# 2. Sprawdzenie konfiguracji Firebase i routingu
echo "2. Weryfikacja konfiguracji Firebase..."
if [ -f "firebase.json" ]; then
    echo -e "  - firebase.json: ${GREEN}OK${NC}"
    if grep -q '"source": "/api/\*\*"' firebase.json; then
        echo -e "    - Reguły rewrite dla /api/**: ${GREEN}OK${NC}"
    else
        echo -e "    - Reguły rewrite dla /api/**: ${RED}BRAK LUB BŁĄD${NC}" && exit 1
    fi
else
    echo -e "  - firebase.json: ${RED}BRAK${NC}" && exit 1
fi

# 3. Budowanie frontendu React
echo "3. Kompilacja frontendu React..."
if [ -d "frontend" ]; then
    cd frontend
    echo "  - Instalacja zależności npm..."
    npm install --no-audit --no-fund
    echo "  - Budowanie plików statycznych..."
    npm run build
    cd ..
    if [ -d "frontend/build" ] && [ -f "frontend/build/index.html" ]; then
        echo -e "  - Kompilacja frontendu: ${GREEN}SUKCES${NC}"
    else
        echo -e "  - Kompilacja frontendu: ${RED}BŁĄD (brak folderu build lub index.html)${NC}" && exit 1
    fi
else
    echo -e "  - Katalog frontend: ${RED}BRAK${NC}" && exit 1
fi

echo -e "${GREEN}=== Weryfikacja zakończona sukcesem! Projekt jest gotowy do wdrożenia. ===${NC}"
