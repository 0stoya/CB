import React from "react";

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 800, textAlign: "left", paddingBottom: "60px", marginTop: "40px", lineHeight: "1.7" }}>
      <h1 className="hero-title" style={{ fontSize: "36px", marginBottom: "8px" }}>Polityka Prywatności i Pliki Cookies</h1>
      <p style={{ color: "#64748B", fontSize: "15px", marginBottom: "40px" }}>
        Ostatnia aktualizacja: Luty 2026
      </p>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>1. Postanowienia ogólne</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Aplikacja Chati ("Serwis") stawia na Twoją prywatność i anonimowość. Nie wymagamy zakładania konta, podawania imienia, nazwiska, adresu e-mail ani numeru telefonu do podstawowego korzystania z czatu. Niniejsza polityka wyjaśnia, jakie dane techniczne musimy gromadzić, aby zapewnić prawidłowe i bezpieczne działanie Serwisu.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>2. Gromadzenie danych technicznych i adresy IP</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Chociaż czat jest anonimowy, nasz serwer automatycznie rejestruje pewne metadane w celu świadczenia usług i ochrony przed nadużyciami. Przetwarzamy:
        </p>
        <ul style={{ color: "#475569", marginTop: "8px", paddingLeft: "20px" }}>
          <li><strong>Adresy IP:</strong> Używane wyłącznie w celach bezpieczeństwa (zapobieganie atakom DDoS) oraz do egzekwowania blokad (banów) dla użytkowników łamiących regulamin (np. spamerów, botów). Adresy IP stanowią uzasadniony interes administratora.</li>
          <li><strong>Dane przeglądarki (User-Agent):</strong> Typ przeglądarki i urządzenia, co pozwala nam dostosować interfejs (wersja mobilna/desktopowa).</li>
        </ul>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>3. Treść wiadomości w czacie</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Wiadomości przesyłane między użytkownikami w pokojach czatu są przetwarzane przez nasze serwery w czasie rzeczywistym w celu ich dostarczenia. <strong>Nie archiwizujemy i nie zapisujemy trwale historii Twoich czatów w bazach danych.</strong> Po zakończeniu sesji (rozłączeniu) wiadomości przepadają bezpowrotnie. Pamiętaj jednak, że Twój rozmówca może wykonać zrzut ekranu, dlatego nigdy nie podawaj wrażliwych danych osobowych.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>4. Formularz Kontaktowy i "Szukam"</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Jeśli zdecydujesz się skorzystać z formularza kontaktowego lub funkcji ogłoszeń "Szukam", podane tam dane (np. opcjonalny adres e-mail, treść wiadomości) trafiają do wyłącznej dyspozycji Administratora. Podanie tych danych jest dobrowolne i służy wyłącznie do obsługi Twojego zgłoszenia.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>5. Pamięć lokalna (Local Storage)</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Serwis wykorzystuje mechanizm pamięci lokalnej przeglądarki (Local Storage), który działa podobnie do plików cookies, ale jest bezpieczniejszy i nie wysyła danych do serwera. Używamy go wyłącznie do:
        </p>
        <ul style={{ color: "#475569", marginTop: "8px", paddingLeft: "20px" }}>
          <li>Zapamiętywania faktu akceptacji regulaminu.</li>
          <li>Zarządzania blokadą wielu kart (zapobieganie otwarciu czatu w kilku oknach przeglądarki jednocześnie).</li>
        </ul>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>6. Analityka Google (Google Analytics 4)</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Korzystamy z narzędzia Google Analytics 4 w celu zbierania w pełni anonimowych statystyk (np. ilość odwiedzin, czas spędzony na stronie), co pozwala nam rozwijać i optymalizować projekt. Usługa ta maskuje adresy IP użytkowników i nie służy do profilowania konkretnych osób (wyłączone funkcje reklamowe i śledzące). Domyślnie aplikacja szanuje ustawienia zgody (Consent Mode).
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>7. Twoje prawa</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Zgodnie z przepisami RODO masz prawo do żądania dostępu do swoich danych, ich usunięcia lub ograniczenia przetwarzania. Ze względu na anonimowy charakter Serwisu (brak kont użytkowników), realizacja niektórych praw może wymagać podania dodatkowych informacji identyfikacyjnych (np. udowodnienia, do kogo należał dany adres IP w określonym czasie).
        </p>
      </section>

      <section>
        <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "12px" }}>8. Kontakt</h3>
        <p style={{ color: "#475569", margin: 0 }}>
          Wszelkie pytania dotyczące przetwarzania danych osobowych oraz działania Serwisu prosimy kierować poprzez zakładkę <strong>Kontakt / Zgłoszenia</strong> w naszej aplikacji.
        </p>
      </section>
    </div>
  );
}