import React from "react";

export default function Faq() {
  return (
    <div style={{ maxWidth: 800, textAlign: "left", paddingBottom: "40px", marginTop: "40px" }}>
      <h1 className="hero-title" style={{ fontSize: "36px" }}>Jak to działa? (FAQ)</h1>
      <p style={{ color: "#64748B", fontSize: "16px", marginBottom: "40px", lineHeight: "1.6" }}>
        Dowiedz się, jak działa system Chati i poznaj mechanizmy, które dbają o Twoje bezpieczeństwo oraz komfort rozmowy.
      </p>

      <div style={{ marginBottom: "32px" }}>
        <h3 style={{ marginBottom: "12px", fontSize: "20px", color: "#111827" }}>🚀 Jak działa łączenie w pary?</h3>
        <p style={{ margin: 0, lineHeight: 1.6, color: "#475569" }}>
          Gdy klikniesz "Rozpocznij Czat", nasz system natychmiast szuka innej wolnej osoby w kolejce. Jeśli nikogo nie ma, czekasz ułamek sekundy, aż ktoś nowy wejdzie na stronę. Cały proces jest w 100% losowy.
        </p>
      </div>

      <div style={{ marginBottom: "32px" }}>
        <h3 style={{ marginBottom: "12px", fontSize: "20px", color: "#111827" }}>⏱️ Co się dzieje, gdy ktoś się rozłączy?</h3>
        <p style={{ margin: 0, lineHeight: 1.6, color: "#475569" }}>
          Jeśli Twój rozmówca opuści czat, system natychmiast wrzuci Cię z powrotem do kolejki i znajdzie kogoś nowego. 
          <br /><br />
          <strong>Ważna zasada (System Cooldown):</strong> Aby zapewnić różnorodność rozmów, wbudowaliśmy mechanizm "ochłodzenia". Po rozłączeniu, <strong>nie połączymy Cię ponownie z tą samą osobą przez najbliższe 30 minut</strong>. Dzięki temu masz pewność, że klikając "Nowy", zawsze trafisz na kogoś, z kim jeszcze nie rozmawiałeś.
        </p>
      </div>

      <div style={{ marginBottom: "32px" }}>
        <h3 style={{ marginBottom: "12px", fontSize: "20px", color: "#111827" }}>📱 Czy mogę zainstalować Chati na telefonie?</h3>
        <p style={{ margin: 0, lineHeight: 1.6, color: "#475569" }}>
          Oczywiście! Chati to nowoczesna aplikacja PWA (Progressive Web App). Nie musisz szukać nas w Google Play czy App Store. 
          <br /><br />
          <strong>Na Androidzie / PC:</strong> Kliknij przycisk "Pobierz Aplikację" na stronie głównej lub wybierz opcję "Zainstaluj" z menu przeglądarki Chrome.
          <br />
          <strong>Na iPhone (iOS):</strong> Otwórz stronę w przeglądarce Safari, kliknij ikonę "Udostępnij" na dole ekranu i wybierz opcję <strong>"Do ekranu początkowego"</strong>. Aplikacja pojawi się wśród innych Twoich aplikacji!
        </p>
      </div>

      <div style={{ marginBottom: "32px" }}>
        <h3 style={{ marginBottom: "12px", fontSize: "20px", color: "#111827" }}>🕵️ Czy czat jest w pełni anonimowy?</h3>
        <p style={{ margin: 0, lineHeight: 1.6, color: "#475569" }}>
          Tak. Nie wymagamy zakładania konta, podawania maila ani numeru telefonu. Twoje wiadomości nie są nigdzie trwale zapisywane w bazach danych czatu. Po zamknięciu karty znikają bezpowrotnie. Adresy IP są przetwarzane wyłącznie w tle w celu ochrony przed botami i osobami łamiącymi regulamin.
        </p>
      </div>

      <div style={{ marginBottom: "32px" }}>
        <h3 style={{ marginBottom: "12px", fontSize: "20px", color: "#111827" }}>🚩 Co zrobić, gdy spotkam bota lub spamera?</h3>
        <p style={{ margin: 0, lineHeight: 1.6, color: "#475569" }}>
          Podczas czatu, w prawym górnym rogu znajduje się czerwona ikona flagi. Użyj jej, aby zgłosić użytkownika jako "Bota" lub "Nadużycie". Zgłoszenia zasilają nasz system filtrujący, który w połączeniu z automatycznym wykrywaniem linków, błyskawicznie odcina dostęp szkodliwym użytkownikom.
        </p>
      </div>
    </div>
  );
}