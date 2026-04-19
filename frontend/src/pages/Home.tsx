import React from "react";
import { InstallButton } from "../components/InstallButton";

export default function Home({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ maxWidth: 800, marginTop: "60px" }}>
      <h1 className="hero-title">Rozmawiaj z nieznajomymi całkowicie za darmo.</h1>
      <p className="hero-subtitle">
        Poznawaj nowych ludzi z całej Polski. Bezpiecznie, anonimowo i bez rejestracji. 
        Nasz system natychmiast połączy Cię z losowym rozmówcą.
      </p>
      
      {/* Dodany flexbox dla wyśrodkowania przycisków i odstępów */}
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn-huge" onClick={onStart}>
          Rozpocznij Czat
        </button>
        
        {/* Przycisk pojawi się tu automatycznie, jeśli urządzenie pozwala na instalację */}
        <InstallButton />
      </div>
    </div>
  );
}