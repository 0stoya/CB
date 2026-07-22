# Public navigation and landing-page rollout

Branch:

```text
agent/public-navigation-landing-polish
```

This phase changes only the public frontend. It does not add a database migration, backend route, dependency or process change.

## 1. Check out the branch

```bash
cd /var/www/chat
git fetch origin
git checkout agent/public-navigation-landing-polish
git pull origin agent/public-navigation-landing-polish
```

## 2. Build the frontend

```bash
cd /var/www/chat/frontend
yarn install
yarn build
```

The build command runs strict TypeScript before Vite:

```text
tsc && vite build
```

Do not deploy if either stage fails.

## 3. Reload the static site

The public frontend is served from the existing Vite `dist` directory, so no backend or PM2 restart is required.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. Guest navigation test

Use a private/incognito browser window with no Chati account session.

1. Open `https://chati.online/`.
2. Confirm the desktop header shows:
   - Chati logo
   - Pokoje
   - Zaloguj się
   - Losowy czat
3. Confirm Znajomi and Powiadomienia are not shown to a guest.
4. Click **Losowy czat** and confirm the existing terms gate appears when terms have not been accepted.
5. Accept the terms and confirm `/chat` opens.
6. Return home and click **Pokoje**; confirm `/pokoje` opens.
7. Click **Zaloguj się** and confirm `/konto/logowanie` opens.
8. Open the mobile menu and confirm it contains:
   - Losowy czat
   - Pokoje
   - Zaloguj się
   - Utwórz konto
   - Jak działa Chati?
   - Kontakt
9. Confirm the menu closes with the close button, backdrop and Escape key.
10. Confirm background scrolling is locked while the mobile menu is open.

## 5. Signed-in navigation test

Use a verified test account.

1. Open the homepage while signed in.
2. Confirm the desktop header shows:
   - Pokoje
   - Znajomi
   - notification bell
   - account nickname
   - Losowy czat
3. Confirm the guest login prompt is not shown.
4. Open the notification bell and confirm existing notifications load.
5. Confirm Escape closes the notification popover.
6. Open **Znajomi** and confirm `/znajomi` works.
7. Open the account control and confirm `/konto` works.
8. At a mobile width, confirm the bell remains visible in the top bar.
9. Open the mobile menu and confirm it shows the signed-in account card, Znajomi and Moje konto.
10. Confirm no guest registration prompt flashes while the account state is loading.

## 6. Landing-page test

1. Confirm the homepage shows exactly two primary cards:
   - Losowy czat
   - Pokoje publiczne
2. Confirm both cards are fully clickable and keyboard accessible.
3. Confirm the random-chat card opens the existing terms gate when required.
4. Confirm the rooms card opens the public room list.
5. Confirm the guest account note links to registration.
6. Confirm a signed-in user sees their nickname in the subtle account note.
7. Confirm the page has no duplicated feature wall or repeated navigation links.

## 7. Footer test

1. Confirm the footer contains only:
   - Jak to działa
   - Kontakt
   - Regulamin
   - Prywatność
2. Confirm all links work without a full page reload.
3. Confirm the footer shows `Chati.online`, not the old `.pl` label.
4. Confirm the footer wraps cleanly on narrow screens.

## 8. Responsive and accessibility test

Test at approximately:

- 1440 px desktop
- 1024 px small laptop/tablet landscape
- 768 px tablet
- 390 px mobile
- 320 px narrow mobile

Confirm:

- no horizontal page scrolling
- no clipped notification popover
- browser zoom remains available
- visible keyboard focus on navigation and landing cards
- reduced-motion preference removes non-essential movement
- text remains readable at 200% browser zoom
- the sticky header does not obscure page content

## 9. Regression test

Confirm the existing flows remain unchanged:

- random chat
- public rooms
- friends and private messages
- notification deep links
- account login and registration
- account dashboard
- FAQ, contact, terms and privacy pages
- cookie and terms consent flows
- PWA/service-worker registration

No backend restart or Prisma command is required for this branch.
