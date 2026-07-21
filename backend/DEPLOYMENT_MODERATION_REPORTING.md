# Moderation and reporting deployment

This phase adds a Prisma migration. Deploy the database migration before restarting the backend.

No GitHub Actions or workflow files are used.

## 1. Check out the branch

```bash
cd /var/www/chat
git fetch origin
git checkout agent/moderation-reporting
git pull origin agent/moderation-reporting
```

## 2. Backend

```bash
cd /var/www/chat/backend
yarn install
yarn prisma generate
yarn prisma migrate deploy
yarn typecheck
yarn build
```

Expected migration:

```text
20260721183000_moderation_reporting
```

The migration adds:

- report target/reason/status enums
- moderation action enum
- `Channel.isLocked`
- `ChannelRestriction`
- `Report`
- `ModerationAction`

## 3. Frontend

```bash
cd /var/www/chat/frontend
yarn install
yarn build
```

## 4. Admin frontend

```bash
cd /var/www/chat/admin-frontend
yarn install
yarn build
```

## 5. Restart

Use the real PM2 process name:

```bash
pm2 restart <chati-backend-process> --update-env
pm2 logs <chati-backend-process> --lines 150
```

## 6. Smoke test

Use three browser profiles:

- Account A: room owner
- Account B: normal verified member
- Guest C: guest nickname

### User cards and reports

1. Open the same room in all profiles.
2. Click Account B in the participant list.
3. Confirm the card offers friend, block and report actions.
4. Report Account B's public message.
5. Report the room.
6. Confirm both reports appear in the admin moderation queue with server-generated snapshots.

### Room owner moderation

1. As Account A, mute Account B for 10 minutes.
2. Confirm Account B receives `CHANNEL_MUTED` when trying to send.
3. Kick Guest C and confirm the room closes for the guest.
4. Ban Account B and confirm the room closes for B and rejoining is rejected.
5. Promote another registered member to moderator, then reconnect that member and confirm the shield role appears.
6. Delete a public message and confirm it disappears live from all connected clients.
7. Lock the room and confirm only owner/moderators can send or join.
8. Unlock the room and confirm normal access returns.

### Admin queue

1. Resolve a message report with **Delete content** and confirm the message disappears live.
2. Resolve a user report with **Suspend account** and confirm active sessions disconnect.
3. Resolve a room report with **Archive room** and confirm connected users are removed.
4. Dismiss a harmless report and confirm it moves to the dismissed filter.
5. Confirm the moderation history records each action.

## Rollback

Application rollback:

```bash
cd /var/www/chat
git checkout main
```

Do not manually remove the migration tables during a normal application rollback. The previous application version ignores the new tables and `isLocked` column.
