# Account persistence deployment

This change is designed to be deployed directly on the Chati server. It does not add or require GitHub Actions.

## 1. Create PostgreSQL database

Example commands:

```bash
sudo -u postgres createuser --pwprompt chati
sudo -u postgres createdb --owner=chati chati
```

Use a strong database password and restrict PostgreSQL to localhost unless remote access is intentionally required.

## 2. Configure the backend

Copy the example file and set real values:

```bash
cd backend
cp .env.example .env
```

Required values:

```dotenv
DATABASE_URL=postgresql://chati:STRONG_PASSWORD@127.0.0.1:5432/chati?schema=public
SESSION_SECRET=LONG_RANDOM_VALUE
PUBLIC_APP_URL=https://chati.online
```

Email verification and password reset require SMTP in production:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-user
SMTP_PASSWORD=your-password
SMTP_FROM=Chati <noreply@chati.online>
```

Generate a session secret, for example:

```bash
openssl rand -base64 48
```

## 3. Install dependencies

The dependency manifest now includes Prisma and Nodemailer. On the first deployment of this branch, run `npm install` rather than `npm ci` so the server can refresh the existing lockfile:

```bash
cd backend
npm install
```

## 4. Apply the database migration

```bash
npx prisma generate
npx prisma migrate deploy
```

The checked-in migration creates:

- verified user accounts
- persistent login sessions
- email verification and password reset tokens
- public/community channels
- channel memberships and favourites
- friendships
- persistent direct conversations and offline messages

## 5. Build and restart

```bash
npm run build
pm2 restart chati-backend --update-env
```

Use the actual PM2 process name if it differs.

## 6. Build the frontend

```bash
cd ../frontend
npm install
npm run build
```

Deploy the generated frontend using the existing Nginx/static deployment process.

## 7. Smoke tests

```bash
curl -i https://chati.online/health
curl -i https://chati.online/api/auth/me
```

Expected unauthenticated account response:

```json
{"ok":true,"user":null}
```

Then test:

1. Create an account at `/konto/rejestracja`.
2. Open the verification link from the email.
3. Log in at `/konto/logowanie`.
4. Confirm `/api/auth/me` returns the account.
5. Request a password reset and confirm old sessions are revoked after changing the password.

## Notes

- Random anonymous chat remains available without an account.
- Verification and reset tokens are hashed in the database.
- User login sessions are persisted in PostgreSQL and stored in an HTTP-only cookie.
- The existing admin session remains separate under the `chati_admin` cookie.
