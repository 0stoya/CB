# Technical SEO foundation deployment

Branch: `agent/technical-seo-foundation`

## What this release changes

- standardises the preferred host as `https://www.chati.online`
- fixes sitemap paths and last-modified dates
- fixes the Open Graph image extension from missing `.jpg` to existing `.png`
- adds route-specific title, description, canonical, robots, Open Graph and Twitter metadata
- adds route-specific structured data for the homepage, FAQ, contact and public information pages
- marks active chat, rooms, friends and account routes as `noindex`
- generates crawlable HTML fallback content for every known route after the Vite build
- generates `dist/404.html`

No backend route, database migration, Socket.IO event or package dependency is added.

## Build

```bash
cd /var/www/chat

git fetch origin
git checkout agent/technical-seo-foundation
git pull origin agent/technical-seo-foundation

cd /var/www/chat/frontend
yarn install
yarn build
```

The build should finish with output similar to:

```text
Generated SEO HTML for 14 routes plus 404.html
```

Confirm generated files:

```bash
find /var/www/chat/frontend/dist -maxdepth 3 -name index.html -o -name 404.html | sort
```

Expected route files include:

```text
dist/index.html
dist/faq/index.html
dist/kontakt/index.html
dist/regulamin/index.html
dist/polityka-prywatnosci/index.html
dist/chat/index.html
dist/pokoje/index.html
dist/znajomi/index.html
dist/konto/index.html
dist/konto/logowanie/index.html
dist/konto/rejestracja/index.html
dist/404.html
```

## Nginx preferred host

The site metadata and sitemap use `www.chati.online`. The non-www host should issue a permanent redirect to it.

Preserve the existing certificate paths and listen options, but ensure the non-www HTTPS server behaves like this:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name chati.online;

    # Keep the existing ssl_certificate and ssl_certificate_key lines.
    return 301 https://www.chati.online$request_uri;
}
```

The HTTP server should also redirect both hostnames to the preferred HTTPS host:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name chati.online www.chati.online;
    return 301 https://www.chati.online$request_uri;
}
```

## Nginx legacy route redirects

The previous sitemap published English paths that the React application does not serve. Add permanent redirects inside the main `www.chati.online` server block:

```nginx
location = /contact {
    return 301 /kontakt;
}

location = /terms {
    return 301 /regulamin;
}

location = /privacy {
    return 301 /polityka-prywatnosci;
}
```

## Real 404 responses

The generated build now contains every valid frontend route as a directory. This allows Nginx to stop sending `index.html` with HTTP 200 for arbitrary unknown paths.

Keep existing higher-priority proxy locations for `/api`, `/socket.io`, `/admin` and other backend endpoints. Replace only the generic public frontend fallback with:

```nginx
root /var/www/chat/frontend/dist;
index index.html;

location / {
    try_files $uri $uri/ =404;
}

error_page 404 /404.html;

location = /404.html {
    internal;
}
```

Do not place this block above existing API or Socket.IO proxy locations.

Validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Metadata checks

Homepage:

```bash
curl -s https://www.chati.online/ | grep -E '<title>|canonical|name="robots"|og:image|route-structured-data'
```

FAQ:

```bash
curl -s https://www.chati.online/faq | grep -E '<title>|canonical|name="description"|FAQPage'
```

Noindex application route:

```bash
curl -s https://www.chati.online/pokoje | grep -E '<title>|name="robots"|canonical'
```

Expected rooms robots value:

```text
noindex,nofollow,noarchive
```

Open Graph image:

```bash
curl -I https://www.chati.online/og-image.png
```

Expected: `200` with an image content type.

## Redirect checks

```bash
curl -I https://chati.online/
curl -I https://www.chati.online/contact
curl -I https://www.chati.online/terms
curl -I https://www.chati.online/privacy
```

Expected:

- non-www redirects once to the same path on `https://www.chati.online`
- `/contact` redirects to `/kontakt`
- `/terms` redirects to `/regulamin`
- `/privacy` redirects to `/polityka-prywatnosci`

Avoid redirect chains.

## Status-code checks

```bash
curl -I https://www.chati.online/faq
curl -I https://www.chati.online/pokoje
curl -I https://www.chati.online/this-page-does-not-exist
```

Expected:

- `/faq`: `200`
- `/pokoje`: `200`
- unknown route: `404`

## Sitemap and robots

```bash
curl -s https://www.chati.online/robots.txt
curl -s https://www.chati.online/sitemap.xml
```

Confirm:

- sitemap URL uses the www host
- sitemap contains `/kontakt`, `/regulamin` and `/polityka-prywatnosci`
- sitemap does not contain `/contact`, `/terms` or `/privacy`
- sitemap does not contain chat, rooms, friends or account application routes

## Browser regression

Check as guest and signed-in user:

- homepage opens Random Chat and Rooms
- direct load of `/chat`, `/pokoje` and `/znajomi` still works after accepting terms
- direct notification links with query parameters still work
- account login, registration, verification and reset routes load directly
- browser Back and Forward update titles and metadata
- FAQ, Contact, Terms and Privacy render normally
- unknown paths show the Chati 404 page

## Search Console after deployment

1. Add or confirm the `https://www.chati.online/` property.
2. Submit `https://www.chati.online/sitemap.xml`.
3. Inspect and request indexing for the homepage and `/faq`.
4. Inspect `/pokoje` and confirm Google detects the `noindex` directive.
5. Watch Page indexing for old `/contact`, `/terms` and `/privacy` URLs as Google processes the 301 redirects.
