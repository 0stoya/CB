# Notifications and account dashboard deployment

Branch:

```text
agent/notifications-account-dashboard
```

Migration:

```text
20260721203000_notifications_account_dashboard
```

The migration must be deployed before restarting the backend because the application reads the new `Notification`, `AuthSession.locationLabel`, `User.deletedAt` and `ChannelMembership.muteNotifications` fields during normal requests.

## 1. Check out the branch

```bash
cd /var/www/chat
git fetch origin
git checkout agent/notifications-account-dashboard
git pull origin agent/notifications-account-dashboard
```

## 2. Backend validation and migration

```bash
cd /var/www/chat/backend
yarn install
yarn prisma generate
yarn prisma migrate deploy
yarn typecheck
yarn build
```

Confirm the migration:

```bash
psql "$DATABASE_URL" -c "SELECT migration_name, finished_at FROM \"_prisma_migrations\" WHERE migration_name = '20260721203000_notifications_account_dashboard';"
```

## 3. Frontend validation

```bash
cd /var/www/chat/frontend
yarn install
yarn build
```

## 4. Restart

```bash
pm2 restart <chati-backend-process> --update-env
pm2 logs <chati-backend-process> --lines 180
```

Check that the backend starts without Prisma or Socket.IO errors.

## 5. Notification smoke test

Use two verified accounts in separate browser profiles.

### Friend requests

1. Account A sends a friend request to Account B.
2. Confirm B receives a live bell badge and a persistent notification.
3. Open the notification and confirm the requests tab opens.
4. B accepts the request.
5. Confirm A receives an accepted-friend notification.

### Private messages

1. Send a message from A to B while B is online.
2. Confirm B receives a notification showing A's nickname and a short preview.
3. Open it and confirm the correct conversation opens.
4. Confirm opening/reading the conversation removes the unread notification state.
5. Repeat while B is offline, then reconnect B and confirm both the message and notification persist.

### Room mentions

1. Join the same public room with A and B.
2. In A's composer, type `@` and confirm B appears in autocomplete.
3. Select B and send the message.
4. Confirm the mention is highlighted for B and creates a bell notification.
5. Open the notification and confirm the room opens, scrolls to the message and briefly highlights it.
6. In B's `/konto` page, mute notifications for that room.
7. Mention B again and confirm no new mention notification is created.

### Moderation notifications

Using a room owner/moderator and a normal member:

1. Promote a member and confirm the moderator notification.
2. Mute the member and confirm the mute notification.
3. Kick the member and confirm the kick notification.
4. Ban the member and confirm the ban notification.

## 6. Account dashboard smoke test

Open `/konto` while logged in.

1. Change the nickname and confirm it remains unique and is shown after refresh.
2. Change privacy controls and confirm they match `/znajomi`.
3. Confirm favourite rooms, roles, auto-join state and mention-notification switches appear.
4. Open the account on a second browser/device and confirm both sessions appear.
5. Revoke the second session and confirm its next authenticated request fails.
6. Change the password and confirm all other sessions are revoked.
7. Download the JSON export and verify it contains the profile, rooms, relationships, messages, notifications and submitted reports.

## 7. Account deletion test

Use a disposable verified account.

1. Create a community room, send a public message, add a friend and send a private message.
2. Open `/konto`, enter the password and exact confirmation `USUŃ KONTO`.
3. Confirm all sessions are invalidated and login no longer works.
4. Confirm the owned community room is archived.
5. Confirm the public message author is anonymised.
6. Confirm related private message text is replaced with the deletion tombstone.
7. Confirm moderation reports/history remain available to administrators where applicable.

## 8. Regression checks

Confirm these existing flows still work:

- anonymous random chat
- guest public-room join
- verified-room auto-join
- favourites
- friends and offline private messages
- reporting and room moderation
- admin reports queue

No GitHub Actions are used by this deployment.
