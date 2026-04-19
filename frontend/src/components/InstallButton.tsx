import React, { useEffect, useState } from 'react';

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // Nasłuchujemy, czy przeglądarka pozwala na instalację PWA
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // Zatrzymuje domyślne, zautomatyzowane powiadomienia na Androidzie
      setDeferredPrompt(e);
      setIsInstallable(true); // Pokazuje nasz własny przycisk
    };

    // Nasłuchujemy, czy instalacja zakończyła się sukcesem
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Sprawdź, czy aplikacja jest już uruchomiona jako zainstalowana (tzw. standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Wywołuje natywne okienko systemowe
    deferredPrompt.prompt();
    
    // Czekamy na decyzję użytkownika
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Użytkownik zainstalował PWA');
    } else {
      console.log('Użytkownik odrzucił instalację');
    }
    
    // Po pokazaniu okienka nie możemy go użyć ponownie z tego samego zdarzenia
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // Jeśli nie da się zainstalować (np. Safari na iOS czasem wymaga dodania z menu, albo appka już jest), nie pokazujemy przycisku
  if (!isInstallable) return null;

  return (
    <button className="btn-outline-huge" onClick={handleInstallClick}>
      Pobierz Aplikację
    </button>
  );
}