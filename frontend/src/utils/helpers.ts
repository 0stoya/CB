export function isMobileDevice(): boolean {
  return /Mobi|Android/i.test(navigator.userAgent);
}

export function nowMs(): number {
  return Date.now();
}

export function formatTime(ts: number): string {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

export const trackPageView = (url: string) => {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("config", "G-XXXXXXXXXX", { page_path: url }); 
  }
};