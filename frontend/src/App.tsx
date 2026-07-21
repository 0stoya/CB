import React, { useEffect, useState } from "react";
import { ChatiLogo } from "./components/Icons";
import { CookieBanner } from "./components/CookieBanner";
import { TermsModal } from "./components/TermsModal";
import NotificationBell from "./components/NotificationBell";
import Home from "./pages/Home";
import ChatPage from "./pages/ChatPage";
import RoomsRoute from "./pages/RoomsRoute";
import FriendsPage from "./pages/FriendsPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import Faq from "./pages/Faq";
import AccountPage, { type AccountMode } from "./pages/AccountPage";
import AccountDashboardPage from "./pages/AccountDashboardPage";
import { accountApi, type AccountUser } from "./api/auth";
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

type ProtectedPath = "/chat" | "/pokoje" | "/znajomi";

function isProtectedAppPath(path: string): path is ProtectedPath {
  return path === "/chat" || path === "/pokoje" || path === "/znajomi";
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [account, setAccount] = useState<AccountUser | null | undefined>(undefined);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingProtectedPath, setPendingProtectedPath] = useState<ProtectedPath>("/chat");
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(() => {
    return localStorage.getItem("terms_accepted") === "1";
  });

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(window.location.pathname);
    trackPageView(window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openProtected = (path: ProtectedPath) => {
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
    void accountApi.me()
      .then((result) => setAccount(result.user))
      .catch(() => setAccount(null));
  }, [currentPath]);

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
    return <RoomsRoute onLeave={() => navigate("/")} navigate={navigate} />;
  }

  if (currentPath === "/znajomi" && hasAcceptedTerms) {
    return <FriendsPage onLeave={() => navigate("/")} navigate={navigate} />;
  }

  if (currentPath === "/konto") {
    return <AccountDashboardPage navigate={navigate} />;
  }

  const accountMode = accountModeForPath(currentPath);
  const smallHeaderButton: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: "999px",
    border: "1px solid #CBD5E1",
    background: "#FFFFFF",
    color: "#334155",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer"
  };

  return (
    <div className="web-layout">
      <header className="web-header">
        <div className="brand-logo-container" onClick={() => navigate("/")}>
          <ChatiLogo size={36} />
          <span className="brand-logo-text">Chati</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" style={smallHeaderButton} onClick={() => openProtected("/pokoje")}># Pokoje</button>
          <button type="button" style={smallHeaderButton} onClick={() => openProtected("/znajomi")}>Znajomi</button>
          {account && <NotificationBell navigate={navigate} />}
          <button
            type="button"
            style={smallHeaderButton}
            onClick={() => navigate(account ? "/konto" : "/konto/logowanie")}
          >
            {account ? `@${account.nickname}` : "Konto"}
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
          <span className="footer-link" onClick={() => openProtected("/znajomi")}>Znajomi i wiadomości</span>
          <span className="footer-link" onClick={() => navigate(account ? "/konto" : "/konto/rejestracja")}>{account ? "Moje konto" : "Utwórz konto"}</span>
          <span className="footer-link" onClick={() => navigate("/faq")}>Jak to działa? (FAQ)</span>
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
