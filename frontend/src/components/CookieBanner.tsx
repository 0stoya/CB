import React, { useEffect, useState } from "react";

type Props = {
  onNavigate: (path: string) => void;
};

type CookieChoice = "analytics" | "essential" | null;
type ConsentWindow = Window & { gtag?: (...args: unknown[]) => void };

function savedChoice(): CookieChoice {
  try {
    const choice = localStorage.getItem("cookies_choice");
    if (choice === "analytics" || choice === "essential") return choice;
    if (localStorage.getItem("cookies_accepted") === "1") return "analytics";
  } catch {
    // Storage can be unavailable in privacy modes.
  }
  return null;
}

function updateGoogleConsent(choice: Exclude<CookieChoice, null>) {
  const consentWindow = window as ConsentWindow;
  consentWindow.gtag?.("consent", "update", {
    analytics_storage: choice === "analytics" ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });
}

export function CookieBanner({ onNavigate }: Props) {
  const [choice, setChoice] = useState<CookieChoice>(() => savedChoice());

  useEffect(() => {
    if (choice) updateGoogleConsent(choice);
  }, [choice]);

  if (choice) return null;

  function saveChoice(nextChoice: Exclude<CookieChoice, null>) {
    try {
      localStorage.setItem("cookies_choice", nextChoice);
      if (nextChoice === "analytics") localStorage.setItem("cookies_accepted", "1");
      else localStorage.removeItem("cookies_accepted");
    } catch {
      // The choice still applies for the current page even when storage is unavailable.
    }
    updateGoogleConsent(nextChoice);
    setChoice(nextChoice);
  }

  return (
    <section className="cookie-consent" aria-label="Ustawienia plików cookies">
      <span className="cookie-consent__icon" aria-hidden="true">◌</span>
      <div className="cookie-consent__copy">
        <strong>Twoja prywatność</strong>
        <p>
          Niezbędne cookies utrzymują bezpieczną sesję. Analityczne pomagają nam ulepszać Chati i są opcjonalne.{" "}
          <button type="button" className="cookie-consent__link" onClick={() => onNavigate("/polityka-prywatnosci")}>
            Szczegóły w polityce prywatności
          </button>.
        </p>
      </div>
      <div className="cookie-consent__actions">
        <button type="button" className="ds-button secondary" onClick={() => saveChoice("essential")}>
          Tylko niezbędne
        </button>
        <button type="button" className="ds-button" onClick={() => saveChoice("analytics")}>
          Zgadzam się na analityczne
        </button>
      </div>
    </section>
  );
}
