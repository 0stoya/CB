import React from "react";
import { ChatiLogo } from "./Icons";

export default function PublicFooter({ navigate }: { navigate: (path: string) => void }) {
  const link = (path: string, label: string) => (
    <a
      href={path}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(path);
      }}
    >
      {label}
    </a>
  );

  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="public-footer-brand">
          <div><ChatiLogo size={28}/><strong>Chati</strong></div>
          <span>Proste rozmowy, kiedy masz na nie ochotę.</span>
        </div>
        <nav className="public-footer-links" aria-label="Linki w stopce">
          {link("/faq", "Jak to działa")}
          {link("/kontakt", "Kontakt")}
          {link("/regulamin", "Regulamin")}
          {link("/polityka-prywatnosci", "Prywatność")}
        </nav>
      </div>
      <div className="public-footer-bottom">
        <span>© {new Date().getFullYear()} Chati.online</span>
        <span>Konto jest opcjonalne. Korzystaj odpowiedzialnie.</span>
      </div>
    </footer>
  );
}
