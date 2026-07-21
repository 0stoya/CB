import React from "react";

const sectionStyle = { marginBottom: "32px" };
const headingStyle = { fontSize: "20px", color: "#111827", marginBottom: "12px" };
const textStyle = { color: "#475569", margin: 0 };

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 800, textAlign: "left", paddingBottom: "60px", marginTop: "40px", lineHeight: "1.7" }}>
      <h1 className="hero-title" style={{ fontSize: "36px", marginBottom: "8px" }}>Polityka Prywatności i Pliki Cookies</h1>
      <p style={{ color: "#64748B", fontSize: "15px", marginBottom: "40px" }}>Ostatnia aktualizacja: Lipiec 2026</p>

      <section style={sectionStyle}><h3 style={headingStyle}>1. Postanowienia ogólne</h3><p style={textStyle}>Chati pozwala korzystać z losowego czatu i części pokojów bez zakładania konta. Konto jest opcjonalne i służy do zachowania nazwy użytkownika, ulubionych pokojów, znajomych, powiadomień oraz prywatnych wiadomości. Niniejsza polityka opisuje dane przetwarzane zarówno dla gości, jak i zalogowanych użytkowników.</p></section>

      <section style={sectionStyle}><h3 style={headingStyle}>2. Dane konta</h3><p style={textStyle}>Podczas rejestracji przetwarzamy adres e-mail, nazwę użytkownika oraz bezpieczny skrót hasła. Przechowujemy również datę weryfikacji e-maila, ustawienia prywatności, informacje o aktywnych sesjach oraz ostatniej aktywności. Adres e-mail służy do weryfikacji konta, logowania i odzyskiwania hasła.</p></section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>3. Dane techniczne i bezpieczeństwo</h3>
        <p style={textStyle}>Serwer automatycznie przetwarza dane niezbędne do działania i ochrony Serwisu:</p>
        <ul style={{ color: "#475569", marginTop: "8px", paddingLeft: "20px" }}>
          <li><strong>Adres IP:</strong> wykorzystywany do ograniczania nadużyć, blokad, ochrony przed spamem i atakami. W bazie sesji przechowujemy jego skrót, a nie surowy adres.</li>
          <li><strong>Dane przeglądarki i urządzenia:</strong> wykorzystywane do obsługi sesji, diagnostyki oraz wyświetlania rozpoznawalnej nazwy urządzenia w panelu konta.</li>
          <li><strong>Przybliżona lokalizacja sesji:</strong> jeżeli dostawca infrastruktury przekazuje kraj lub miasto połączenia, możemy zapisać taki ogólny opis, aby pomóc rozpoznać nieznane logowanie.</li>
          <li><strong>Identyfikator klienta:</strong> lokalny identyfikator pomagający obsługiwać połączenia czatu i ograniczać automatyczne nadużycia.</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>4. Wiadomości i pokoje</h3>
        <ul style={{ color: "#475569", marginTop: 0, paddingLeft: "20px" }}>
          <li><strong>Losowy czat:</strong> wiadomości są przekazywane w czasie rzeczywistym i nie są zapisywane jako trwała historia rozmowy.</li>
          <li><strong>Pokoje publiczne:</strong> wiadomości są zapisywane, aby uczestnicy mogli zobaczyć historię pokoju. Usunięcie pokoju usuwa również jego wiadomości. Zwykłe pokoje użytkowników są automatycznie usuwane po 48 godzinach bez aktywności, gdy nikt nie jest w nich połączony.</li>
          <li><strong>Wiadomości do znajomych:</strong> są zapisywane w bazie danych, aby można je było dostarczyć osobie offline i wyświetlić na innych urządzeniach po zalogowaniu.</li>
        </ul>
        <p style={textStyle}>Prywatne wiadomości nie są szyfrowane metodą end-to-end. Są przetwarzane i przechowywane przez serwer Chati. Nie przesyłaj danych, których nie chcesz ujawniać, i pamiętaj, że odbiorca może wykonać zrzut ekranu.</p>
      </section>

      <section style={sectionStyle}><h3 style={headingStyle}>5. Znajomi, obecność i blokowanie</h3><p style={textStyle}>Przechowujemy zaproszenia do znajomych, zaakceptowane relacje, blokady, ustawienia widoczności statusu online oraz ostatniej aktywności. Użytkownik może wyłączyć pokazywanie statusu online, ukryć ostatnią aktywność, ograniczyć zaproszenia i wyłączyć prywatne wiadomości.</p></section>

      <section style={sectionStyle}><h3 style={headingStyle}>6. Powiadomienia i wzmianki</h3><p style={textStyle}>Przechowujemy powiadomienia o zaproszeniach, wiadomościach, wzmiankach w pokojach i wybranych działaniach moderacyjnych. Powiadomienie może zawierać nazwę nadawcy, krótki fragment wiadomości, identyfikator pokoju lub odnośnik do odpowiedniego miejsca w Serwisie. Użytkownik może oznaczać powiadomienia jako przeczytane oraz wyciszyć wzmianki z wybranego pokoju.</p></section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>7. Zgłoszenia i moderacja</h3>
        <p style={textStyle}>Gdy zgłaszasz pokój, profil lub wiadomość, zapisujemy powód zgłoszenia oraz chroniony snapshot zgłoszonej treści. Snapshot pozwala moderatorowi ocenić zdarzenie nawet wtedy, gdy oryginalna treść zostanie później zmieniona lub usunięta. W przypadku zgłoszenia prywatnej wiadomości moderator widzi zgłoszoną wiadomość i ograniczone dane rozmowy niezbędne do podjęcia decyzji. Rejestrujemy również działania moderacyjne, takie jak usunięcie wiadomości, wyciszenie, ban, zawieszenie konta albo archiwizacja pokoju.</p>
      </section>

      <section style={sectionStyle}><h3 style={headingStyle}>8. Formularz kontaktowy</h3><p style={textStyle}>Dane podane w formularzu kontaktowym, takie jak opcjonalny adres e-mail i treść zgłoszenia, są przetwarzane w celu obsługi wiadomości, błędu lub zgłoszenia dotyczącego Serwisu.</p></section>

      <section style={sectionStyle}><h3 style={headingStyle}>9. Cookies i pamięć lokalna</h3><p style={textStyle}>Używamy bezpiecznych plików cookies do utrzymania sesji konta i panelu administracyjnego. Pamięć lokalna przeglądarki służy między innymi do zapamiętania akceptacji regulaminu, tymczasowego pseudonimu gościa oraz stabilnego identyfikatora klienta czatu.</p></section>

      <section style={sectionStyle}><h3 style={headingStyle}>10. Eksport i usunięcie konta</h3><p style={textStyle}>Zalogowany użytkownik może pobrać eksport danych konta. Usunięcie konta wymaga potwierdzenia hasłem. Po usunięciu wylogowujemy wszystkie sesje, usuwamy relacje i powiadomienia, archiwizujemy aktywne pokoje społeczności utworzone przez użytkownika oraz anonimizujemy autorstwo publicznych wiadomości. Prywatne wiadomości związane z usuniętym kontem są zastępowane informacją o usunięciu. Rejestry moderacji i zgłoszeń mogą pozostać, gdy jest to potrzebne dla bezpieczeństwa lub obowiązków prawnych.</p></section>

      <section style={sectionStyle}><h3 style={headingStyle}>11. Analityka</h3><p style={textStyle}>Możemy korzystać z narzędzi analitycznych do mierzenia odwiedzin i poprawy działania Serwisu. Funkcje analityczne podlegają ustawieniom zgody użytkownika i nie są wykorzystywane do odczytywania treści prywatnych rozmów.</p></section>

      <section style={sectionStyle}><h3 style={headingStyle}>12. Okres przechowywania i Twoje prawa</h3><p style={textStyle}>Dane przechowujemy przez okres potrzebny do świadczenia funkcji konta, bezpieczeństwa i realizacji obowiązków prawnych. Zgłoszenia i historia moderacji mogą być przechowywane dłużej, gdy jest to potrzebne do ochrony użytkowników, zapobiegania nadużyciom lub obsługi roszczeń. Zgodnie z RODO możesz poprosić o dostęp do swoich danych, ich poprawienie, ograniczenie przetwarzania lub usunięcie.</p></section>

      <section><h3 style={headingStyle}>13. Kontakt</h3><p style={textStyle}>Pytania dotyczące danych osobowych, usunięcia konta lub działania Serwisu możesz przesłać przez zakładkę <strong>Kontakt / Zgłoszenia</strong>.</p></section>
    </div>
  );
}
