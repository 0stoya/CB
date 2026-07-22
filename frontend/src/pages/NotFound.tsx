import React from "react";

type Props = {
  navigate: (path: string) => void;
};

export default function NotFound({ navigate }: Props) {
  return (
    <section className="not-found-card" aria-labelledby="not-found-title">
      <span className="not-found-code">BŁĄD 404</span>
      <h1 id="not-found-title">Nie znaleźliśmy tej strony</h1>
      <p>
        Adres mógł się zmienić albo link jest nieaktualny. Możesz wrócić na stronę główną lub przejść bezpośrednio do pokojów.
      </p>
      <div className="not-found-actions">
        <button type="button" className="ds-button" onClick={() => navigate("/")}>Strona główna</button>
        <button type="button" className="ds-button secondary" onClick={() => navigate("/pokoje")}>Otwórz pokoje</button>
      </div>
    </section>
  );
}
