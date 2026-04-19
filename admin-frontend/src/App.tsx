import React, { useEffect, useState } from "react";
import { api } from "./api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  async function check() {
    try {
      const me = await api.me();
      setIsAdmin(me.isAdmin);
    } catch {
      setIsAdmin(false);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    check();
  }, []);

  if (!ready) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", color: "#64748B", fontFamily: "Inter, sans-serif" }}>
        <div>Ładowanie panelu...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Login onLoggedIn={check} />;
  }

  return <Dashboard onLogout={() => setIsAdmin(false)} />;
}