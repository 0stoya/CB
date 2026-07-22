import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(directory, "..");
const distRoot = path.join(frontendRoot, "dist");
const config = JSON.parse(await readFile(path.join(frontendRoot, "src/seo/routes.json"), "utf8"));
const template = await readFile(path.join(distRoot, "index.html"), "utf8");
const baseUrl = config.baseUrl.replace(/\/$/, "");
const imageUrl = `${baseUrl}${config.defaultImage}`;

const faqItems = [
  ["Jak działa łączenie w losowym czacie?", "Po wejściu do losowego czatu system szuka jednej wolnej osoby. Gdy ktoś jest dostępny, rozmowa rozpoczyna się automatycznie."],
  ["Co dzieje się, gdy rozmówca się rozłączy?", "Po zakończeniu rozmowy możesz od razu rozpocząć szukanie nowej osoby."],
  ["Czym różnią się pokoje od losowego czatu?", "Losowy czat łączy anonimowo dwie osoby. Pokoje są publicznymi społecznościami z nazwą, tematem, uczestnikami i historią wiadomości."],
  ["Czy konto jest wymagane?", "Nie. Losowy czat i pokoje dostępne dla gości działają bez rejestracji. Konto odblokowuje znajomych, prywatne wiadomości i ulubione pokoje."],
  ["Czy mogę zainstalować Chati na telefonie?", "Tak. Chati działa jako aplikacja PWA i może zostać dodane do ekranu głównego."],
  ["Jak Chati chroni anonimowość?", "Losowy czat nie wymaga adresu e-mail ani numeru telefonu. Dane techniczne potrzebne do bezpieczeństwa są przetwarzane zgodnie z Polityką prywatności."],
  ["Co zrobić, gdy spotkam bota lub nadużycie?", "Użyj przycisku zgłoszenia, zakończ rozmowę i nie udostępniaj danych osobowych."]
];

const publicNavigation = `
  <nav aria-label="Najważniejsze strony">
    <a href="/">Strona główna</a>
    <a href="/faq">Jak działa Chati?</a>
    <a href="/kontakt">Kontakt</a>
    <a href="/regulamin">Regulamin</a>
    <a href="/polityka-prywatnosci">Polityka prywatności</a>
  </nav>`;

const fallbackByPath = {
  "/": `
    <main class="seo-fallback">
      <p class="seo-fallback-brand">Chati.online</p>
      <h1>Losowy czat bez logowania i pokoje publiczne</h1>
      <p>Chati pozwala bezpłatnie porozmawiać z losową osobą albo dołączyć do publicznego pokoju tematycznego. Konto jest opcjonalne.</p>
      <section>
        <h2>Losowy czat</h2>
        <p>Natychmiastowe połączenie jeden na jeden z nową osobą, bez instalacji i bez obowiązkowej rejestracji.</p>
      </section>
      <section>
        <h2>Pokoje publiczne</h2>
        <p>Rozmowy grupowe podzielone na pokoje towarzyskie, regionalne i tematyczne.</p>
      </section>
      ${publicNavigation}
    </main>`,
  "/faq": `
    <main class="seo-fallback">
      <p class="seo-fallback-brand">Pomoc i bezpieczeństwo</p>
      <h1>Jak działa Chati?</h1>
      <p>Najważniejsze informacje o losowym czacie, pokojach, kontach, prywatności i zgłaszaniu problemów.</p>
      ${faqItems.map(([question, answer]) => `<section><h2>${question}</h2><p>${answer}</p></section>`).join("\n")}
      ${publicNavigation}
    </main>`,
  "/kontakt": `
    <main class="seo-fallback">
      <p class="seo-fallback-brand">Pomoc</p>
      <h1>Kontakt i zgłoszenia</h1>
      <p>Skontaktuj się z zespołem Chati w sprawie pomocy technicznej, prywatności, bezpieczeństwa, moderacji lub działania serwisu.</p>
      <p>Nie przesyłaj hasła, kodów logowania ani innych poufnych danych.</p>
      ${publicNavigation}
    </main>`,
  "/regulamin": `
    <main class="seo-fallback">
      <p class="seo-fallback-brand">Dokumenty</p>
      <h1>Regulamin korzystania z Chati</h1>
      <p>Regulamin opisuje zasady korzystania z losowego czatu, pokojów publicznych, kont, prywatnych wiadomości i funkcji społecznościowych.</p>
      ${publicNavigation}
    </main>`,
  "/polityka-prywatnosci": `
    <main class="seo-fallback">
      <p class="seo-fallback-brand">Prywatność</p>
      <h1>Polityka prywatności Chati</h1>
      <p>Polityka wyjaśnia, jakie dane techniczne i dane konta przetwarza Chati oraz jak działają bezpieczeństwo i prawa użytkownika.</p>
      ${publicNavigation}
    </main>`
};

