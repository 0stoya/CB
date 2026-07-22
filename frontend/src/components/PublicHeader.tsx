import React, { useEffect, useState } from "react";
import type { AccountUser } from "../api/auth";
import { ChatiLogo } from "./Icons";
import NotificationBell from "./NotificationBell";

type Destination = "chat" | "rooms" | "friends";

type Props = {
  account: AccountUser | null | undefined;
  currentPath: string;
  navigate: (path: string) => void;
  openDestination: (destination: Destination) => void;
};

type IconName = "chat" | "rooms" | "friends" | "account" | "menu" | "close" | "login";

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  const paths: Record<IconName, React.ReactNode> = {
    chat: <><path d="M21 12a8.4 8.4 0 0 1-9 8 9.5 9.5 0 0 1-4-.9L3 21l1.7-4.4A8.2 8.2 0 0 1 3 12a8.4 8.4 0 0 1 9-8 8.4 8.4 0 0 1 9 8Z" {...common}/><path d="M8 12h.01M12 12h.01M16 12h.01" {...common}/></>,
    rooms: <><path d="M4 5h16v12H8l-4 3V5Z" {...common}/><path d="M8 9h8M8 13h5" {...common}/></>,
    friends: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-6A3.5 3.5 0 0 0 3 18.5V20" {...common}/><circle cx="9.5" cy="8" r="3.5" {...common}/><path d="M18 8v6M15 11h6" {...common}/></>,
    account: <><circle cx="12" cy="8" r="4" {...common}/><path d="M4 21a8 8 0 0 1 16 0" {...common}/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" {...common}/></>,
    close: <><path d="m6 6 12 12M18 6 6 18" {...common}/></>,
    login: <><path d="M10 17l5-5-5-5M15 12H3" {...common}/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" {...common}/></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">{paths[name]}</svg>;
}

function isActive(currentPath: string, path: string) {
  return currentPath === path || currentPath.startsWith(`${path}/`);
}

export default function PublicHeader({ account, currentPath, navigate, openDestination }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const go = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  const open = (destination: Destination) => {
    setMobileOpen(false);
    openDestination(destination);
  };

  return (
    <>
      <header className="public-header">
        <div className="public-header-inner">
          <button className="public-brand" type="button" onClick={() => go("/")} aria-label="Chati — strona główna">
            <ChatiLogo size={34}/>
            <span>Chati</span>
          </button>

          <nav className="public-desktop-nav" aria-label="Główna nawigacja">
            <button className={isActive(currentPath, "/pokoje") ? "is-active" : ""} type="button" onClick={() => open("rooms")}>
              <Icon name="rooms"/><span>Pokoje</span>
            </button>
            {account && (
              <button className={isActive(currentPath, "/znajomi") ? "is-active" : ""} type="button" onClick={() => open("friends")}>
                <Icon name="friends"/><span>Znajomi</span>
              </button>
            )}
          </nav>

          <div className="public-header-actions">
            {account && <NotificationBell navigate={navigate}/>} 
            <button
              className={`public-account-button ${account ? "is-signed-in" : ""}`}
              type="button"
              onClick={() => go(account ? "/konto" : "/konto/logowanie")}
              disabled={account === undefined}
            >
              <span className="public-account-avatar" aria-hidden="true">{account ? account.nickname.slice(0, 1).toUpperCase() : <Icon name="account"/>}</span>
              <span className="public-account-copy">
                <small>{account ? "Konto" : "Masz konto?"}</small>
                <strong>{account ? `@${account.nickname}` : account === undefined ? "Ładowanie…" : "Zaloguj się"}</strong>
              </span>
            </button>
            <button className="public-primary-action" type="button" onClick={() => open("chat")}>
              <Icon name="chat"/><span>Losowy czat</span>
            </button>
            <button className="public-menu-button" type="button" onClick={() => setMobileOpen(true)} aria-label="Otwórz menu" aria-expanded={mobileOpen}>
              <Icon name="menu"/>
            </button>
          </div>
        </div>
      </header>

      <button className={`public-menu-backdrop ${mobileOpen ? "is-visible" : ""}`} type="button" aria-label="Zamknij menu" onClick={() => setMobileOpen(false)}/>
      <aside className={`public-mobile-menu ${mobileOpen ? "is-open" : ""}`} aria-label="Menu mobilne" aria-hidden={!mobileOpen}>
        <div className="public-mobile-menu-head">
          <div className="public-brand-static"><ChatiLogo size={32}/><span>Chati</span></div>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Zamknij menu"><Icon name="close"/></button>
        </div>

        {account === undefined ? (
          <div className="public-mobile-account is-loading" aria-live="polite">
            <span className="public-account-avatar"><Icon name="account"/></span>
            <span><small>Sprawdzamy konto</small><strong>Ładowanie…</strong></span>
          </div>
        ) : account ? (
          <button className="public-mobile-account" type="button" onClick={() => go("/konto")}>
            <span className="public-account-avatar">{account.nickname.slice(0, 1).toUpperCase()}</span>
            <span><small>Zalogowano jako</small><strong>@{account.nickname}</strong></span>
            <span aria-hidden>›</span>
          </button>
        ) : (
          <div className="public-mobile-guest">
            <strong>Konto jest opcjonalne</strong>
            <span>Zaloguj się, aby zachować znajomych, wiadomości i ulubione pokoje.</span>
            <div>
              <button type="button" onClick={() => go("/konto/logowanie")}><Icon name="login"/>Zaloguj się</button>
              <button type="button" onClick={() => go("/konto/rejestracja")}>Utwórz konto</button>
            </div>
          </div>
        )}

        <nav className="public-mobile-nav" aria-label="Nawigacja mobilna">
          <button className="is-primary" type="button" onClick={() => open("chat")}><Icon name="chat"/><span><strong>Losowy czat</strong><small>Połącz się od razu</small></span></button>
          <button type="button" onClick={() => open("rooms")}><Icon name="rooms"/><span><strong>Pokoje</strong><small>Rozmowy tematyczne</small></span></button>
          {account && <button type="button" onClick={() => open("friends")}><Icon name="friends"/><span><strong>Znajomi</strong><small>Wiadomości prywatne</small></span></button>}
          {account && <button type="button" onClick={() => go("/konto")}><Icon name="account"/><span><strong>Moje konto</strong><small>Profil, prywatność i sesje</small></span></button>}
        </nav>

        <div className="public-mobile-menu-links">
          <button type="button" onClick={() => go("/faq")}>Jak działa Chati?</button>
          <button type="button" onClick={() => go("/kontakt")}>Kontakt</button>
        </div>
      </aside>
    </>
  );
}
