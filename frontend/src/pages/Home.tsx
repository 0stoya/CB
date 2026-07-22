import React from "react";
import type { AccountUser } from "../api/auth";

type Props = {
  account: AccountUser | null | undefined;
  onStart: () => void;
  onRooms: () => void;
  onAccount: () => void;
};

function Arrow() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function ChatIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="30" height="30"><path d="M21 12a8.4 8.4 0 0 1-9 8 9.5 9.5 0 0 1-4-.9L3 21l1.7-4.4A8.2 8.2 0 0 1 3 12a8.4 8.4 0 0 1 9-8 8.4 8.4 0 0 1 9 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 12h.01M12 12h.01M16 12h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>;
}

function RoomsIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="30" height="30"><path d="M4 5h16v12H8l-4 3V5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 9h8M8 13h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}

export default function Home({ account, onStart, onRooms, onAccount }: Props) {
  return (
    <section className="landing-hero">
      <div className="landing-copy">
        <span className="landing-eyebrow">Wybierz sposób rozmowy</span>
        <h1>Porozmawiaj po swojemu.</h1>
        <p>
          Połącz się z losową osobą bez rejestracji albo wejdź do publicznego pokoju i rozmawiaj na wybrany temat.
        </p>
      </div>

      <div className="landing-choice-grid">
        <button className="landing-choice landing-choice-primary" type="button" onClick={onStart}>
          <span className="landing-choice-top"><span className="landing-choice-icon"><ChatIcon/></span><span className="landing-choice-tag">Bez konta</span></span>
          <span className="landing-choice-copy">
            <strong>Losowy czat</strong>
            <span>Natychmiastowe połączenie jeden na jeden z nową osobą.</span>
          </span>
          <span className="landing-choice-action">Rozpocznij rozmowę <Arrow/></span>
        </button>

        <button className="landing-choice landing-choice-secondary" type="button" onClick={onRooms}>
          <span className="landing-choice-top"><span className="landing-choice-icon"><RoomsIcon/></span><span className="landing-choice-tag">Rozmowy grupowe</span></span>
          <span className="landing-choice-copy">
            <strong>Pokoje publiczne</strong>
            <span>Przeglądaj aktywne pokoje i dołącz do interesującej Cię rozmowy.</span>
          </span>
          <span className="landing-choice-action">Zobacz pokoje <Arrow/></span>
        </button>
      </div>

      <div className="landing-account-note">
        {account ? (
          <><span className="landing-account-dot"/><span>Zalogowano jako <strong>@{account.nickname}</strong>. Znajomi i powiadomienia są dostępne w górnym menu.</span></>
        ) : account === undefined ? (
          <span>Sprawdzamy stan konta…</span>
        ) : (
          <><span>Konto jest opcjonalne. Załóż je, aby zachować znajomych, prywatne wiadomości i ulubione pokoje.</span><button type="button" onClick={onAccount}>Utwórz konto</button></>
        )}
      </div>

      <div className="landing-trust-row" aria-label="Najważniejsze informacje">
        <span>Bez opłat</span><i/><span>Bez instalacji</span><i/><span>Konto opcjonalne</span>
      </div>
    </section>
  );
}
