import React, { useState } from "react";

export default function Contact() {
  const [category, setCategory] = useState("sugestia");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, message, category }) // dodano category
      });
      
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        setEmail(""); setSubject(""); setMessage("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div style={{ maxWidth: 600, width: "100%", marginTop: "40px", paddingBottom: "40px", textAlign: "left" }}>
      <h1 className="hero-title" style={{ fontSize: "36px" }}>Kontakt / Zgłoszenia</h1>
      <p style={{ color: "#64748B", fontSize: "16px", marginBottom: "32px", lineHeight: "1.6" }}>
        Masz pytania, znalazłeś błąd, a może szukasz kogoś, z kim nagle przerwało Ci czat? Wybierz kategorię poniżej!
      </p>

      {status === "success" ? (
        <div style={{ padding: "24px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "16px", textAlign: "center", color: "#065F46" }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "20px" }}>Wysłano pomyślnie! ✅</h3>
          <p style={{ margin: 0 }}>Dziękujemy za Twoje zgłoszenie.</p>
          <button className="btn-huge" style={{ marginTop: "20px", padding: "10px 24px", fontSize: "14px" }} onClick={() => setStatus("idle")}>
            Wyślij kolejne
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", background: "#FFFFFF", padding: "32px", borderRadius: "16px", border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>Wybierz kategorię *</label>
            <select className="desktop-input" style={{ padding: "12px 16px", cursor: "pointer" }} value={category} onChange={e => setCategory(e.target.value)} disabled={status === "loading"}>
              <option value="sugestia">💡 Sugestia / Pomysł na rozwój</option>
              <option value="blad">🐛 Zgłoś błąd / Nadużycie</option>
              <option value="szukam">🔎 Szukam kogoś (Przerwany czat)</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
              {category === "szukam" ? "Twój e-mail / Kontakt (Widoczny dla admina)" : "Twój e-mail (Opcjonalnie)"}
            </label>
            <input className="desktop-input" style={{ padding: "12px 16px" }} type="email" placeholder={category === "szukam" ? "Zostaw e-mail, jeśli mamy przekazać go szukanej osobie..." : "Tylko jeśli oczekujesz odpowiedzi"} value={email} onChange={e => setEmail(e.target.value)} disabled={status === "loading"} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
              {category === "szukam" ? "Kogo szukasz? (Twój nagłówek) *" : "Temat *"}
            </label>
            <input className="desktop-input" style={{ padding: "12px 16px" }} required type="text" placeholder={category === "szukam" ? "Np. Szukam Asi (24) z Wrocławia z wczoraj!" : "Czego dotyczy wiadomość?"} value={subject} onChange={e => setSubject(e.target.value)} disabled={status === "loading"} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
              {category === "szukam" ? "Opis rozmowy *" : "Wiadomość *"}
            </label>
            <textarea className="desktop-input" style={{ padding: "12px 16px", minHeight: "150px", resize: "vertical", fontFamily: "inherit" }} required placeholder={category === "szukam" ? "Opisz szczegóły, żeby osoba mogła Cię rozpoznać. Kiedy pisaliście? O czym?" : "Opisz dokładnie swój problem lub pomysł..."} value={message} onChange={e => setMessage(e.target.value)} disabled={status === "loading"} />
          </div>

          {status === "error" && (
            <div style={{ color: "#DC2626", fontSize: "14px", fontWeight: 600 }}>Wystąpił błąd podczas wysyłania. Spróbuj ponownie.</div>
          )}

          <button className="btn-huge" style={{ marginTop: "8px", width: "100%" }} type="submit" disabled={status === "loading" || !subject.trim() || !message.trim()}>
            {status === "loading" ? "Wysyłanie..." : "Wyślij wiadomość"}
          </button>
        </form>
      )}
    </div>
  );
}