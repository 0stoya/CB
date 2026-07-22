# Admin UI and UX polish deployment

Branch:

```text
agent/admin-ui-ux-polish
```

This phase changes only the admin frontend. It does not add a Prisma migration, backend route, dependency or GitHub workflow.

## 1. Check out the branch

```bash
cd /var/www/chat
git fetch origin
git checkout agent/admin-ui-ux-polish
git pull origin agent/admin-ui-ux-polish
```

## 2. Build the admin frontend

```bash
cd /var/www/chat/admin-frontend
yarn install
yarn build
```

The build runs strict TypeScript first and then creates the Vite production bundle.

## 3. Confirm Nginx serves the new bundle

```bash
ls -lah /var/www/chat/admin-frontend/dist
sudo nginx -t
sudo systemctl reload nginx
```

No backend or PM2 restart is required for this UI-only phase.

## 4. Navigation smoke test

Log in at `https://admin.chati.online` and confirm:

1. Desktop shows a fixed left navigation and sticky page header.
2. Mobile/tablet shows a menu button and dismissible navigation drawer.
3. The seven areas open independently:
   - Przegląd
   - Użytkownicy
   - Pokoje
   - Zgłoszenia
   - Skrzynka
   - Bezpieczeństwo
   - Operacje
4. The URL hash changes for each area and browser Back/Forward restores the correct view.
5. The public Chati link opens in a new tab.
6. Logout returns to the redesigned login screen.

## 5. Feature regression

### Overview

- live statistics refresh without reloading the whole page
- moderation summary displays correctly

### Users

- search by nickname and e-mail
- filter by account status
- clear filters
- open and close the account drawer with button, backdrop and Escape
- suspend/reactivate an account
- revoke all sessions
- paginate results

### Rooms

- update guest access
- update slow mode
- toggle expiry protection
- archive/reactivate a community room
- delete a disposable community room

### Reports

- switch between report queue and moderation history
- filter report statuses
- resolve and dismiss disposable reports
- display protected snapshots

### Inbox

- search messages locally
- filter categories
- delete a disposable contact message

### Security

- add and remove a disposable IP block
- confirm automatic and manual source labels

### Operations

- switch between service health and 30-day analytics
- run SMTP check
- run maintenance only in a controlled test
- rebuild analytics
- open `/healthz` and `/readyz`

## 6. Responsive and accessibility checks

Test at approximately:

- 1440 px desktop
- 1024 px tablet landscape
- 768 px tablet portrait
- 390 px mobile

Confirm:

- no page-level horizontal overflow
- wide data tables scroll within their cards
- every interactive element has a visible keyboard focus state
- Escape closes the mobile menu and user detail drawer
- reduced-motion preference removes non-essential animation
- labels remain readable at 200% browser zoom
- destructive actions remain visually distinct from normal actions

The PR should remain draft until `yarn build` passes and the navigation plus user/report/room smoke tests succeed on the server.
