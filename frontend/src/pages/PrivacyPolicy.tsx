import React from "react";

export default function PrivacyPolicy() {
  return (
    <article className="static-page" aria-labelledby="privacy-title">
      <header className="static-page-header">
        <span className="static-page-eyebrow">Prywatność i dane</span>
        <h1 id="privacy-title">Polityka Prywatności i Cookies</h1>
        <p className="static-page-lead">
          Informacje o danych przetwarzanych podczas korzystania z losowego czatu, pokojów, kont i funkcji społecznościowych Chati.
        </p>
        <time className="static-page-updated" dateTime="2026-07">Ostatnia aktualizacja: lipiec 2026</time>
      </header>

      <div className="static-callout">
        Losowy czat nie wymaga konta. Konto jest opcjonalne i służy do zachowania nazwy użytkownika, pokojów, znajomych, powiadomień i prywatnych wiadomości.
      </div>

      <section className="static-section">
        <h2>1. Postanowienia ogólne</h2>
        <p>Chati pozwala korzystać z losowego czatu i części pokojów bez zakładania konta. Konto jest opcjonalne i służy do zachowania nazwy użytkownika, ulubionych pokojów, znajomych, powiadomień oraz prywatnych wiadomości. Niniejsza polityka opisuje dane przetwarzane zarówno dla gości, jak i zalogowanych użytkowników.</p>
      </section>

      <section className="static-section">
        <h2>2. Dane konta</h2>
        <p>Podczas rejestracji przetwarzamy adres e-mail, nazwę użytkownika oraz bezpieczny skrót hasła. Przechowujemy również datę weryfikacji e-maila, ustawienia prywatności, informacje o aktywnych sesjach oraz ostatniej aktywności. Adres e-mail służy do weryfikacji konta, logowania i odzyskiwania hasła.</p>
      </section>

      <section className="static-section">
        <h2>3. Dane techniczne i bezpieczeństwo</h2>
        <p>Serwer automatycznie przetwarza dane niezbędne do działania i ochrony Serwisu:</p>
        <ul className="static-list">
          <li><strong>Adres IP:</strong> wykorzystywany do ograniczania nadużyć, blokad, ochrony przed spamem i atakami. W bazie sesji przechowujemy jego skrót, a nie surowy adres.</li>
          <li><strong>Dane przeglądarki i urządzenia:</strong> wykorzystywane do obsługi sesji, diagnostyki oraz wyświetlania rozpoznawalnej nazwy urządzenia w panelu konta.</li>
          <li><strong>Przybliżona lokalizacja sesji:</strong> jeżeli dostawca infrastruktury przekazuje kraj lub miasto połączenia, możemy zapisać taki ogólny opis, aby pomóc rozpoznać nieznane logowanie.</li>
          <li><strong>Identyfikator klienta:</strong> lokalny identyfikator pomagający obsługiwać połączenia czatu i ograniczać automatyczne nadużycia.</li>
          <li><strong>Dane diagnostyczne:</strong> zapisujemy identyfikatory żądań oraz zagregowane czasy odpowiedzi i liczby błędów. Metryki te nie zawierają treści wiadomości, adresów IP ani identyfikatorów użytkownika.</li>
        </ul>
      </section>

      <section className="static-section">
        <h2>4. Wiadomości i pokoje</h2>
        <ul className="static-list">
          <li><strong>Losowy czat:</strong> wiadomości są przekazywane w czasie rzeczywistym i nie są zapisywane jako trwała historia rozmowy.</li>
          <li><strong>Pokoje publiczne:</strong> wiadomości są zapisywane, aby uczestnicy mogli zobaczyć historię pokoju. Usunięcie pokoju usuwa również jego wiadomości. Zwykłe pokoje użytkowników są automatycznie usuwane po 48 godzinach bez aktywności, gdy nikt nie jest w nich połączony.</li>
          <li><strong>Wiadomości do znajomych:</strong> są zapisywane w bazie danych, aby można je było dostarczyć osobie offline i wyświetlić na innych urządzeniach po zalogowaniu.</li>
        </ul>
        <p>Prywatne wiadomości nie są szyfrowane metodą end-to-end. Są przetwarzane i przechowywane przez serwer Chati. Nie przesyłaj danych, których nie chcesz ujawniać, i pamiętaj, że odbiorca może wykonać zrzut ekranu.</p>
      </section>

      <section className="static-section">
        <h2>5. Znajomi, obecność i blokowanie</h2>
        <p>Przechowujemy zaproszenia do znajomych, zaakceptowane relacje, blokady, ustawienia widoczności statusu online oraz ostatniej aktywności. Użytkownik może wyłączyć pokazywanie statusu online, ukryć ostatnią aktywność, ograniczyć zaproszenia i wyłączyć prywatne wiadomości.</p>
      </section>

      <section className="static-section">
        <h2>6. Powiadomienia i wzmianki</h2>
        <p>Przechowujemy powiadomienia o zaproszeniach, wiadomościach, wzmiankach w pokojach i wybranych działaniach moderacyjnych. Powiadomienie może zawierać nazwę nadawcy, krótki fragment wiadomości, identyfikator pokoju lub odnośnik do odpowiedniego miejsca w Serwisie. Użytkownik może oznaczać powiadomienia jako przeczytane oraz wyciszyć wzmianki z wybranego pokoju.</p>
      </section>

      <section className="static-section">
        <h2>7. Zgłoszenia i moderacja</h2>
        <p>Gdy zgłaszasz pokój, profil lub wiadomość, zapisujemy powód zgłoszenia oraz chroniony snapshot zgłoszonej treści. Snapshot pozwala moderatorowi ocenić zdarzenie nawet wtedy, gdy oryginalna treść zostanie później zmieniona lub usunięta. W przypadku zgłoszenia prywatnej wiadomości moderator widzi zgłoszoną wiadomość i ograniczone dane rozmowy niezbędne do podjęcia decyzji. Rejestrujemy również działania moderacyjne, takie jak usunięcie wiadomości, wyciszenie, ban, zawieszenie konta albo archiwizacja pokoju.</p>
      </section>

      <section className="static-section">
        <h2>8. Formularz kontaktowy</h2>
        <p>Dane podane w formularzu kontaktowym, takie jak opcjonalny adres e-mail i treść zgłoszenia, są przetwarzane w celu obsługi wiadomości, błędu lub zgłoszenia dotyczącego Serwisu.</p>
      </section>

      <section className="static-section">
        <h2>9. Cookies i pamięć lokalna</h2>
        <p>Używamy bezpiecznych plików cookies do utrzymania sesji konta i panelu administracyjnego. Pamięć lokalna przeglądarki służy między innymi do zapamiętania akceptacji regulaminu, wyboru cookies, tymczasowego pseudonimu gościa oraz stabilnego identyfikatora klienta czatu. Cookies analityczne są opcjonalne i możesz odmówić ich użycia w banerze prywatności.</p>
      </section>

      <section className="static-section">
        <h2>10. Eksport i usunięcie konta</h2>
        <p>Zalogowany użytkownik może pobrać eksport danych konta. Usunięcie konta wymaga potwierdzenia hasłem. Po usunięciu wylogowujemy wszystkie sesje, usuwamy relacje i powiadomienia, archiwizujemy aktywne pokoje społeczności utworzone przez użytkownika oraz anonimizujemy autorstwo publicznych wiadomości. Prywatne wiadomości związane z usuniętym kontem są zastępowane informacją o usunięciu. Rejestry moderacji i zgłoszeń mogą pozostać, gdy jest to potrzebne dla bezpieczeństwa lub obowiązków prawnych.</p>
      </section>

      <section className="static-section">
        <h2>11. Analityka i dostarczanie e-maili</h2>
        <p>Tworzymy własne dzienne zestawienia liczby rejestracji, aktywnych kont, wiadomości, pokojów, zgłoszeń, powiadomień i wyników wysyłki e-maili. Zestawienia są zagregowane i nie zawierają treści rozmów, adresów IP, adresów e-mail ani historii odwiedzanych stron. Aby monitorować wysyłkę wiadomości weryfikacyjnych i resetów hasła, zapisujemy rodzaj wiadomości, wynik dostarczenia, skrót HMAC adresu odbiorcy, identyfikator dostawcy i skrócony komunikat błędu. Nie przechowujemy adresu odbiorcy w rejestrze dostarczenia.</p>
      </section>

      <section className="static-section">
        <h2>12. Okres przechowywania i Twoje prawa</h2>
        <p>Dane przechowujemy przez okres potrzebny do świadczenia funkcji konta, bezpieczeństwa i realizacji obowiązków prawnych. Stare wykorzystane tokeny, wygasłe lub odwołane sesje, przeczytane powiadomienia, techniczne rejestry dostarczania e-maili i zagregowane metryki są okresowo usuwane zgodnie z przyjętymi okresami retencji. Zgłoszenia i historia moderacji mogą być przechowywane dłużej, gdy jest to potrzebne do ochrony użytkowników, zapobiegania nadużyciom lub obsługi roszczeń. Zgodnie z RODO możesz poprosić o dostęp do swoich danych, ich poprawienie, ograniczenie przetwarzania lub usunięcie.</p>
      </section>

      <section className="static-section">
        <h2>13. Kontakt</h2>
        <p>Pytania dotyczące danych osobowych, usunięcia konta lub działania Serwisu możesz przesłać przez zakładkę <strong>Kontakt i zgłoszenia</strong>.</p>
      </section>
    </article>
  );
}
