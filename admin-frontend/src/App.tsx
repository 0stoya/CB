import React, { useEffect, useState } from "react";
import { api } from "./api";
import AdminShell, { adminNavigation, type AdminSection } from "./components/AdminShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ReportsPanel from "./pages/ReportsPanel";
import UsersPanel from "./pages/UsersPanel";
import OperationsPanel from "./pages/OperationsPanel";

function sectionFromHash(): AdminSection {
  const value = window.location.hash.replace(/^#\/?/, "") as AdminSection;
  return adminNavigation.some((item) => item.id === value) ? value : "overview";
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [section, setSection] = useState<AdminSection>(sectionFromHash);

  async function check() {
    try {
      const me = await api.me();
      setIsAdmin(me.isAdmin);
      setUsername(me.username);
    } catch {
      setIsAdmin(false);
      setUsername(null);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void check();
  }, []);

  useEffect(() => {
    const syncLocation = () => setSection(sectionFromHash());
    window.addEventListener("hashchange", syncLocation);
    window.addEventListener("popstate", syncLocation);
    return () => {
      window.removeEventListener("hashchange", syncLocation);
      window.removeEventListener("popstate", syncLocation);
    };
  }, []);

  function selectSection(next: AdminSection) {
    setSection(next);
    const nextHash = `#/${next}`;
    if (window.location.hash !== nextHash) window.history.pushState(null, "", nextHash);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      // The local session state still needs to be cleared if the request fails.
    }
    setIsAdmin(false);
    setUsername(null);
  }

  function content() {
    switch (section) {
      case "users": return <UsersPanel />;
      case "rooms": return <Dashboard view="rooms" />;
      case "reports": return <ReportsPanel />;
      case "inbox": return <Dashboard view="inbox" />;
      case "security": return <Dashboard view="security" />;
      case "operations": return <OperationsPanel />;
      default: return <Dashboard view="overview" />;
    }
  }

  if (!ready) {
    return (
      <div className="admin-loading-screen" role="status" aria-live="polite">
        <div className="admin-loading-mark">C</div>
        <div><strong>Chati Admin</strong><span>Ładowanie bezpiecznej sesji…</span></div>
      </div>
    );
  }

  if (!isAdmin) return <Login onLoggedIn={check} />;

  return (
    <AdminShell active={section} username={username} onSelect={selectSection} onLogout={() => void logout()}>
      {content()}
    </AdminShell>
  );
}
