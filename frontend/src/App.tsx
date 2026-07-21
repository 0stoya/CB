import React, { useEffect, useState } from "react";
import { ChatiLogo } from "./components/Icons";
import { CookieBanner } from "./components/CookieBanner";
import { TermsModal } from "./components/TermsModal";
import Home from "./pages/Home";
import ChatPage from "./pages/ChatPage";
import RoomsPage from "./pages/RoomsPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import Faq from "./pages/Faq";
import AccountPage, { type AccountMode } from "./pages/AccountPage";
import { trackPageView } from "./utils/helpers";

function accountModeForPath(path: string): AccountMode | null {
  switch (path) {
    case "/konto/logowanie":
      return "login";
    case "/konto/rejestracja":
      return "register";
    case "/konto/weryfikacja":
      return "verify";
    case "/konto/zapomniane-haslo":
      return "forgot";
    case "/konto/reset-hasla":
      return "reset";
    default:
      return null;
  }
}

function isProtectedAppPath(path: string) {
  return path === "/chat" || path === "/pokoje";
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingProtectedPath, setPendingProtectedPath] = useState("/chat");
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(() => {
    return localStorage.getItem("terms_accepted") === "1";
  });

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(window.location.pathname);
    trackPageView(window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openProtected = (path: "/chat" | "/pokoje") => {
    if (hasAcceptedTerms) {
      navigate(path);
      return;
    }
    setPendingProtectedPath(path);
    setShowTermsModal(true);
  };

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    trackPageView(window.location.pathname);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (isProtectedAppPath(currentPath) && !hasAcceptedTerms) {
      setPendingProtectedPath(currentPath);
      navigate("/");
      setShowTermsModal(true);
    }
  }, [currentPath, hasAcceptedTerms]);

  if (currentPath === "/chat" && hasAcceptedTerms) {
    return <ChatPage onLeave={() => navigate("/")} />;
  }

  if (currentPath === "/pokoje" && hasAcceptedTerms) {
    return <RoomsPage onLeave={() => navigate("/")} navigate={navigate} />;
  }

  const accountMode = accountModeForPath(currentPath);

  return (
    <div className="web-layout">
      <header className="web-header">
        <div className="brand-logo-container" onClick={() => navigate("/")}>
          <ChatiLogo size={36} />
          <span className="brand-logo-text">Chati</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            style={{
              padding: "10px 16px",
              borderRadius: "999px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#334155",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer"
            }}
            onClick={() => openProtected("/pokoje")}
          >
            # Pokoje
          </button>
          <button
            type="button"
            style={{
              padding: "10px 16px",
              borderRadius: "999px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#334155",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer"
            }}
            onClick={() => navigate("/konto/logowanie")}
          >
            Konto
          </button>
          <button
            className="btn-huge"
            style={{ padding: "10px 24px", fontSize: "15px" }}
            onClick={() => openProtected("/chat")}
          >
            Losowy czat
          </button>
        </div>
      </header>

      <main className="web-main">
        {currentPath === "/" && <Home onStart={() => openProtected("/chat")} />}
        {currentPath === "/polityka-prywatnosci" && <PrivacyPolicy />}
        {currentPath === "/regulamin" && <Terms />}
        {currentPath === "/kontakt" && <Contact />}
        {currentPath === "/faq" && <Faq />}
        {accountMode && <AccountPage mode={accountMode} navigate={navigate} />}
      </main>

      <footer className="web-footer">
        <div className="footer-links">
          <span className="footer-link" onClick={() => openProtected("/pokoje")}>Pokoje publiczne</span>
          <span className="footer-link" onClick={() => navigate("/faq")}>Jak to działa? (FAQ)</span>
          <span className="footer-link" onClick={() => navigate("/konto/rejestracja")}>Utwórz konto</span>
          <span className="footer-link" onClick={() => navigate("/regulamin")}>Regulamin</span>
          <span className="footer-link" onClick={() => navigate("/polityka-prywatnosci")}>Polityka Prywatności</span>
          <span className="footer-link" onClick={() => navigate("/kontakt")}>Kontakt</span>
        </div>
        <div>&copy; {new Date().getFullYear()} Chati.pl. Wszelkie prawa zastrzeżone.</div>
      </footer>

      <CookieBanner onNavigate={navigate} />

      {showTermsModal && (
        <TermsModal
          onAccept={() => {
            localStorage.setItem("terms_accepted", "1");
            setHasAcceptedTerms(true);
            setShowTermsModal(false);
            navigate(pendingProtectedPath);
          }}
          onDecline={() => setShowTermsModal(false)}
          onNavigate={navigate}
        />
      )}
    </div>
  );
}
