import React, { useState } from "react";

type ContactStatus = "idle" | "loading" | "success" | "error";

export default function Contact() {
  const [category, setCategory] = useState("sugestia");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<ContactStatus>("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setStatus("loading");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), subject: subject.trim(), message: message.trim(), category })
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean };
      if (!response.ok || !data.ok) throw new Error("CONTACT_FAILED");

      setStatus("success");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  const searchingForPerson = category === "szukam";

  return (
    <article className="static-page narrow" aria-labelledby="contact-title">
      <header className="static-page-header">
        <span className="static-page-eyebrow">Kontakt i zgłoszenia</span>
        <h1 id="contact-title">Jak możemy pomóc?</h1>
        <p className="static-page-lead">
          Zgłoś błąd, przekaż pomysł lub opisz problem z działaniem Chati. Nie używaj tego formularza do przesyłania haseł, dokumentów ani innych wrażliwych danych.
        </p>
      </header>

      {status === "success" ? (
        <section className="static-success-card" role="status" aria-live="polite">
          <span className="static-success-icon" aria-hidden="true">✓</span>
          <h2>Wiadomość została wysłana</h2>
          <p>Dziękujemy. Jeżeli podałeś adres e-mail i odpowiedź będzie potrzebna, skontaktujemy się z Tobą.</p>
          <button type="button" className="ds-button" onClick={() => setStatus("idle")}>Wyślij kolejną wiadomość</button>
        </section>
      ) : (
        <section className="static-form-card">
          <form className="static-form" onSubmit={handleSubmit} aria-busy={status === "loading"}>
            <label className="ds-field" htmlFor="contact-category">
              <span>Kategoria</span>
              <select
                id="contact-category"
                className="ds-select"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={status === "loading"}
              >
                <option value="sugestia">Sugestia lub pomysł</option>
                <option value="blad">Błąd lub nadużycie</option>
                <option value="szukam">Przerwana rozmowa</option>
              </select>
            </label>

            <label className="ds-field" htmlFor="contact-email">
              <span>{searchingForPerson ? "Adres e-mail do kontaktu" : "Adres e-mail (opcjonalnie)"}</span>
              <input
                id="contact-email"
                className="ds-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                placeholder={searchingForPerson ? "Podaj adres, jeżeli mamy móc się skontaktować" : "Tylko jeśli oczekujesz odpowiedzi"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={status === "loading"}
                aria-describedby="contact-email-help"
              />
              <small id="contact-email-help">Adres jest widoczny wyłącznie dla administracji obsługującej zgłoszenie.</small>
            </label>

            <label className="ds-field" htmlFor="contact-subject">
              <span>{searchingForPerson ? "Krótki opis rozmowy" : "Temat"}</span>
              <input
                id="contact-subject"
                className="ds-input"
                required
                type="text"
                maxLength={160}
                placeholder={searchingForPerson ? "Np. rozmowa przerwana wczoraj wieczorem" : "Czego dotyczy wiadomość?"}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={status === "loading"}
              />
            </label>

            <label className="ds-field" htmlFor="contact-message">
              <span>{searchingForPerson ? "Szczegóły rozmowy" : "Wiadomość"}</span>
              <textarea
                id="contact-message"
                className="ds-textarea"
                required
                maxLength={4000}
                placeholder={searchingForPerson ? "Opisz przybliżony czas i neutralne szczegóły, które pomogą rozpoznać rozmowę. Nie podawaj cudzych danych osobowych." : "Opisz dokładnie problem lub pomysł…"}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={status === "loading"}
                aria-describedby="contact-message-count"
              />
              <small id="contact-message-count">{message.length}/4000 znaków</small>
            </label>

            {status === "error" && (
              <div className="ds-notice error" role="alert">
                <span aria-hidden="true">!</span>
                <span>Nie udało się wysłać wiadomości. Sprawdź połączenie i spróbuj ponownie.</span>
              </div>
            )}

            <div className="static-form-actions">
              <button
                className="ds-button"
                type="submit"
                disabled={status === "loading" || !subject.trim() || !message.trim()}
              >
                {status === "loading" ? "Wysyłanie…" : "Wyślij wiadomość"}
              </button>
            </div>
          </form>
        </section>
      )}
    </article>
  );
}
