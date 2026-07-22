# Random Chat UI/UX Polish — Deployment and Smoke Test

## Scope

This release changes only the public frontend random-chat experience.

It does not add or modify:

- backend routes
- Socket.IO event names or payloads
- database migrations
- package dependencies
- Nginx configuration
- GitHub workflows

## Deploy

```bash
cd /var/www/chat

git fetch origin
git checkout agent/random-chat-ui-ux-polish
git pull origin agent/random-chat-ui-ux-polish

cd /var/www/chat/frontend
yarn install
yarn build

sudo nginx -t
sudo systemctl reload nginx
```

No Prisma command, backend build, or PM2 restart is required.

## Build gate

The frontend build must complete successfully:

```bash
cd /var/www/chat/frontend
yarn build
```

Expected build pipeline:

```text
tsc && vite build
```

## Desktop smoke test

Use two separate browsers or one normal window and one private window.

1. Open `https://chati.online/chat` in both browsers.
2. Accept the terms prompt where required.
3. Confirm each browser shows the matching screen.
4. Confirm the status pill changes from connecting/searching to active.
5. Confirm both browsers connect to each other.
6. Confirm the connected introduction and icebreaker suggestions appear.
7. Select an icebreaker and confirm it fills the composer without sending automatically.
8. Send a message using Enter.
9. Confirm the other browser receives the message.
10. Confirm Shift+Enter creates a new line.
11. Confirm multiline content renders without losing line breaks.
12. Confirm sender labels, timestamps, and bubble alignment are clear.
13. Confirm the typing indicator appears and disappears.
14. Confirm the 500-character counter updates.
15. Confirm the send button disables for an empty message.
16. Confirm the sound toggle persists after refresh.
17. Press Escape and confirm it opens the guarded conversation-choice dialog.
18. Choose “Wróć do rozmowy” and confirm the conversation remains active.
19. Choose “Znajdź nową osobę” and confirm the current match ends and searching restarts.
20. Confirm the other browser automatically returns to searching after its stranger disconnects.
21. Use the header menu and confirm “Opuść losowy czat” returns to the homepage.

## Reporting smoke test

Use a disposable test pairing.

1. Connect two browsers.
2. Open the report dialog.
3. Confirm the dialog clearly distinguishes bot/spam from abuse.
4. Submit a bot/spam report.
5. Confirm a success message appears.
6. Repeat with an abuse report where safe and appropriate.
7. Confirm a failed/network-blocked report shows a visible error.
8. Confirm closing the report dialog does not end the conversation.
9. Confirm Escape closes the report dialog.

Do not repeatedly submit reports against ordinary production users.

## Connection-state test

1. Start a connected random chat.
2. Temporarily disable the browser network connection.
3. Confirm the offline banner appears.
4. Confirm the composer and send button disable.
5. Confirm the existing conversation remains visually readable.
6. Restore the network.
7. Confirm reconnecting/searching resumes without refreshing the page.
8. Test the “Połącz ponownie” button while offline.
9. Confirm no duplicate message is sent after reconnecting.

## Hidden-tab notification test

1. Connect two browsers.
2. Hide or background browser A.
3. Send a message from browser B.
4. Confirm browser A’s document title shows an unread count.
5. Bring browser A back to the foreground.
6. Confirm the normal title returns and the unread count clears.
7. Confirm the match-found title appears when a partner is found while the tab is hidden.

## Multi-tab safety test

Desktop only unless deliberately testing the mobile bypass.

1. Open random chat in browser tab A.
2. Open random chat in tab B in the same browser profile.
3. Confirm only one tab remains active.
4. Confirm the blocked tab explains why it is inactive.
5. Select “Użyj tej karty”.
6. Confirm tab B becomes active.
7. Confirm tab A moves to the protected multi-tab state.
8. Confirm no duplicate pairing remains active.
9. Close the active tab and confirm the remaining tab can take over after the lock expires.

## Mobile smoke test

Test at approximately 390px and 360px widths, plus a real phone where possible.

1. Confirm the header remains readable without horizontal overflow.
2. Confirm report and menu buttons remain reachable.
3. Confirm the matching screen fits without clipping.
4. Confirm the conversation area scrolls independently.
5. Confirm the composer stays visible above the browser/keyboard safe area.
6. Confirm the textarea is not covered by the software keyboard.
7. Confirm the compact next and send buttons have usable touch targets.
8. Confirm long messages wrap correctly.
9. Confirm the bottom-sheet dialogs can scroll on a short screen.
10. Confirm tapping outside a sheet closes it.
11. Confirm swiping upward during an active conversation opens the guarded next/leave sheet.
12. Confirm a normal message-list scroll does not unexpectedly leave the chat.

## Accessibility smoke test

1. Navigate all controls with Tab and Shift+Tab.
2. Confirm every interactive control has visible focus.
3. Confirm icon-only controls expose useful accessible names.
4. Confirm dialogs identify their headings and use modal semantics.
5. Confirm Escape closes open dialogs rather than immediately ending a match.
6. Test at 200% browser zoom.
7. Confirm the composer and modal actions remain reachable.
8. Enable reduced motion and confirm animations become minimal.
9. Confirm status, success, and error messages are announced appropriately.

## Regression checks

Confirm these existing behaviours remain intact:

- automatic matching after entering random chat
- stranger disconnect automatically starts a new search
- one active desktop tab per browser profile
- mobile tab-lock bypass
- admin allowlisted tab-lock bypass
- online user count updates
- typing start/stop events
- message sound and mute persistence
- hidden-tab title notifications
- report endpoint payload `{ socketId, type }`
- `join`, `leave.chat`, `send.message`, and typing Socket.IO events
- terms acceptance gating before `/chat`

## Release decision

Keep the pull request in draft until:

- `yarn build` passes
- two-browser matching and messaging pass
- next/leave choices pass
- report handling passes
- disconnect/reconnect passes
- multi-tab takeover passes
- mobile composer and modal behaviour pass