const fallbackStyle = `<style id="seo-fallback-style">
  .seo-fallback{max-width:920px;margin:0 auto;padding:64px 24px;font:16px/1.65 Inter,system-ui,sans-serif;color:#172033}
  .seo-fallback h1{max-width:760px;margin:0 0 18px;font-size:clamp(2rem,5vw,3.7rem);line-height:1.05;letter-spacing:-.04em}
  .seo-fallback h2{margin:32px 0 8px;font-size:1.25rem;line-height:1.25}
  .seo-fallback p{max-width:760px;margin:0 0 14px;color:#536176}
  .seo-fallback-brand{color:#006aff!important;font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
  .seo-fallback nav{display:flex;flex-wrap:wrap;gap:14px;margin-top:38px;padding-top:20px;border-top:1px solid #e2e8f0}
  .seo-fallback a{color:#0057d9;font-weight:700}
</style>`;

function escapeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function schemaFor(route, canonical) {
  if (route.schema === "none") return null;
  if (route.schema === "faq") {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      name: route.title,
      url: canonical,
      inLanguage: "pl-PL",
      mainEntity: faqItems.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer }
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
          name: config.siteName,
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
          inLanguage: "pl-PL",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "PLN" }
        }
      ]
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": route.schema === "contact" ? "ContactPage" : "WebPage",
    name: route.title,
    description: route.description,
    url: canonical,
    inLanguage: "pl-PL",
    isPartOf: { "@type": "WebSite", name: config.siteName, url: `${baseUrl}/` }
  };
}

function replaceMeta(html, selector, replacement) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\s+${escaped}[^>]*>`, "i");
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `  ${replacement}\n</head>`);
}

function renderRoute(route) {
  const canonical = `${baseUrl}${route.path === "/" ? "/" : route.path}`;
  const fallback = fallbackByPath[route.path] ?? `
    <main class="seo-fallback">
      <p class="seo-fallback-brand">Chati.online</p>
      <h1>${route.title}</h1>
      <p>${route.description}</p>
    </main>`;
  const schema = schemaFor(route, canonical);
  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${route.title}</title>`);
  html = replaceMeta(html, 'name="description"', `<meta name="description" content="${route.description}" />`);
  html = replaceMeta(html, 'name="robots"', `<meta name="robots" content="${route.robots}" />`);
  html = replaceMeta(html, 'name="googlebot"', `<meta name="googlebot" content="${route.robots}" />`);
  html = replaceMeta(html, 'property="og:url"', `<meta property="og:url" content="${canonical}" />`);
  html = replaceMeta(html, 'property="og:title"', `<meta property="og:title" content="${route.title}" />`);
  html = replaceMeta(html, 'property="og:description"', `<meta property="og:description" content="${route.description}" />`);
  html = replaceMeta(html, 'property="og:image"', `<meta property="og:image" content="${imageUrl}" />`);
  html = replaceMeta(html, 'name="twitter:title"', `<meta name="twitter:title" content="${route.title}" />`);
  html = replaceMeta(html, 'name="twitter:description"', `<meta name="twitter:description" content="${route.description}" />`);
  html = replaceMeta(html, 'name="twitter:image"', `<meta name="twitter:image" content="${imageUrl}" />`);
  html = html.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
  html = html.replace(/<script\s+id="route-structured-data"[^>]*>[\s\S]*?<\/script>/i, schema
    ? `<script id="route-structured-data" type="application/ld+json">${escapeJson(schema)}</script>`
    : "");
  html = html.replace(/<div\s+id="root">[\s\S]*?<\/div>/i, `<div id="root">${fallback}</div>`);
  if (!html.includes('id="seo-fallback-style"')) html = html.replace("</head>", `${fallbackStyle}\n</head>`);
  return html;
}

for (const route of config.routes) {
  const html = renderRoute(route);
  if (route.path === "/") {
    await writeFile(path.join(distRoot, "index.html"), html);
    continue;
  }
  const outputDirectory = path.join(distRoot, route.path.slice(1));
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, "index.html"), html);
}

const notFound = {
  path: "/404",
  title: "Nie znaleziono strony – Chati",
  description: "Ta strona nie istnieje lub została przeniesiona.",
  robots: "noindex,nofollow,noarchive",
  schema: "none"
};
await writeFile(path.join(distRoot, "404.html"), renderRoute(notFound));

console.log(`Generated SEO HTML for ${config.routes.length} routes plus 404.html`);
