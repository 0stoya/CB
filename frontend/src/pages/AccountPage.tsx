import React, { useEffect, useMemo, useState } from "react";
import { AccountApiError, accountApi } from "../api/auth";
import "./account-page.css";

export type AccountMode = "login" | "register" | "verify" | "forgot" | "reset";

type Props = {
  mode: AccountMode;
  navigate: (path: string) => void;
};

type Notice = { type: "success" | "error"; text: string };

const titles: Record<AccountMode, { title: string; intro: string }> = {
  login: {
    title: "Zaloguj się",
    intro: "Wróć do ulubionych kanałów, znajomych i prywatnych wiadomości."
  },
  register: {
    title: "Utwórz konto",
    intro: "Konto jest opcjonalne. Losowy czat nadal działa bez rejestracji."
  },
  verify: {
    title: "Potwierdź e-mail",
    intro: "Weryfikacja chroni nazwę użytkownika i funkcje społecznościowe."
  },
  forgot: {
    title: "Nie pamiętasz hasła?",
    intro: "Wyślemy bezpieczny link do ustawienia nowego hasła."
  },
  reset: {
    title: "Ustaw nowe hasło",
    intro: "Po zmianie hasła wylogujemy pozostałe aktywne sesje."
  }
};

function messageFor(error: unknown) {
  if (!(error instanceof AccountApiError)) return "Coś poszło nie tak. Spróbuj ponownie.";

  const messages: Record<string, string> = {
    EMAIL_ALREADY_USED: "Ten adres e-mail jest już używany.",
    NICKNAME_ALREADY_USED: "Ta nazwa użytkownika jest już zajęta.",
    INVALID_CREDENTIALS: "Nieprawidłowy e-mail lub hasło.",
    EMAIL_NOT_VERIFIED: "Najpierw potwierdź swój adres e-mail.",
    ACCOUNT_UNAVAILABLE: "To konto jest obecnie niedostępne.",
    INVALID_OR_EXPIRED_TOKEN: "Ten link jest nieprawidłowy lub już wygasł.",
    ACCOUNT_CREATED_EMAIL_FAILED:
      "Konto zostało utworzone, ale nie udało się wysłać wiadomości. Skorzystaj z ponownej wysyłki.",
    VALIDATION_ERROR: "Sprawdź dane w formularzu.",
    REQUEST_FAILED: "Nie udało się połączyć z serwerem."
  };

  return messages[error.code] || error.message;
}

export default function AccountPage({ mode, navigate }: Props) {
  const copy = titles[mode];
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", [mode]);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [verificationFinished, setVerificationFinished] = useState(false);

  useEffect(() => {
    setNotice(null);
    setVerificationFinished(false);
  }, [mode]);

  useEffect(() => {
    if (mode !== "verify" || !token) return;

    let cancelled = false;
    setBusy(true);
    accountApi
      .verifyEmail(token)
      .then(() => {
        if (cancelled) return;
        setNotice({ type: "success", text: "Adres e-mail został potwierdzony. Możesz się teraz zalogować." });
        setVerificationFinished(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setNotice({ type: "error", text: messageFor(error) });
        setVerificationFinished(true);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);

    if ((mode === "register" || mode === "reset") && password !== confirmPassword) {
      setNotice({ type: "error", text: "Hasła nie są takie same." });
      return;
    }

    setBusy(true);
    try {
      if (mode === "register") {
        await accountApi.register({ email, nickname, password });
        setNotice({
          type: "success",
          text: "Konto utworzone. Sprawdź skrzynkę i kliknij link potwierdzający."
        });
        setPassword("");
        setConfirmPassword("");
      } else if (mode === "login") {
        await accountApi.login(email, password);
        navigate("/");
      } else if (mode === "forgot") {
        await accountApi.forgotPassword(email);
        setNotice({
          type: "success",
          text: "Jeżeli konto istnieje, wysłaliśmy wiadomość z linkiem do zmiany hasła."
        });
      } else if (mode === "reset") {
        if (!token) throw new Error("Brak tokenu resetu hasła.");
        await accountApi.resetPassword(token, password);
        setNotice({ type: "success", text: "Hasło zostało zmienione. Możesz się zalogować." });
        setPassword("");
        setConfirmPassword("");
      } else if (mode === "verify" && !token) {
        await accountApi.resendVerification(email);
        setNotice({
          type: "success",
          text: "Jeżeli konto oczekuje na weryfikację, wysłaliśmy nowy link."
        });
      }
    } catch (error) {
      setNotice({ type: "error", text: messageFor(error) });
    } finally {
      setBusy(false);
    }
  }

  const showForm = mode !== "verify" || !token;

  return (
    <section className="account-shell">
      <div className="account-card">
        <div className="account-eyebrow">Konto Chati</div>
        <h1>{copy.title}</h1>
        <p className="account-intro">{copy.intro}</p>

        {notice && <div className={`account-notice ${notice.type}`}>{notice.text}</div>}
        {mode === "verify" && token && !verificationFinished && (
          <div className="account-verifying">Sprawdzamy link weryfikacyjny…</div>
        )}

        {showForm && (
          <form className="account-form" onSubmit={submit}>
            {(mode === "login" || mode === "register" || mode === "forgot" || (mode === "verify" && !token)) && (
              <label>
                <span>Adres e-mail</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={254}
                />
              </label>
            )}

            {mode === "register" && (
              <label>
                <span>Nazwa użytkownika</span>
                <input
                  type="text"
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9_\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+"
                />
                <small>3–24 znaki. Litery, cyfry, _ lub -.</small>
              </label>
            )}

            {(mode === "login" || mode === "register" || mode === "reset") && (
              <label>
                <span>{mode === "reset" ? "Nowe hasło" : "Hasło"}</span>
                <input
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={mode === "login" ? 1 : 10}
                  maxLength={128}
                />
                {mode !== "login" && <small>Minimum 10 znaków.</small>}
              </label>
            )}

            {(mode === "register" || mode === "reset") && (
              <label>
                <span>Powtórz hasło</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={10}
                  maxLength={128}
                />
              </label>
            )}

            <button className="account-submit" type="submit" disabled={busy}>
              {busy
                ? "Proszę czekać…"
                : mode === "login"
                  ? "Zaloguj się"
                  : mode === "register"
                    ? "Utwórz konto"
                    : mode === "forgot"
                      ? "Wyślij link"
                      : mode === "reset"
                        ? "Zmień hasło"
                        : "Wyślij nowy link"}
            </button>
          </form>
        )}

        <div className="account-links">
          {mode !== "login" && (
            <button type="button" onClick={() => navigate("/konto/logowanie")}>Mam już konto</button>
          )}
          {mode !== "register" && (
            <button type="button" onClick={() => navigate("/konto/rejestracja")}>Utwórz konto</button>
          )}
          {mode === "login" && (
            <button type="button" onClick={() => navigate("/konto/zapomniane-haslo")}>Nie pamiętam hasła</button>
          )}
          {mode === "login" && (
            <button type="button" onClick={() => navigate("/konto/weryfikacja")}>Wyślij ponownie weryfikację</button>
          )}
        </div>
      </div>

      <div className="account-side-note">
        <strong>Bez konta też możesz rozmawiać.</strong>
        <span>Rejestracja odblokuje ulubione kanały, znajomych i wiadomości offline.</span>
      </div>
    </section>
  );
}
