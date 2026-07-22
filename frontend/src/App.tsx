import React, { useEffect, useState } from "react";
import { CookieBanner } from "./components/CookieBanner";
import { TermsModal } from "./components/TermsModal";
import PublicHeader from "./components/PublicHeader";
import PublicFooter from "./components/PublicFooter";
import Home from "./pages/Home";
import ChatPage from "./pages/ChatPage";
import RoomsRoute from "./pages/RoomsRoute";
import FriendsRoute from "./pages/FriendsRoute";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import Faq from "./pages/Faq";
import NotFound from "./pages/NotFound";
import AccountPage, { type AccountMode } from "./pages/AccountPage";
import AccountDashboardPage from "./pages/AccountDashboardPage";
import { accountApi, type AccountUser } from "./api/auth";
import { applyRouteSeo } from "./seo";
import { trackPageView } from "./utils/helpers";
import "./pages/chat-page-layout-fixes.css";

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
type Destination = "chat" | "rooms" | "friends";

function isProtectedAppPath(path: string): path is ProtectedPath {
  return path === "/chat" || path === "/pokoje" || path === "/znajomi";
}

function destinationPath(destination: Destination): ProtectedPath {
  if (destination === "rooms") return "/pokoje";
  if (destination === "friends") return "/znajomi";
  return "/chat";
}

function acceptedTerms() {
  try {
    return localStorage.getItem("terms_accepted") === "1";
  } catch {
    return false;
  }
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [account, setAccount] = useState<AccountUser | null | undefined>(undefined);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingProtectedPath, setPendingProtectedPath] = useState<ProtectedPath>("/chat");
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(acceptedTerms);

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    const nextPath = window.location.pathname;
    setCurrentPath(nextPath);
    trackPageView(nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => document.getElementById("main-content")?.focus());
  };

  const openProtected = (path: ProtectedPath) => {
    if (hasAcceptedTerms) {
      navigate(path);
      return;
    }
    setPendingProtectedPath(path);
    setShowTermsModal(true);
  };

  const openDestination = (destination: Destination) => openProtected(destinationPath(destination));

  useEffect(() => {
    const onPopState = () => {
      const nextPath = window.location.pathname;
      setCurrentPath(nextPath);
      trackPageView(nextPath);
      window.scrollTo({ top: 0 });
      window.requestAnimationFrame(() => document.getElementById("main-content")?.focus());
    };
    window.addEventListener("popstate", onPopState);
    trackPageView(window.location.pathname);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    applyRouteSeo(currentPath);
  }, [currentPath]);

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
    return <ChatPage onLeave={() => navigate("/")}/>;
  }

  if (currentPath === "/pokoje" && hasAcceptedTerms) {
    return <RoomsRoute onLeave={() => navigate("/")} navigate={navigate}/>;
  }

  if (currentPath === "/znajomi" && hasAcceptedTerms) {
    return <FriendsRoute onLeave={() => navigate("/")} navigate={navigate}/>;
  }

  if (currentPath === "/konto") {
    return <AccountDashboardPage navigate={navigate}/>;
  }

  const accountMode = accountModeForPath(currentPath);
  const knownPublicPath = currentPath === "/"
    || currentPath === "/polityka-prywatnosci"
    || currentPath === "/regulamin"
    || currentPath === "/kontakt"
    || currentPath === "/faq"
    || Boolean(accountMode);

  return (
    <div className="web-layout public-site-layout">
      <a className="skip-link" href="#main-content">Przejdź do treści</a>
      <PublicHeader
        account={account}
        currentPath={currentPath}
        navigate={navigate}
        openDestination={openDestination}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className={`web-main public-main ${currentPath === "/" ? "is-home" : ""}`}
      >
        {currentPath === "/" && (
          <Home
            account={account}
            onStart={() => openDestination("chat")}
            onRooms={() => openDestination("rooms")}
            onAccount={() => navigate("/konto/rejestracja")}
          />
        )}
        {currentPath === "/polityka-prywatnosci" && <PrivacyPolicy/>}
        {currentPath === "/regulamin" && <Terms/>}
        {currentPath === "/kontakt" && <Contact/>}
        {currentPath === "/faq" && <Faq/>}
        {accountMode && <AccountPage mode={accountMode} navigate={navigate}/>}
        {!knownPublicPath && <NotFound navigate={navigate}/>}
      </main>

      <PublicFooter navigate={navigate}/>
      <CookieBanner onNavigate={navigate}/>

      {showTermsModal && (
        <TermsModal
          onAccept={() => {
            try {
              localStorage.setItem("terms_accepted", "1");
            } catch {
              // The acceptance still applies for the current browser tab.
            }
            setHasAcceptedTerms(true);
            setShowTermsModal(false);
            navigate(pendingProtectedPath);
          }}
          onDecline={() => {
            setShowTermsModal(false);
            navigate("/");
          }}
          onNavigate={(path) => {
            setShowTermsModal(false);
            navigate(path);
          }}
        />
      )}
    </div>
  );
}
