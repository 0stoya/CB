import React from "react";

type Props = {
  onAccept: () => void;
  onDecline: () => void;
  onNavigate: (path: string) => void;
};

export function TermsModal({ onAccept, onDecline, onNavigate }: Props) {
  const handleAccept = () => {
    const cb = document.getElementById("termsCheck") as HTMLInputElement;
    if (cb && cb.checked) {
      onAccept();
    } else {
      alert("Musisz zaznaczyć pole potwierdzające wiek i regulamin, aby kontynuować.");
    }
  };

  return (
    <div className="overlay" onClick={onDecline}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Zanim rozpoczniesz...</h2>
        <p className="modal-text">Dostęp do aplikacji wymaga potwierdzenia pełnoletności i akceptacji zasad.</p>
        
        <div className="checkbox-group">
          <input type="checkbox" id="termsCheck" />
          <label htmlFor="termsCheck" className="checkbox-label">
            Oświadczam, że mam <strong>ukończone 18 lat</strong> oraz akceptuję <span className="footer-link" style={{textDecoration: "underline"}} onClick={() => onNavigate("/regulamin")}>Regulamin</span> i <span className="footer-link" style={{textDecoration: "underline"}} onClick={() => onNavigate("/polityka-prywatnosci")}>Politykę Prywatności</span> serwisu Chati.
          </label>
        </div>

        <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
          <button className="btn-huge" style={{ width: "100%" }} onClick={handleAccept}>
            Akceptuję, wejdź na Czat
          </button>
          <button 
            style={{ background: "transparent", color: "#64748B", border: "none", padding: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
            onClick={onDecline}
          >
            Zrezygnuj
          </button>
        </div>
      </div>
    </div>
  );
}