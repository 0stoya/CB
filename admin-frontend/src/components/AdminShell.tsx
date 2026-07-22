import React, { useEffect, useMemo, useState } from "react";

export type AdminSection =
  | "overview"
  | "users"
  | "rooms"
  | "reports"
  | "inbox"
  | "security"
  | "operations";

type NavItem = {
  id: AdminSection;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: "home" | "users" | "rooms" | "reports" | "inbox" | "shield" | "pulse";
};

export const adminNavigation: NavItem[] = [
  { id: "overview", label: "Przegląd", eyebrow: "Panel", title: "Przegląd", description: "Najważniejsze wskaźniki i bieżąca aktywność Chati.", icon: "home" },
  { id: "users", label: "Użytkownicy", eyebrow: "Społeczność", title: "Użytkownicy", description: "Wyszukiwanie kont, sesje i działania administracyjne.", icon: "users" },
  { id: "rooms", label: "Pokoje", eyebrow: "Społeczność", title: "Pokoje publiczne", description: "Status, dostęp, limity i cykl życia pokojów.", icon: "rooms" },
  { id: "reports", label: "Zgłoszenia", eyebrow: "Moderacja", title: "Zgłoszenia i moderacja", description: "Kolejka zgłoszeń oraz historia podjętych działań.", icon: "reports" },
  { id: "inbox", label: "Skrzynka", eyebrow: "Wsparcie", title: "Wiadomości użytkowników", description: "Zgłoszenia, sugestie i wiadomości przesłane przez formularz.", icon: "inbox" },
  { id: "security", label: "Bezpieczeństwo", eyebrow: "Ochrona", title: "Bezpieczeństwo", description: "Ręczne blokady IP i aktywne ograniczenia dostępu.", icon: "shield" },
  { id: "operations", label: "Operacje", eyebrow: "System", title: "Operacje i stan usługi", description: "Zdrowie aplikacji, SMTP, retencja i metryki techniczne.", icon: "pulse" }
];

function Icon({ name }: { name: NavItem["icon"] }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<NavItem["icon"], React.ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5" {...common}/><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" {...common}/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...common}/><circle cx="9" cy="7" r="4" {...common}/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...common}/></>,
    rooms: <><path d="M4 4h16v12H7l-3 3V4Z" {...common}/><path d="M8 8h8M8 12h5" {...common}/></>,
    reports: <><path d="M12 3 2.8 19h18.4L12 3Z" {...common}/><path d="M12 9v4M12 17h.01" {...common}/></>,
    inbox: <><path d="M4 4h16v16H4z" {...common}/><path d="M4 14h4l2 3h4l2-3h4" {...common}/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" {...common}/><path d="m9 12 2 2 4-4" {...common}/></>,
    pulse: <><path d="M3 12h4l2.5-6 5 12 2.5-6h4" {...common}/></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">{paths[name]}</svg>;
}

export default function AdminShell({
  active,
  username,
  onSelect,
  onLogout,
  children
}: {
  active: AdminSection;
  username: string | null;
  onSelect: (section: AdminSection) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = useMemo(() => adminNavigation.find((item) => item.id === active) ?? adminNavigation[0], [active]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  function select(section: AdminSection) {
    onSelect(section);
    setMobileOpen(false);
  }

  return (
    <div className="admin-shell">
      <button
        className={`admin-backdrop ${mobileOpen ? "is-visible" : ""}`}
        aria-label="Zamknij menu"
        onClick={() => setMobileOpen(false)}
      />
      <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Nawigacja administratora">
        <div className="admin-brand">
          <div className="admin-brand-mark" aria-hidden="true">C</div>
          <div><strong>Chati</strong><span>Panel administratora</span></div>
        </div>
        <nav className="admin-nav">
          {adminNavigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`admin-nav-item ${active === item.id ? "is-active" : ""}`}
              onClick={() => select(item.id)}
              aria-current={active === item.id ? "page" : undefined}
            >
              <span className="admin-nav-icon"><Icon name={item.icon}/></span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-profile-dot">{(username || "A").slice(0, 1).toUpperCase()}</div>
          <div><strong>{username || "Administrator"}</strong><span>Sesja chroniona</span></div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-copy">
            <button className="admin-mobile-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Otwórz menu">
              <span/><span/><span/>
            </button>
            <div>
              <span className="admin-eyebrow">{current.eyebrow}</span>
              <h1>{current.title}</h1>
              <p>{current.description}</p>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <a className="admin-button admin-button-quiet" href="https://chati.online" target="_blank" rel="noreferrer">Otwórz Chati</a>
            <button className="admin-button admin-button-danger-quiet" type="button" onClick={onLogout}>Wyloguj</button>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
