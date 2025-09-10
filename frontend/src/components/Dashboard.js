// frontend/src/components/Dashboard.js
import React from "react";
import "./Dashboard.css";

import logoHero from "../assets/logo_hero.png";
import mockup_laptop from "../assets/sekcja 2_laptop.png";
import chatBubble from "../assets/Chat Bubble.png";
import listenTo from "../assets/Listen to Music.png";
import book from "../assets/Book.png";

function Dashboard({ onNavigateToWorkspace }) {
  return (
    <div className="dashboard-wrapper">
      {" "}
      {/* Nowy kontener dla obu sekcji */}
      {/* ========================================= */}
      {/* SEKCJA 1: HERO SECTION (Zdj. 1)            */}
      {/* ========================================= */}
      <section className="dashboard-hero-section">
        <div className="hero-content">
          <div className="logo-container">
            <img
              src={logoHero} // Użyj zaimportowanej zmiennej
              alt="AI Buddy English Logo"
              className="main-logo"
            />
          </div>

          <button
            className="generate-story-btn-main"
            onClick={onNavigateToWorkspace}
          >
            Generate Story
            <img
              src={chatBubble} // Użyj zaimportowanej zmiennej
              alt="AI Buddy English Logo"
              className="chat-bubble"
            />
          </button>
          <div className="featured-modules-container">
            <h2>Featured Modules</h2>
            <div className="modules-grid">
              <div className="module-card listening">
                <div className="module-icon">
                  <img
                    src={listenTo} // Użyj zaimportowanej zmiennej
                    
                  />
                </div>
                <h3>Listening</h3>
                <p>
                  Improve your comprehension by listening to AI-generated
                  stories.
                </p>
              </div>
              <div className="module-card vocabulary">
                <div className="module-icon"> Aa </div>
                <h3>Vocabulary</h3>
                <p>
                  Build your personal dictionary and practice with smart
                  flashcards.
                </p>
              </div>
              <div className="module-card grammar">
                <div className="module-icon">
                <img
                    src={book} // Użyj zaimportowanej zmiennej
                    
                  />
                </div>
                <h3>Grammar</h3>
                <p>
                  Understand complex grammar structures with AI-powered
                  analysis.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mascot-hero-bottom-right">
          {/* Tu będzie nasza postać Buddy'ego na dole prawej strony */}
          <img
            src="/path/to/mascot.png"
            alt="AI Buddy Mascot"
            style={{ width: "60px", height: "60px" }}
          />
        </div>
      </section>
      {/* ========================================= */}
      {/* SEKCJA 2: FEATURE/CTA SECTION (Zdj. 2)    */}
      {/* ========================================= */}
      <section className="dashboard-feature-section">
        <div className="feature-content-left">
          <h3 className="feature-headline">
            Słuchaj. Zapisuj. <br />
            Ucz się.
          </h3>
          <p className="feature-description">
            Odsłuchuj historie z idealną intonacją. Zmieniaj Lektora. Zapisuj
            nieznane zwroty jednym kliknięciem do swojego osobistego notatnika.
            Utrwalaj wiedzę, kiedy tylko chcesz, dzięki inteligentnym
            ćwiczeniom.
          </p>
          <button
            className="generate-story-btn-feature"
            onClick={onNavigateToWorkspace}
          >
            Generate Story
          </button>
          <div className="social-icons">
            {/* <img src={socialIconFb} alt="Facebook" /> */}
            {/* <img src={socialIconIg} alt="Instagram" /> */}
            <span className="social-icon-placeholder">ⓕ</span>
            <span className="social-icon-placeholder">ⓘ</span>
          </div>
        </div>

        <div className="feature-image-right">
          {/* Obraz laptopa z mockupem */}
          {/* Możesz użyć tła div lub elementu img, w zależności od preferencji */}
          <img
            src={mockup_laptop}
            alt="AI English Buddy App on Laptop"
            className="laptop-mockup-img"
          />
        </div>

        <div className="mascot-feature-bottom-right">
          {/* Tu będzie nasza postać Buddy'ego na dole prawej strony */}
          <img
            src="/path/to/mascot.png"
            alt="AI Buddy Mascot"
            style={{ width: "60px", height: "60px" }}
          />
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
