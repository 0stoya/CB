import React from "react";

export default function Terms() {
  return (
    <article className="static-page" aria-labelledby="terms-title">
      <header className="static-page-header">
        <span className="static-page-eyebrow">Zasady korzystania</span>
        <h1 id="terms-title">Regulamin Chati</h1>
        <p className="static-page-lead">
          Zasady dotyczą losowego czatu, pokojów publicznych, opcjonalnych kont, znajomych i wiadomości prywatnych.
        </p>
        <time className="static-page-updated" dateTime="2026-07">Ostatnia aktualizacja: lipiec 2026</time>
      </header>

      <div className="static-callout">
        Chati jest przeznaczone wyłącznie dla osób, które ukończyły 18 lat. Nie udostępniaj rozmówcom haseł, danych bankowych, dokumentów ani adresu zamieszkania.
      </div>

      <section className="static-section">
        <h2>1. Postanowienia wstępne</h2>
        <p>
          Regulamin określa zasady korzystania z Chati, w tym losowego czatu, pokojów publicznych, opcjonalnych kont, listy znajomych i prywatnych wiadomości. Rozpoczęcie korzystania z tych funkcji oznacza akceptację Regulaminu i Polityki Prywatności.
        </p>
      </section>

      <section className="static-section">
        <h2>2. Wymagania wiekowe</h2>
        <p>
          Serwis jest przeznaczony wyłącznie dla osób pełnoletnich. Korzystając z Chati, oświadczasz, że masz ukończone <strong>18 lat</strong>.
        </p>
      </section>

      <section className="static-section">
        <h2>3. Konta użytkowników</h2>
        <p>
          Konto jest opcjonalne, ale wymagane do tworzenia trwałej tożsamości, zarządzania pokojami, zapisywania ulubionych, dodawania znajomych i korzystania z wiadomości offline. Użytkownik odpowiada za bezpieczeństwo hasła, prawidłowość adresu e-mail oraz działania wykonywane ze swojego konta. Zabronione jest podszywanie się pod inne osoby i obchodzenie blokad poprzez tworzenie kolejnych kont.
        </p>
      </section>

      <section className="static-section">
        <h2>4. Zasady korzystania i treści zabronione</h2>
        <p>Użytkownik zobowiązuje się korzystać z Serwisu zgodnie z prawem i z poszanowaniem innych osób. Zabronione jest w szczególności:</p>
        <ul className="static-list">
          <li>przesyłanie treści pornograficznych z udziałem osób niepełnoletnich, treści przemocowych lub bezprawnych;</li>
          <li>nękanie, grożenie, szantażowanie, dyskryminowanie lub uporczywe kontaktowanie się po odmowie;</li>
          <li>spam, masowe zaproszenia, automatyczne wiadomości, boty i niezamówione reklamy;</li>
          <li>udostępnianie danych osobowych innych osób bez zgody;</li>
          <li>wykorzystywanie pokojów, znajomych lub wiadomości prywatnych do oszustw i wyłudzania danych.</li>
        </ul>
      </section>

      <section className="static-section">
        <h2>5. Pokoje publiczne</h2>
        <p>
          Twórca pokoju odpowiada za jego nazwę, temat i sposób moderacji. Administracja może zmienić ustawienia, zarchiwizować lub usunąć pokój naruszający Regulamin. Zwykłe pokoje użytkowników mogą zostać automatycznie usunięte po 48 godzinach bez wiadomości, gdy nikt nie jest w nich połączony. Oficjalne pokoje Chati nie podlegają tej zasadzie.
        </p>
      </section>

      <section className="static-section">
        <h2>6. Znajomi, wiadomości prywatne i blokowanie</h2>
        <p>
          Zaproszenie do znajomych wymaga akceptacji drugiej osoby. Każdy użytkownik może odrzucić lub anulować zaproszenie, usunąć znajomego, wyłączyć prywatne wiadomości albo zablokować inną osobę. Zablokowanie usuwa możliwość dalszego wysyłania wiadomości w tej relacji. Wiadomości do znajomych są zapisywane, aby umożliwić dostarczenie ich po powrocie osoby offline.
        </p>
      </section>

      <section className="static-section">
        <h2>7. Moderacja, zawieszenia i blokady</h2>
        <p>
          Administracja może ograniczyć dostęp, zawiesić konto, zamknąć pokój lub nałożyć blokadę adresu IP w przypadku naruszenia Regulaminu, zagrożenia bezpieczeństwa lub prób obejścia zabezpieczeń. Działania mogą być podejmowane automatycznie lub ręcznie na podstawie sygnałów bezpieczeństwa i zgłoszeń.
        </p>
      </section>

      <section className="static-section">
        <h2>8. Odpowiedzialność</h2>
        <p>
          Chati zapewnia infrastrukturę techniczną do komunikacji i nie zatwierdza treści przed ich wysłaniem. Użytkownik odpowiada za własne wiadomości, nazwy pokojów i publikowane informacje. Serwis jest udostępniany w stanie „takim, jakim jest”, bez gwarancji nieprzerwanego działania, zachowania każdego pokoju lub dostarczenia wiadomości w określonym czasie.
        </p>
      </section>

      <section className="static-section">
        <h2>9. Bezpieczeństwo własne</h2>
        <p>
          Nie udostępniaj osobom poznanym w Serwisie haseł, danych bankowych, dokumentów, adresu domowego ani innych wrażliwych informacji. Status znajomego nie stanowi potwierdzenia tożsamości drugiej osoby.
        </p>
      </section>
    </article>
  );
}
