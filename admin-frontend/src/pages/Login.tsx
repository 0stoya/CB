import React, { useState } from "react";
import { api } from "../api";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";

export default function Login(props: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.login(username.trim(), password);
      props.onLoggedIn();
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="h1">Chati Admin</div>
        <div className="muted">admin.chati.online</div>
      </div>

      <Card title="Login">
        <form onSubmit={submit}>
          <div className="row">
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              style={{ flex: 1, minWidth: 220 }}
            />
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ flex: 1, minWidth: 220 }}
            />
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <Button variant="primary" type="submit" disabled={busy || !username.trim() || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </div>

          {err && <div className="toast">{err}</div>}
          <div className="muted" style={{ marginTop: 10 }}>
            Access is additionally restricted by IP allowlist at Nginx and backend.
          </div>
        </form>
      </Card>
    </div>
  );
}