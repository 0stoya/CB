import React, { useState } from "react";
import { api } from "../api";

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.login(username.trim(), password);
      onLoggedIn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zalogować.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-aside" aria-label="Chati Admin">
        <div className="admin-login-brand">
          <div className="admin-brand-mark" aria-hidden="true">C</div>
          <div><strong>Chati</strong><span>Panel administratora</span></div>
        </div>
        <div className="admin-login-copy">
          <h1>Bezpieczne centrum zarządzania Chati.</h1>
          <p>Moderacja społeczności, konta użytkowników, pokoje i stan usługi w jednym uporządkowanym panelu.</p>
        </div>
        <div className="admin-login-security">Dostęp jest dodatkowo ograniczony listą dozwolonych adresów IP w Nginx i backendzie.</div>
      </section>

      <section className="admin-login-main">
        <div className="admin-login-card">
          <span className="admin-eyebrow">Dostęp chroniony</span>
          <h2>Zaloguj się</h2>
          <p>Użyj danych administratora skonfigurowanych dla środowiska produkcyjnego.</p>
          {error && <div className="admin-notice admin-notice-error" role="alert">{error}</div>}
          <form onSubmit={submit} style={{ marginTop: error ? 16 : 0 }}>
            <div className="admin-form-group">
              <label htmlFor="admin-username">Nazwa użytkownika</label>
              <input
                id="admin-username"
                className="admin-field"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="admin"
                autoFocus
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="admin-password">Hasło</label>
              <input
                id="admin-password"
                className="admin-field"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Wprowadź hasło"
              />
            </div>
            <button className="admin-button admin-login-submit" type="submit" disabled={busy || !username.trim() || !password}>
              {busy ? <><span className="admin-spinner"/>Logowanie…</> : "Zaloguj się do panelu"}
            </button>
          </form>
          <div className="admin-login-domain">admin.chati.online</div>
        </div>
      </section>
    </main>
  );
}
