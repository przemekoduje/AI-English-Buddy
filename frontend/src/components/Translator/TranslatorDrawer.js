import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../../config";
import "./TranslatorDrawer.css";

const TranslatorDrawer = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const debounceTimerRef = useRef(null);

  const handleOpenDrawer = () => setIsOpen(true);
  const handleCloseDrawer = () => setIsOpen(false);

  // Close when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const translateText = async (text) => {
    if (!text.trim()) {
      setTranslatedText("");
      setIsTranslating(false);
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || "",
        },
        body: JSON.stringify({ text: text }),
      });
      const data = await response.json();
      if (data.translation) {
        setTranslatedText(data.translation);
      } else {
        setTranslatedText("Błąd tłumaczenia.");
      }
    } catch (err) {
      console.error("Błąd tłumaczenia:", err);
      setTranslatedText("Błąd połączenia z serwerem.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSourceChange = (e) => {
    const text = e.target.value;
    setSourceText(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      translateText(text);
    }, 800); // 800ms opóźnienia przy pisaniu
  };

  const handleClear = () => {
    setSourceText("");
    setTranslatedText("");
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  return (
    <>
      {/* Przycisk wysuwający z boku, umiejscowiony pod słownikiem */}
      <button 
        className={`translator-drawer-trigger ${isOpen ? "hidden" : ""}`}
        onClick={handleOpenDrawer}
        title="Otwórz podręczny tłumacz"
      >
        <div className="trigger-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M5 8l6 6" />
            <path d="M4 14l6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="M22 22l-5-10-5 10" />
            <path d="M14 18h6" />
          </svg>
        </div>
        <div className="trigger-label">Tłumacz</div>
      </button>

      {/* Główny panel (Drawer) */}
      <div className={`translator-drawer-container ${isOpen ? "open" : ""}`}>
        <div className="translator-drawer-header">
          <h2>Podręczny Tłumacz</h2>
          <button className="translator-drawer-close" onClick={handleCloseDrawer} title="Zamknij panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="translator-drawer-body">
          <div className="translator-box">
            <div className="translator-box-header">
              <span className="lang-label">Auto (EN/PL)</span>
              {sourceText && (
                <button className="clear-btn" onClick={handleClear} title="Wyczyść tekst">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
            <textarea
              className="translator-input"
              placeholder="Wpisz lub wklej tekst do przetłumaczenia..."
              value={sourceText}
              onChange={handleSourceChange}
            />
          </div>

          <div className="translator-divider">
            <div className="translator-divider-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M7 11L12 16L17 11" />
                <path d="M7 13L12 18L17 13" opacity="0.3" />
              </svg>
            </div>
          </div>

          <div className="translator-box output-box">
            <div className="translator-box-header">
              <span className="lang-label">Tłumaczenie</span>
              {isTranslating && <span className="mini-loader">Tłumaczenie...</span>}
            </div>
            <div className="translator-output">
              {translatedText ? (
                <p>{translatedText}</p>
              ) : (
                <p className="placeholder-text">Tłumaczenie pojawi się tutaj.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nakładka przyciemniająca tło (opcjonalna, zależy czy chcemy blokować ekran) */}
      {isOpen && (
        <div className="translator-drawer-overlay" onClick={handleCloseDrawer}></div>
      )}
    </>
  );
};

export default TranslatorDrawer;
