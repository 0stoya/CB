# Chati release QA checklist

Run this checklist against the production-like build before marking the launch-hardening PR ready.

## Browsers and devices

Test the latest stable versions available on the test date:

- Chrome desktop
- Edge desktop
- Firefox desktop
- Safari desktop where available
- Chrome Android
- Safari iPhone/iPad

Use at least one narrow mobile viewport, one tablet viewport and one desktop viewport. Repeat the core chat tests with browser zoom at 200%.

## Account and authentication

- Register, verify e-mail, log in and log out.
- Request and complete a password reset.
- Confirm invalid/expired links show a useful error.
- Confirm secure cookies are not accessible to JavaScript.
- Confirm login and account API responses use `Cache-Control: no-store`.
- Confirm changing password ends other sessions.
- Confirm deleting a disposable account prevents future login.

## Random chat

- Guest joins the queue and matches another guest.
- Send, typing and disconnect events work on desktop and mobile.
- Rapid messages trigger rate limits without breaking the page.
- Reloading or leaving does not strand the other participant.

## Public rooms

- Guest and verified-account joins work according to room settings.
- Message history, online count and member list remain correct.
- Favourite and auto-join settings persist.
- `@nickname` autocomplete works with keyboard and touch.
- Mention links open the correct room and message.
- Muting room notifications suppresses mentions.
- Owner/moderator kick, mute, ban, lock and message deletion work live.

## Friends and private messages

- Send, accept, decline and cancel friend requests.
- Send private messages online and offline.
- Confirm sent, delivered and read states.
- Confirm notification deep links open the correct conversation.
- Blocking stops new private communication.
- Privacy controls apply immediately.

## Notifications

- Bell badge updates live and after refresh.
- Mark-one and mark-all-read work.
- Friend, private message, mention and moderation notifications persist across devices.
- The bell remains usable in the main site, rooms and friends screens.

## Account dashboard

- Nickname uniqueness is enforced.
- Sessions show device and coarse location hints where supplied by the proxy.
- Revoke one session and all other sessions.
- Download and inspect the JSON export.
- Confirm room favourites, roles, notification settings and blocked users are accurate.

## Admin

- Admin IP and session restrictions still apply.
- User search works by e-mail and nickname.
- Suspend, reactivate and revoke-session actions work and appear in moderation history.
- Reports, rooms, bans and contact messages still work.
- Operations panel reports database readiness, memory, SMTP and maintenance status.
- Rebuild 30 days of analytics and confirm no message text or personal browsing data is shown.

## Accessibility

- Complete all primary flows using keyboard only.
- Focus remains visible on links, buttons, inputs and dialogs.
- Dialogs can be closed without a mouse.
- Form fields have visible labels or meaningful accessible names.
- Error messages are readable and do not rely on colour alone.
- Text and controls remain usable at 200% zoom.
- Check light-theme contrast with an automated tool and manually verify badges and muted text.
- Confirm dynamic notification and error updates are announced where appropriate.

## Operational validation

- `GET /healthz` returns HTTP 200.
- `GET /readyz` returns HTTP 200 with PostgreSQL available and HTTP 503 when deliberately pointed at an unavailable test database.
- Run a backup and verify its checksum/archive listing.
- Complete a restore drill into a disposable database.
- Run the manual maintenance job and inspect deleted-record counts.
- Run the SMTP transport check.
- Confirm request IDs appear in responses and unexpected-error logs.
- Confirm PM2 restart and graceful shutdown do not produce Prisma or Socket.IO errors.

## Regression and release decision

Record every failure with browser/device, exact route, steps, expected result, actual result and request ID where available. Do not release with unresolved authentication, privacy, message-delivery, moderation, backup/restore or readiness failures.
