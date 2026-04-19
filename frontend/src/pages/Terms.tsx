import React from "react";

export default function Terms() {
  return (
    <div style={{ maxWidth: 800, textAlign: "left", paddingBottom: "60px", marginTop: "40px", lineHeight: "1.7" }}>
      <h1 className="hero-title" style={{ fontSize: "36px", marginBottom: "8px" }}>Regulamin Serwisu</h1>
      <p style={{ color: "#64748B", fontSize: "15px", marginBottom: "40px" }}>
        Ostatnia aktualizacja: Luty 2026
      </p>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>1. Postanowienia wstępne</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Niniejszy regulamin określa zasady korzystania z anonimowego czatu internetowego Chati ("Serwis"). Rozpoczęcie korzystania z Serwisu (poprzez kliknięcie przycisku "Rozpocznij Czat") jest równoznaczne z pełną, bezwarunkową akceptacją niniejszego Regulaminu.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>2. Wymagania wiekowe</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Serwis przeznaczony jest wyłącznie dla osób pełnoletnich. Korzystając z aplikacji, stanowczo oświadczasz, że <strong>masz ukończone 18 lat</strong>. Osobom niepełnoletnim kategorycznie zabrania się korzystania z Serwisu.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>3. Zasady korzystania i treści zabronione</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Użytkownik zobowiązuje się do korzystania z czatu w sposób kulturalny, z poszanowaniem innych osób oraz zgodnie z obowiązującym polskim prawem. Bezwzględnie zabronione jest:
        </p>
        <ul style={{ color: "#475569", marginTop: "8px", paddingLeft: "20px" }}>
          <li>Przesyłanie treści pornograficznych, pedofilskich lub propagujących przemoc.</li>
          <li>Wysyłanie spamu, linków reklamowych, ofert komercyjnych (np. sprzedaż materiałów, zaproszenia na inne portale) oraz używanie automatycznych skryptów i botów.</li>
          <li>Obrażanie, nękanie, grożenie, szantażowanie lub dyskryminowanie innych rozmówców.</li>
          <li>Udostępnianie danych osobowych osób trzecich bez ich wyraźnej zgody (tzw. doxxing).</li>
        </ul>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>4. Moderacja i Blokady (Bany)</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Administracja Serwisu zastrzega sobie prawo do natychmiastowego, tymczasowego lub permanentnego zablokowania dostępu do czatu (nałożenia bana na adres IP) każdemu użytkownikowi, który łamie postanowienia niniejszego regulaminu. Blokady mogą być nakładane automatycznie (np. przez filtr antyspamowy) lub ręcznie na podstawie zgłoszeń innych użytkowników. Decyzje o blokadzie są ostateczne.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>5. Odpowiedzialność</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Czat działa w czasie rzeczywistym, a wiadomości nie są w żaden sposób moderowane przed ich dostarczeniem do odbiorcy. Serwis Chati pełni jedynie rolę pośrednika technicznego i <strong>nie ponosi żadnej odpowiedzialności za treści generowane przez użytkowników</strong>. Każdy użytkownik ponosi wyłączną odpowiedzialność prawną za wysyłane przez siebie teksty i materiały. Serwis jest udostępniany w stanie "takim, jakim jest" (as is), bez gwarancji nieprzerwanego czy bezbłędnego działania.
        </p>
      </section>

      <section>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>6. Bezpieczeństwo własne</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Ponieważ czat jest w 100% anonimowy, nigdy nie masz pewności, kto znajduje się po drugiej stronie ekranu. Zachęcamy do skrajnej ostrożności. Zdecydowanie odradzamy podawanie swojego prawdziwego imienia, nazwiska, adresu domowego, numeru telefonu czy danych konta bankowego osobom nowo poznanym w Serwisie.
        </p>
      </section>
    </div>
  );
}