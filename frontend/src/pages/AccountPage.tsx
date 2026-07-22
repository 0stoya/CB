import React, { useEffect, useMemo, useState } from "react";
import { AccountApiError, accountApi } from "../api/auth";
import "./account-page.css";

export type AccountMode = "login" | "register" | "verify" | "forgot" | "reset";

type Props = {
  mode: AccountMode;
  navigate: (path: string) => void;
};

type Notice = { type: "success" | "error"; text: string };

const titles: Record<AccountMode, { eyebrow: string; title: string; intro: string }> = {
  login: {
    eyebrow: "Witaj ponownie",
    title: "Zaloguj się do Chati",
    intro: "Wróć do ulubionych pokojów, znajomych i prywatnych wiadomości."
  },
  register: {
    eyebrow: "Opcjonalne konto",
    title: "Utwórz konto",
    intro: "Zachowaj swoją nazwę, pokoje i rozmowy ze znajomymi. Losowy czat nadal działa bez rejestracji."
  },
  verify: {
    eyebrow: "Bezpieczeństwo konta",
    title: "Potwierdź adres e-mail",
    intro: "Weryfikacja chroni Twoją nazwę użytkownika i dostęp do funkcji społecznościowych."
  },
  forgot: {
    eyebrow: "Odzyskiwanie dostępu",
    title: "Nie pamiętasz hasła?",
    intro: "Podaj adres e-mail. Jeżeli konto istnieje, wyślemy bezpieczny link do zmiany hasła."
  },
  reset: {
    eyebrow: "Nowe dane logowania",
    title: "Ustaw nowe hasło",
    intro: "Po zmianie hasła pozostałe aktywne sesje zostaną wylogowane."
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

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minimum = 1,
  help
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minimum?: number;
  help?: string;
}) {
  const [visible, setVisible] = useState(false);
  const helpId = help ? `${id}-help` : undefined;

  return (
    <label className="account-field" htmlFor={id}>
      <span>{label}</span>
      <span className="account-password-shell">
        <input
          id={id}
          className="ds-input"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={minimum}
          maxLength={128}
          aria-describedby={helpId}
        />
        <button
          type="button"
          className="account-password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={visible ? `Ukryj pole: ${label}` : `Pokaż pole: ${label}`}
        >
          {visible ? "Ukryj" : "Pokaż"}
        </button>
      </span>
      {help && <small id={helpId}>{help}</small>}
    </label>
  );
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
    setPassword("");
    setConfirmPassword("");
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
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
  const passwordMismatch = Boolean(confirmPassword && password !== confirmPassword);
  const submitText = busy
    ? "Proszę czekać…"
    : mode === "login"
      ? "Zaloguj się"
      : mode === "register"
        ? "Utwórz konto"
        : mode === "forgot"
          ? "Wyślij link"
          : mode === "reset"
            ? "Zmień hasło"
            : "Wyślij nowy link";

  return (
    <section className="account-shell" aria-labelledby="account-page-title">
      <div className="account-card">
        <span className="account-eyebrow">{copy.eyebrow}</span>
        <h1 id="account-page-title">{copy.title}</h1>
        <p className="account-intro">{copy.intro}</p>

        {notice && (
          <div
            id="account-form-notice"
            className={`ds-notice ${notice.type}`}
            role={notice.type === "error" ? "alert" : "status"}
            aria-live={notice.type === "error" ? "assertive" : "polite"}
          >
            <span aria-hidden="true">{notice.type === "success" ? "✓" : "!"}</span>
            <span>{notice.text}</span>
          </div>
        )}

        {mode === "verify" && token && !verificationFinished && (
          <div className="ds-notice info account-verifying" role="status" aria-live="polite">
            <span className="account-spinner" aria-hidden="true" />
            <span>Sprawdzamy link weryfikacyjny…</span>
          </div>
        )}

        {showForm && (
          <form className="account-form" onSubmit={submit} aria-busy={busy}>
            {(mode === "login" || mode === "register" || mode === "forgot" || (mode === "verify" && !token)) && (
              <label className="account-field" htmlFor="account-email">
                <span>Adres e-mail</span>
                <input
                  id="account-email"
                  className="ds-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={254}
                />
              </label>
            )}

            {mode === "register" && (
              <label className="account-field" htmlFor="account-nickname">
                <span>Nazwa użytkownika</span>
                <input
                  id="account-nickname"
                  className="ds-input"
                  type="text"
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9_\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+"
                  aria-describedby="account-nickname-help"
                />
                <small id="account-nickname-help">3–24 znaki. Litery, cyfry, _ lub -.</small>
              </label>
            )}

            {(mode === "login" || mode === "register" || mode === "reset") && (
              <PasswordField
                id="account-password"
                label={mode === "reset" ? "Nowe hasło" : "Hasło"}
                value={password}
                onChange={setPassword}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minimum={mode === "login" ? 1 : 10}
                help={mode === "login" ? undefined : "Minimum 10 znaków. Najlepiej użyj unikalnego hasła."}
              />
            )}

            {(mode === "register" || mode === "reset") && (
              <div>
                <PasswordField
                  id="account-confirm-password"
                  label="Powtórz hasło"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  minimum={10}
                  help={passwordMismatch ? "Hasła nie są takie same." : "Wpisz nowe hasło ponownie."}
                />
                {passwordMismatch && <span className="account-inline-error" role="alert">Sprawdź oba pola hasła.</span>}
              </div>
            )}

            <button
              className="ds-button account-submit"
              type="submit"
              disabled={busy || passwordMismatch}
            >
              {submitText}
            </button>
          </form>
        )}

        {mode === "verify" && token && verificationFinished && notice?.type === "success" && (
          <button type="button" className="ds-button account-result-action" onClick={() => navigate("/konto/logowanie")}>
            Przejdź do logowania
          </button>
        )}

        <nav className="account-links" aria-label="Inne opcje konta">
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
        </nav>
      </div>

      <aside className="account-side-note" aria-label="Korzyści konta Chati">
        <span className="account-side-icon" aria-hidden="true">✦</span>
        <strong>Bez konta też możesz rozmawiać</strong>
        <p>Rejestracja jest potrzebna dopiero wtedy, gdy chcesz zachować społecznościowe funkcje Chati.</p>
        <ul>
          <li>stała nazwa użytkownika</li>
          <li>ulubione pokoje i powiadomienia</li>
          <li>znajomi oraz wiadomości offline</li>
          <li>kontrola prywatności i aktywnych sesji</li>
        </ul>
        <button type="button" className="account-random-link" onClick={() => navigate("/chat")}>Przejdź do losowego czatu</button>
      </aside>
    </section>
  );
}
