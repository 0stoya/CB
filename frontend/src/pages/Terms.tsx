import React from "react";

const sectionStyle = { marginBottom: "32px" };
const headingStyle = { fontSize: "20px", color: "#111827", marginBottom: "12px" };
const textStyle = { color: "#475569", margin: 0 };

export default function Terms() {
  return (
    <div style={{ maxWidth: 800, textAlign: "left", paddingBottom: "60px", marginTop: "40px", lineHeight: "1.7" }}>
      <h1 className="hero-title" style={{ fontSize: "36px", marginBottom: "8px" }}>
        Regulamin Serwisu
      </h1>
      <p style={{ color: "#64748B", fontSize: "15px", marginBottom: "40px" }}>
        Ostatnia aktualizacja: Lipiec 2026
      </p>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>1. Postanowienia wstępne</h3>
        <p style={textStyle}>
          Regulamin określa zasady korzystania z Chati, w tym losowego czatu, pokojów publicznych, opcjonalnych kont, listy znajomych i prywatnych wiadomości. Rozpoczęcie korzystania z tych funkcji oznacza akceptację Regulaminu i Polityki Prywatności.
        </p>
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>2. Wymagania wiekowe</h3>
        <p style={textStyle}>
          Serwis jest przeznaczony wyłącznie dla osób pełnoletnich. Korzystając z Chati, oświadczasz, że masz ukończone <strong>18 lat</strong>.
        </p>
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>3. Konta użytkowników</h3>
        <p style={textStyle}>
          Konto jest opcjonalne, ale wymagane do tworzenia trwałej tożsamości, zarządzania pokojami, zapisywania ulubionych, dodawania znajomych i korzystania z wiadomości offline. Użytkownik odpowiada za bezpieczeństwo hasła, prawidłowość adresu e-mail oraz działania wykonywane ze swojego konta. Zabronione jest podszywanie się pod inne osoby i obchodzenie blokad poprzez tworzenie kolejnych kont.
        </p>
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>4. Zasady korzystania i treści zabronione</h3>
        <p style={textStyle}>
          Użytkownik zobowiązuje się korzystać z Serwisu zgodnie z prawem i z poszanowaniem innych osób. Zabronione jest w szczególności:
        </p>
        <ul style={{ color: "#475569", marginTop: "8px", paddingLeft: "20px" }}>
          <li>przesyłanie treści pornograficznych z udziałem osób niepełnoletnich, treści przemocowych lub bezprawnych;</li>
          <li>nękanie, grożenie, szantażowanie, dyskryminowanie lub uporczywe kontaktowanie się po odmowie;</li>
          <li>spam, masowe zaproszenia, automatyczne wiadomości, boty i niezamówione reklamy;</li>
          <li>udostępnianie danych osobowych innych osób bez zgody;</li>
          <li>wykorzystywanie pokojów, znajomych lub wiadomości prywatnych do oszustw i wyłudzania danych.</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>5. Pokoje publiczne</h3>
        <p style={textStyle}>
          Twórca pokoju odpowiada za jego nazwę, temat i sposób moderacji. Administracja może zmienić ustawienia, zarchiwizować lub usunąć pokój naruszający Regulamin. Zwykłe pokoje użytkowników mogą zostać automatycznie usunięte po 48 godzinach bez wiadomości, gdy nikt nie jest w nich połączony. Oficjalne pokoje Chati nie podlegają tej zasadzie.
        </p>
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>6. Znajomi, wiadomości prywatne i blokowanie</h3>
        <p style={textStyle}>
          Zaproszenie do znajomych wymaga akceptacji drugiej osoby. Każdy użytkownik może odrzucić lub anulować zaproszenie, usunąć znajomego, wyłączyć prywatne wiadomości albo zablokować inną osobę. Zablokowanie usuwa możliwość dalszego wysyłania wiadomości w tej relacji. Wiadomości do znajomych są zapisywane, aby umożliwić dostarczenie ich po powrocie osoby offline.
        </p>
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>7. Moderacja, zawieszenia i blokady</h3>
        <p style={textStyle}>
          Administracja może ograniczyć dostęp, zawiesić konto, zamknąć pokój lub nałożyć blokadę adresu IP w przypadku naruszenia Regulaminu, zagrożenia bezpieczeństwa lub prób obejścia zabezpieczeń. Działania mogą być podejmowane automatycznie lub ręcznie na podstawie sygnałów bezpieczeństwa i zgłoszeń.
        </p>
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>8. Odpowiedzialność</h3>
        <p style={textStyle}>
          Chati zapewnia infrastrukturę techniczną do komunikacji i nie zatwierdza treści przed ich wysłaniem. Użytkownik odpowiada za własne wiadomości, nazwy pokojów i publikowane informacje. Serwis jest udostępniany w stanie „takim, jakim jest”, bez gwarancji nieprzerwanego działania, zachowania każdego pokoju lub dostarczenia wiadomości w określonym czasie.
        </p>
      </section>

      <section>
        <h3 style={headingStyle}>9. Bezpieczeństwo własne</h3>
        <p style={textStyle}>
          Nie udostępniaj osobom poznanym w Serwisie haseł, danych bankowych, dokumentów, adresu domowego ani innych wrażliwych informacji. Status znajomego nie stanowi potwierdzenia tożsamości drugiej osoby.
        </p>
      </section>
    </div>
  );
}
