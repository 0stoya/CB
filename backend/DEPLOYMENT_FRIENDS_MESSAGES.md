# Friends and offline messages deployment

This release adds friend requests, accepted friendships, blocking, presence, privacy settings and persistent direct messages. It does not add GitHub Actions.

## Database

No new Prisma migration is required. The account foundation already created:

- `Friendship`
- `DirectConversation`
- `DirectMessage`
- user privacy and presence fields

Still run `prisma migrate deploy` to confirm the server database is current.

## Deploy the branch

```bash
cd /var/www/chat
git fetch origin
git checkout agent/friends-offline-messages
git pull origin agent/friends-offline-messages
```

## Backend

```bash
cd /var/www/chat/backend
yarn install
yarn prisma generate
yarn prisma migrate deploy
yarn typecheck
yarn build
```

## Frontend

```bash
cd /var/www/chat/frontend
yarn install
yarn build
```

The admin frontend is unchanged by this release, but it can be rebuilt with the normal deployment if desired.

## Restart

```bash
pm2 restart <chati-backend-process> --update-env
pm2 logs <chati-backend-process> --lines 120
```

The frontend build must be published using the same Nginx/static deployment method already used for Chati.

## Smoke test

Use two verified accounts in separate browser profiles.

1. Open `/znajomi` in both profiles.
2. Search for the second account by nickname.
3. Send a friend request.
4. Confirm that the request appears for the recipient without refreshing.
5. Accept it and verify both users appear under **Znajomi**.
6. Open the conversation and send messages in both directions.
7. Confirm the status changes from **Wysłano** to **Dostarczono**, then **Przeczytano**.
8. Confirm the online presence dot changes when one profile closes `/znajomi`.
9. Close the recipient profile completely.
10. Send a message from the sender and confirm it remains **Wysłano**.
11. Reopen and log in as the recipient.
12. Open `/znajomi`; confirm the offline message is available and the sender sees **Dostarczono**.
13. Open the conversation; confirm the sender sees **Przeczytano**.
14. Remove the friendship and confirm new messages are rejected.
15. Send a new request, accept it, then test **Zablokuj** and **Odblokuj**.
16. Test privacy settings for invitations, direct messages, online status and last seen.

## API checks

With an authenticated browser session:

- `GET /api/social/overview`
- `GET /api/social/search?q=<nickname>`
- `GET /api/social/conversations/<friendId>/messages`

Unauthenticated requests should return `401 AUTH_REQUIRED`.

## Expected server behaviour

- Direct messages are saved before Socket.IO delivery.
- Messages to offline friends keep `deliveredAt = NULL` until reconnect.
- Opening a verified socket marks pending offline messages as delivered.
- Opening a conversation marks incoming unread messages as read.
- Removing or blocking a friend prevents new direct messages.
- Private messages are not exposed through the admin message inbox.
