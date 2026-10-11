import React, { useState, useEffect } from "react";
import { API_BASE_URL } from '../../config';
import logoImg from '../../assets/logo.png';
import "./Auth.css";

const Auth = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(() => {
    return localStorage.getItem("buddy_remembered_email") || "";
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem("buddy_remember_me") === "true";
  });
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Derive greeting name from saved name or email
  const savedName = localStorage.getItem("buddy_last_name") || "";

  useEffect(() => {
    setError("");
    setInfoMessage("");
  }, [isRegistering]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    if (isRegistering) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify and try again.");
        return;
      }
      if (!agreeTerms) {
        setError("Please agree to the Terms of Service and Privacy Policy.");
        return;
      }
    }

    setLoading(true);
    const endpoint = isRegistering ? "register" : "login";
    const payload = isRegistering 
      ? { email, password, full_name: fullName }
      : { email, password };

    try {
      const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        if (rememberMe) {
          localStorage.setItem("buddy_remembered_email", email);
          localStorage.setItem("buddy_remember_me", "true");
        } else {
          localStorage.removeItem("buddy_remembered_email");
          localStorage.removeItem("buddy_remember_me");
        }

        if (data.full_name) {
          localStorage.setItem("buddy_last_name", data.full_name);
        } else if (fullName) {
          localStorage.setItem("buddy_last_name", fullName);
        }

        onLoginSuccess(data);
      } else {
        setError(data.error || "Authentication failed. Please check your credentials.");
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("Cannot connect to server. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setInfoMessage("Google sign-in is connecting. In the meantime, please use email and password.");
    setTimeout(() => {
      setInfoMessage("");
    }, 5000);
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address to receive password reset instructions.");
      return;
    }
    setInfoMessage(`Password reset link sent to ${email} (if registered).`);
    setTimeout(() => {
      setInfoMessage("");
    }, 6000);
  };

  // Extract first name for greeting if available
  const greetingName = savedName 
    ? savedName.split(" ")[0] 
    : (email && email.includes("@") ? email.split("@")[0] : "");

  return (
    <div className="auth-page">
      {/* Top Navbar */}
      <header className="auth-topbar">
        <div className="auth-logo-brand">
          <div className="auth-logo-icon">
            <img src={logoImg} alt="Speakling Logo" />
          </div>
          <span className="auth-logo-text">speakling</span>
        </div>

        <div className="auth-topbar-action">
          {isRegistering ? (
            <>
              <span className="auth-topbar-prompt">Already have an account?</span>
              <button 
                type="button" 
                className="auth-btn-ghost-pill"
                onClick={() => { setIsRegistering(false); setError(""); }}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              <span className="auth-topbar-prompt">New to Speakling?</span>
              <button 
                type="button" 
                className="auth-btn-ghost-pill"
                onClick={() => { setIsRegistering(true); setError(""); }}
              >
                Create an account
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Two-Column Stage */}
      <main className="auth-main-grid">
        {/* Left Column: AI Buddy Hero & 3D Voice Orb */}
        <section className="auth-hero-section">
          <div className="auth-hero-badge">
            YOUR AI ENGLISH BUDDY
          </div>

          <h1 className="auth-hero-headline">
            More confidence. One conversation at a time.
          </h1>

          <p className="auth-hero-subhead">
            Speak freely, read curious stories, and make new words part of your everyday life.
            Your English journey starts wherever you are.
          </p>

          {/* 3D Glowing Orb Visualizer with Ripples and Waves */}
          <div className="auth-orb-stage">
            <div className="auth-orb-ripple ring-3"></div>
            <div className="auth-orb-ripple ring-2"></div>
            <div className="auth-orb-ripple ring-1"></div>
            
            <div className="auth-voice-orb">
              <div className="auth-orb-highlight"></div>
              <div className="auth-orb-equalizer">
                <span className="eq-bar bar-1"></span>
                <span className="eq-bar bar-2"></span>
                <span className="eq-bar bar-3"></span>
                <span className="eq-bar bar-4"></span>
                <span className="eq-bar bar-5"></span>
              </div>
            </div>
          </div>

          {/* Partner Testimonial Card */}
          <div className="auth-partner-card">
            <div className="partner-card-header">
              <svg className="partner-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              <span className="partner-card-tag">A patient partner for real practice</span>
            </div>
            <p className="partner-card-quote">
              “You don’t need the perfect words. Just tell me what you think.”
            </p>
            <div className="partner-card-footer">
              Speak at your pace · English + Polski · Personal word bank
            </div>
          </div>
        </section>

        {/* Right Column: Authentication Form Card */}
        <section className="auth-form-section">
          <div className="auth-card">
            <header className="auth-card-header">
              <h2 className="auth-card-title">
                {isRegistering 
                  ? "Start your next chapter." 
                  : (greetingName ? `Welcome back, ${greetingName}.` : "Welcome back.")
                }
              </h2>
              <p className="auth-card-subtitle">
                {isRegistering 
                  ? "Create an account and make English a daily habit." 
                  : "Sign in to pick up where you left off."
                }
              </p>
            </header>

            {/* Informational Message Banner */}
            {infoMessage && (
              <div className="auth-info-banner">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>{infoMessage}</span>
              </div>
            )}

            {/* Google Continue Button */}
            <button 
              type="button" 
              className="auth-google-btn"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="auth-google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Separator */}
            <div className="auth-divider">
              <span className="auth-divider-line"></span>
              <span className="auth-divider-text">or with email</span>
              <span className="auth-divider-line"></span>
            </div>

            {/* Form */}
            <form className="auth-form" onSubmit={handleSubmit}>
              {/* Full Name field (Register only) */}
              {isRegistering && (
                <div className="auth-field-group">
                  <label htmlFor="auth-fullname">Full name</label>
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <input
                      type="text"
                      id="auth-fullname"
                      placeholder="Anna Kowalska"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className="auth-field-group">
                <label htmlFor="auth-email">Email address</label>
                <div className="auth-input-wrapper">
                  <svg className="auth-input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <input
                    type="email"
                    id="auth-email"
                    placeholder="anna.k@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="auth-field-group">
                <label htmlFor="auth-password">Password</label>
                <div className={`auth-input-wrapper ${error ? 'has-error' : ''}`}>
                  <svg className="auth-input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="password"
                    id="auth-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                {isRegistering && (
                  <span className="auth-field-hint">
                    Use 8 or more characters, including a number.
                  </span>
                )}
                {error && (
                  <span className="auth-error-text">
                    {error}
                  </span>
                )}
              </div>

              {/* Confirm Password (Register only) */}
              {isRegistering && (
                <div className="auth-field-group">
                  <label htmlFor="auth-confirm-password">Confirm password</label>
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <input
                      type="password"
                      id="auth-confirm-password"
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Row: Remember Me vs Terms */}
              {!isRegistering ? (
                <div className="auth-options-row">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={loading}
                    />
                    <span className="custom-checkbox"></span>
                    <span className="checkbox-text">Remember me</span>
                  </label>

                  <a 
                    href="#forgot" 
                    className="auth-forgot-link"
                    onClick={handleForgotPassword}
                  >
                    Forgot password?
                  </a>
                </div>
              ) : (
                <div className="auth-terms-row">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      required
                      disabled={loading}
                    />
                    <span className="custom-checkbox"></span>
                    <span className="checkbox-text">
                      I agree to the Terms of Service and Privacy Policy.
                    </span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button 
                type="submit" 
                className="auth-primary-btn" 
                disabled={loading}
              >
                {loading ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <svg className="auth-btn-arrow" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>{isRegistering ? "Create account" : "Sign in"}</span>
                  </>
                )}
              </button>
            </form>

            {/* Bottom Card Note */}
            <footer className="auth-card-footer">
              {isRegistering 
                ? "Your progress belongs to you. Manage your account anytime."
                : "Your stories and vocabulary are ready when you are."
              }
            </footer>
          </div>
        </section>
      </main>

      {/* Global Page Footer */}
      <footer className="auth-page-footer">
        <div className="auth-footer-copyright">
          © 2026 Speakling
        </div>
        <div className="auth-footer-links">
          <button type="button" onClick={() => setInfoMessage("Privacy policy is available in app documentation.")}>Privacy</button>
          <button type="button" onClick={() => setInfoMessage("Terms of service are standard for educational software.")}>Terms</button>
          <button type="button" onClick={() => setInfoMessage("Need help? Reach out to support at contact@przemokoduje.com")}>Help</button>
        </div>
      </footer>
    </div>
  );
};

export default Auth;
