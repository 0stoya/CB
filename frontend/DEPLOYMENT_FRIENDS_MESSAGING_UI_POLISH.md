# Friends and messaging UI polish deployment

This release changes only the public frontend. It does not add a Prisma migration, backend route, package dependency, or PM2 process change.

## Deploy the branch

```bash
cd /var/www/chat

git fetch origin
git checkout agent/friends-messaging-ui-ux-polish
git pull origin agent/friends-messaging-ui-ux-polish

cd /var/www/chat/frontend
yarn install
yarn build
```

The build must complete both TypeScript and Vite successfully.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

No backend restart is required.

## Desktop smoke test

Use two verified accounts in separate browsers or private windows.

1. Open `/znajomi` with account A.
2. Confirm the desktop layout shows the contacts panel and conversation area side by side.
3. Confirm the header links open Rooms and Account.
4. Confirm the notification bell does not overlap header actions.
5. Confirm the four sections are available:
   - Conversations
   - Requests
   - Find
   - Privacy
6. Confirm conversation search filters the existing friend list.
7. Confirm conversations with unread messages sort above read conversations.
8. Confirm online friends sort prominently when unread totals are equal.

## Friend request flow

1. From account A, search for account B by nickname.
2. Send a friend request.
3. Confirm the result changes to a sent state after refresh/socket update.
4. Open account B.
5. Confirm Requests shows a visible incoming count.
6. Accept the request.
7. Confirm both accounts show the friendship without a full browser reload.
8. Repeat with a second request and test decline.
9. Send another request and test cancellation from the sender.

## Private messages

1. Open account B from account A's conversation list.
2. Send a single-line message.
3. Confirm it appears for both accounts.
4. Confirm the sender sees Sent, then Delivered, then Read as the second account opens the conversation.
5. Send a multiline message using Shift+Enter.
6. Confirm Enter sends and Shift+Enter adds a line.
7. Confirm long content wraps without horizontal scrolling.
8. Confirm the 500-character counter updates and warns near the limit.
9. Confirm the active conversation is marked read immediately.
10. Confirm unread counts update when a message arrives in a different conversation.
11. Confirm the conversation list shows the latest message and timestamp.
12. Confirm a sender's preview uses the `You:` prefix.

## Typing and presence

1. Type in account A without sending.
2. Confirm account B sees the typing indicator.
3. Stop typing and confirm the indicator disappears.
4. Close account B and confirm account A changes to Offline or last-seen state.
5. Reopen account B and confirm Online returns through the socket event.
6. Confirm entering `/znajomi` does not briefly disconnect and reconnect the existing socket.

## Offline delivery

1. Keep account A open and close account B.
2. Send a message from account A.
3. Reopen account B.
4. Confirm the message is delivered through sync.
5. Open the conversation and confirm the sender receives the read state.

## Mobile flow

Test at approximately 390 x 844 and 360 x 740.

1. Open `/znajomi` with no selected conversation.
2. Confirm only the conversations/sidebar workspace is visible.
3. Open a friend.
4. Confirm the sidebar is replaced by the full-height conversation.
5. Confirm the back arrow returns to the conversation list.
6. Confirm the composer stays visible above the software keyboard.
7. Confirm the send button becomes an icon-sized control.
8. Confirm requests, search, and privacy cards stack without horizontal overflow.
9. Open the friend information drawer.
10. Confirm it opens as a mobile sheet and closes with the close control, backdrop, and Escape on a hardware keyboard.
11. Confirm browser back/refresh deep links still open the requested friend.

## Notification deep links

1. Generate a friend-request notification.
2. Open it and confirm `/znajomi?tab=requests` selects Requests directly without delayed DOM clicking.
3. Generate a direct-message notification.
4. Open it and confirm `/znajomi?friend=<id>` loads the correct conversation.
5. Confirm the notification is marked read.

## Privacy and blocking

1. Change the friend-request policy and save.
2. Toggle direct messages, online visibility, and last-seen visibility.
3. Refresh and confirm the settings persist.
4. Remove a friend from the information drawer and confirm the conversation closes.
5. Block a test account and confirm it moves to the blocked list.
6. Confirm the blocked account cannot send a request or private message.
7. Unblock the account and confirm it disappears from the blocked list.

## Connection states

1. In browser developer tools, switch the network offline.
2. Confirm the offline banner appears.
3. Confirm saved messages remain readable.
4. Confirm sending and typing are disabled.
5. Restore the network or use Reconnect.
6. Confirm presence, incoming messages, and sending resume.

## Accessibility

1. Navigate tabs, conversations, requests, search results, composer, profile drawer, and settings with the keyboard.
2. Confirm visible focus states.
3. Confirm buttons have readable labels at 200% browser zoom.
4. Confirm reduced-motion mode removes drawer and loading animations.
5. Confirm the conversation thread remains readable with long Polish nicknames and 500-character messages.
6. Confirm no horizontal page scrolling at desktop, tablet, or mobile widths.

## Release gate

Keep the pull request in draft until:

- `yarn build` passes
- two-account requests and messaging work
- Sent, Delivered, and Read states update correctly
- offline message sync works
- mobile conversations replace rather than stack above the contact list
- notification deep links open the intended section or friend
- privacy, remove, block, and unblock actions work
