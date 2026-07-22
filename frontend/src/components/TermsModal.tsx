import React, { useEffect, useRef, useState } from "react";

type Props = {
  onAccept: () => void;
  onDecline: () => void;
  onNavigate: (path: string) => void;
};

export function TermsModal({ onAccept, onDecline, onNavigate }: Props) {
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const checkboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => checkboxRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDecline();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onDecline]);

  function handleAccept() {
    if (!accepted) {
      setError(true);
      checkboxRef.current?.focus();
      return;
    }
    onAccept();
  }

  return (
    <div
      className="consent-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDecline();
      }}
    >
      <section
        ref={dialogRef}
        className="consent-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-dialog-title"
        aria-describedby="terms-dialog-description"
      >
        <button type="button" className="consent-dialog__close" onClick={onDecline} aria-label="Zamknij okno">
          ×
        </button>
        <span className="consent-dialog__icon" aria-hidden="true">18+</span>
        <h2 id="terms-dialog-title">Zanim rozpoczniesz rozmowę</h2>
        <p id="terms-dialog-description" className="consent-dialog__intro">
          Losowy czat i pokoje są przeznaczone wyłącznie dla osób pełnoletnich. Potwierdź wiek i zasady, aby kontynuować.
        </p>

        <label className="consent-check">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={accepted}
            aria-invalid={error && !accepted}
            aria-describedby={error ? "terms-consent-error" : undefined}
            onChange={(event) => {
              setAccepted(event.target.checked);
              if (event.target.checked) setError(false);
            }}
          />
          <span>
            Oświadczam, że mam <strong>ukończone 18 lat</strong> oraz akceptuję{" "}
            <button type="button" className="consent-link" onClick={() => onNavigate("/regulamin")}>Regulamin</button>
            {" "}i{" "}
            <button type="button" className="consent-link" onClick={() => onNavigate("/polityka-prywatnosci")}>Politykę Prywatności</button>
            {" "}Chati.
          </span>
        </label>

        {error && !accepted && (
          <p id="terms-consent-error" className="consent-error" role="alert">
            Zaznacz potwierdzenie wieku i zasad, aby wejść do czatu.
          </p>
        )}

        <div className="consent-actions">
          <button type="button" className="ds-button" onClick={handleAccept}>Potwierdzam i przechodzę dalej</button>
          <button type="button" className="ds-button secondary" onClick={onDecline}>Wróć na stronę główną</button>
        </div>
      </section>
    </div>
  );
}
