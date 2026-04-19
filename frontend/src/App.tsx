import React, { useState, useEffect } from "react";
import { ChatiLogo } from "./components/Icons";
import { CookieBanner } from "./components/CookieBanner";
import { TermsModal } from "./components/TermsModal";
import Home from "./pages/Home";
import ChatPage from "./pages/ChatPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import Faq from "./pages/Faq";
import { trackPageView } from "./utils/helpers";

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // Weryfikujemy, czy user już kiedyś zaakceptował regulamin (zapis w local storage)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(() => {
    return localStorage.getItem("terms_accepted") === "1";
  });

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
    trackPageView(path);
  };

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    trackPageView(window.location.pathname);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Wymuszenie akceptacji regulaminu przy próbie bezpośredniego wejścia na /chat
  useEffect(() => {
    if (currentPath === "/chat" && !hasAcceptedTerms) {
      navigate("/");
      setShowTermsModal(true);
    }
  }, [currentPath, hasAcceptedTerms]);

  // Tryb aplikacji pełnoekranowej (tylko /chat)
  if (currentPath === "/chat" && hasAcceptedTerms) {
    return <ChatPage onLeave={() => navigate("/")} />;
  }

  // Tryb strony WWW (Landing, Regulaminy itp.)
  return (
    <div className="web-layout">
      {/* HEADER */}
      <header className="web-header">
        <div className="brand-logo-container" onClick={() => navigate("/")}>
          <ChatiLogo size={36} />
          <span className="brand-logo-text">Chati</span>
        </div>
        <button 
          className="btn-huge" 
          style={{ padding: "10px 24px", fontSize: "15px" }} 
          onClick={() => hasAcceptedTerms ? navigate("/chat") : setShowTermsModal(true)}
        >
          Rozpocznij Czat
        </button>
      </header>

      {/* GŁÓWNA ZAWARTOŚĆ STRONY */}
      <main className="web-main">
        {currentPath === "/" && <Home onStart={() => hasAcceptedTerms ? navigate("/chat") : setShowTermsModal(true)} />}
        {currentPath === "/polityka-prywatnosci" && <PrivacyPolicy />}
        {currentPath === "/regulamin" && <Terms />}
        {currentPath === "/kontakt" && <Contact />}
        {currentPath === "/faq" && <Faq />}
      </main>

      {/* FOOTER */}
      <footer className="web-footer">
        <div className="footer-links">
          <span className="footer-link" onClick={() => navigate("/faq")}>Jak to działa? (FAQ)</span>
          <span className="footer-link" onClick={() => navigate("/regulamin")}>Regulamin</span>
          <span className="footer-link" onClick={() => navigate("/polityka-prywatnosci")}>Polityka Prywatności</span>
          <span className="footer-link" onClick={() => navigate("/kontakt")}>Kontakt</span>
        </div>
        <div>&copy; {new Date().getFullYear()} Chati.pl. Wszelkie prawa zastrzeżone.</div>
      </footer>

      {/* WYSKAKUJĄCE OKIENKA */}
      <CookieBanner onNavigate={navigate} />

      {showTermsModal && (
        <TermsModal 
          onAccept={() => { 
            localStorage.setItem("terms_accepted", "1");
            setHasAcceptedTerms(true); 
            setShowTermsModal(false); 
            navigate("/chat"); 
          }} 
          onDecline={() => setShowTermsModal(false)}
          onNavigate={navigate}
        />
      )}
    </div>
  );
}