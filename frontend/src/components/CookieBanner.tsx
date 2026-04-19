import React, { useState, useEffect } from "react";

type Props = {
  onNavigate: (path: string) => void;
};

export function CookieBanner({ onNavigate }: Props) {
  const [showCookies, setShowCookies] = useState(() => {
    return localStorage.getItem("cookies_accepted") !== "1";
  });

  // Uruchamiamy GA4 od razu, jeśli użytkownik wcześniej (podczas poprzednich wizyt) zaakceptował cookies
  useEffect(() => {
    if (!showCookies && typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        'analytics_storage': 'granted',
        'ad_storage': 'granted'
      });
    }
  }, [showCookies]);

  if (!showCookies) return null;

  const acceptCookies = () => {
    // 1. Zapisz w przeglądarce
    localStorage.setItem("cookies_accepted", "1");
    // 2. Schowaj baner
    setShowCookies(false);
    // 3. Poinformuj Google Analytics, że użytkownik wyraził zgodę!
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        'analytics_storage': 'granted',
        'ad_storage': 'granted'
      });
    }
  };

  return (
    <div className="cookie-banner">
      <div style={{ fontSize: "14px", color: "#475569", flex: 1, textAlign: "left" }}>
        Ta strona korzysta z ciasteczek (cookies) w celach analitycznych oraz do prawidłowego działania usługi. Dalsze korzystanie ze strony oznacza wyrażenie zgody na ich użycie. <span className="footer-link" onClick={() => onNavigate("/polityka-prywatnosci")} style={{ textDecoration: "underline" }}>Dowiedz się więcej</span>.
      </div>
      <button className="btn-huge" style={{ padding: "10px 24px", fontSize: "14px", whiteSpace: "nowrap" }} onClick={acceptCookies}>
        Rozumiem i akceptuję
      </button>
    </div>
  );
}