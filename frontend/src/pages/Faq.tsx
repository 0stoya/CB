import React from "react";

const items = [
  {
    question: "Jak działa łączenie w losowym czacie?",
    answer: (
      <p>
        Po wejściu do losowego czatu system szuka jednej wolnej osoby. Gdy ktoś jest dostępny, rozmowa rozpoczyna się automatycznie. Jeśli kolejka jest pusta, pozostajesz w bezpiecznym stanie oczekiwania do momentu pojawienia się kolejnego rozmówcy.
      </p>
    )
  },
  {
    question: "Co dzieje się, gdy rozmówca się rozłączy?",
    answer: (
      <>
        <p>Po zakończeniu rozmowy możesz od razu rozpocząć szukanie nowej osoby.</p>
        <p>Mechanizm krótkiego cooldownu ogranicza ryzyko natychmiastowego ponownego połączenia z tym samym rozmówcą.</p>
      </>
    )
  },
  {
    question: "Czym różnią się pokoje od losowego czatu?",
    answer: (
      <p>
        Losowy czat łączy anonimowo dwie osoby i nie tworzy trwałej historii. Pokoje są publicznymi społecznościami z nazwą, tematem, uczestnikami i historią wiadomości. Konto umożliwia dodawanie pokojów do ulubionych oraz odbieranie wzmianek.
      </p>
    )
  },
  {
    question: "Czy konto jest wymagane?",
    answer: (
      <p>
        Nie. Z losowego czatu i pokojów dostępnych dla gości możesz korzystać bez rejestracji. Konto jest potrzebne do zachowania nazwy użytkownika, dodawania znajomych, prywatnych wiadomości, ulubionych pokojów i ustawień prywatności.
      </p>
    )
  },
  {
    question: "Czy mogę zainstalować Chati na telefonie?",
    answer: (
      <>
        <p>Chati działa jako aplikacja PWA, więc możesz dodać ją do ekranu głównego bez sklepu z aplikacjami.</p>
        <p>Na Androidzie lub komputerze użyj opcji „Zainstaluj aplikację” w menu przeglądarki. Na iPhonie otwórz stronę w Safari, wybierz „Udostępnij”, a następnie „Do ekranu początkowego”.</p>
      </>
    )
  },
  {
    question: "Jak Chati chroni anonimowość?",
    answer: (
      <p>
        Losowy czat nie wymaga adresu e-mail ani numeru telefonu, a jego wiadomości nie są zapisywane jako trwała historia. Dane techniczne potrzebne do bezpieczeństwa są przetwarzane zgodnie z Polityką Prywatności. Konto i prywatne wiadomości działają według innych zasad opisanych w tej polityce.
      </p>
    )
  },
  {
    question: "Co zrobić, gdy spotkam bota lub nadużycie?",
    answer: (
      <p>
        Użyj przycisku zgłoszenia w aktywnej rozmowie lub menu wiadomości w pokoju. Wybierz powód najlepiej opisujący sytuację. W nagłym zagrożeniu nie udostępniaj danych osobowych, zakończ rozmowę i skontaktuj się z odpowiednimi służbami.
      </p>
    )
  }
];

export default function Faq() {
  return (
    <article className="static-page" aria-labelledby="faq-title">
      <header className="static-page-header">
        <span className="static-page-eyebrow">Pomoc i bezpieczeństwo</span>
        <h1 id="faq-title">Jak działa Chati?</h1>
        <p className="static-page-lead">
          Najważniejsze informacje o losowym czacie, pokojach, kontach, prywatności i zgłaszaniu problemów.
        </p>
      </header>

      <div className="faq-list">
        {items.map((item, index) => (
          <details className="faq-item" key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <div className="faq-answer">{item.answer}</div>
          </details>
        ))}
      </div>
    </article>
  );
}
