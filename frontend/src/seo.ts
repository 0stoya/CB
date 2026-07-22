import seoConfig from "./seo/routes.json";

type SchemaKind = "home" | "faq" | "contact" | "webpage" | "none";

type RouteSeo = {
  path: string;
  title: string;
  description: string;
  robots: string;
  schema: SchemaKind;
};

const routes = seoConfig.routes as RouteSeo[];
const baseUrl = seoConfig.baseUrl.replace(/\/$/, "");
const defaultImage = `${baseUrl}${seoConfig.defaultImage}`;

const faqItems = [
  {
    question: "Jak działa łączenie w losowym czacie?",
    answer: "Po wejściu do losowego czatu system szuka jednej wolnej osoby. Gdy ktoś jest dostępny, rozmowa rozpoczyna się automatycznie."
  },
  {
    question: "Co dzieje się, gdy rozmówca się rozłączy?",
    answer: "Po zakończeniu rozmowy możesz od razu rozpocząć szukanie nowej osoby. Krótki cooldown ogranicza ryzyko ponownego połączenia z tym samym rozmówcą."
  },
  {
    question: "Czym różnią się pokoje od losowego czatu?",
    answer: "Losowy czat łączy anonimowo dwie osoby. Pokoje są publicznymi społecznościami z nazwą, tematem, uczestnikami i historią wiadomości."
  },
  {
    question: "Czy konto jest wymagane?",
    answer: "Nie. Z losowego czatu i pokojów dostępnych dla gości możesz korzystać bez rejestracji. Konto odblokowuje znajomych, prywatne wiadomości, ulubione pokoje i ustawienia prywatności."
  },
  {
    question: "Czy mogę zainstalować Chati na telefonie?",
    answer: "Tak. Chati działa jako aplikacja PWA i może zostać dodane do ekranu głównego bez instalowania aplikacji ze sklepu."
  },
  {
    question: "Jak Chati chroni anonimowość?",
    answer: "Losowy czat nie wymaga adresu e-mail ani numeru telefonu. Dane techniczne potrzebne do bezpieczeństwa są przetwarzane zgodnie z Polityką prywatności."
  },
  {
    question: "Co zrobić, gdy spotkam bota lub nadużycie?",
    answer: "Użyj przycisku zgłoszenia w aktywnej rozmowie lub menu wiadomości w pokoju, zakończ rozmowę i nie udostępniaj danych osobowych."
  }
];

function routeForPath(path: string): RouteSeo {
  return routes.find((route) => route.path === path) ?? {
    path,
    title: "Nie znaleziono strony – Chati",
    description: "Ta strona nie istnieje lub została przeniesiona.",
    robots: "noindex,nofollow,noarchive",
    schema: "none"
  };
}

function setMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.append(element);
  }
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.append(element);
  }
  element.href = url;
}

function schemaFor(route: RouteSeo, canonical: string) {
  if (route.schema === "none") return null;

  const webpage = {
    "@context": "https://schema.org",
    "@type": route.schema === "contact" ? "ContactPage" : "WebPage",
    name: route.title,
    description: route.description,
    url: canonical,
    inLanguage: "pl-PL",
    isPartOf: {
      "@type": "WebSite",
      name: seoConfig.siteName,
      url: `${baseUrl}/`
    }
  };

  if (route.schema === "faq") {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      name: route.title,
      url: canonical,
      inLanguage: "pl-PL",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer }
      }))
    };
  }

  if (route.schema === "home") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${baseUrl}/#website`,
          name: seoConfig.siteName,
          alternateName: "Chati Online",
          url: `${baseUrl}/`,
          inLanguage: "pl-PL"
        },
        {
          "@type": "WebApplication",
          "@id": `${baseUrl}/#app`,
          name: "Chati Online",
          url: `${baseUrl}/`,
          description: route.description,
          applicationCategory: "SocialNetworkingApplication",
          operatingSystem: "All",
          browserRequirements: "Wymaga nowoczesnej przeglądarki z obsługą HTML5",
          inLanguage: "pl-PL",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "PLN" },
          featureList: [
            "Losowy czat bez logowania",
            "Publiczne pokoje tematyczne",
            "Znajomi i prywatne wiadomości",
            "Zgłoszenia i moderacja"
          ]
        }
      ]
    };
  }

  return webpage;
}

function setStructuredData(value: unknown) {
  const current = document.getElementById("route-structured-data");
  if (!value) {
    current?.remove();
    return;
  }

  const element = current instanceof HTMLScriptElement ? current : document.createElement("script");
  element.id = "route-structured-data";
  element.type = "application/ld+json";
  element.textContent = JSON.stringify(value);
  if (!element.isConnected) document.head.append(element);
}

export function applyRouteSeo(path: string) {
  const route = routeForPath(path);
  const canonical = `${baseUrl}${route.path === "/" ? "/" : route.path}`;

  document.title = route.title;
  setCanonical(canonical);
  setMeta('meta[name="description"]', { name: "description", content: route.description });
  setMeta('meta[name="robots"]', { name: "robots", content: route.robots });
  setMeta('meta[name="googlebot"]', { name: "googlebot", content: route.robots });
  setMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
  setMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "Chati.online" });
  setMeta('meta[property="og:locale"]', { property: "og:locale", content: "pl_PL" });
  setMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
  setMeta('meta[property="og:title"]', { property: "og:title", content: route.title });
  setMeta('meta[property="og:description"]', { property: "og:description", content: route.description });
  setMeta('meta[property="og:image"]', { property: "og:image", content: defaultImage });
  setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: route.title });
  setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: route.description });
  setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: defaultImage });
  setStructuredData(schemaFor(route, canonical));
}
