# Public rooms UI/UX rollout

This release changes only the public frontend. It does not add a database migration, backend route, package dependency or GitHub workflow.

## Deploy the branch

```bash
cd /var/www/chat

git fetch origin
git checkout agent/rooms-ui-ux-polish
git pull origin agent/rooms-ui-ux-polish

cd /var/www/chat/frontend
yarn install
yarn build
```

Validate Nginx before reloading it:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

A backend or PM2 restart is not required.

## Desktop discovery test

Use a signed-out browser window at approximately 1440 px wide.

1. Open `/pokoje` and accept the terms prompt if required.
2. Confirm the room directory appears on the left and participant area appears on the right after joining.
3. Confirm room cards show:
   - room name and topic
   - official status where applicable
   - current online count
   - guest or account-only access
   - slow-mode status when enabled
4. Search by room name and topic.
5. Switch between **Wszystkie** and **Oficjalne**.
6. Enter a guest nickname shorter than three characters and confirm joining is blocked with a clear message.
7. Enter a valid nickname and join a guest-enabled room.
8. Attempt an account-only room and confirm the friendly sign-in state appears rather than a generic error.

## Signed-in discovery test

Use a verified account.

1. Confirm the **Ulubione** filter is visible.
2. Favourite and unfavourite a room from the directory.
3. Confirm favourites sort above ordinary community rooms.
4. Open more than one room and switch between room tabs.
5. Close a background room and confirm the current room remains active.
6. Enable and disable auto-join from the room actions menu and from the information drawer.
7. Create a community room and confirm it opens immediately after creation.

## Active-room conversation test

1. Confirm the title area shows:
   - room slug and topic
   - online count
   - guest/account access
   - official, owner, moderator or locked state where applicable
2. Send a normal message with Enter.
3. Add a line break using Shift+Enter.
4. Confirm the character counter changes and warns near the 500-character limit.
5. Confirm your own messages are visually distinct without becoming difficult to read.
6. Confirm long words, links and multiline messages wrap without expanding the page.
7. Confirm system join and leave messages remain visible but visually quiet.
8. Confirm message report actions work.
9. As a moderator, confirm delete-message still works after confirmation.

## Mentions and notification test

Use two verified accounts in the same room.

1. Type `@` followed by the first letters of the other nickname.
2. Confirm mention autocomplete appears above the multiline composer.
3. Select the suggested nickname and send the message.
4. Confirm the mention is highlighted for both users and highlighted differently for the mentioned user.
5. Confirm the mentioned account receives a notification.
6. Open the notification deep link and confirm the referenced message scrolls into view and receives temporary focus styling.

## Participant and profile test

1. Open the participant list.
2. Confirm owner and moderator roles appear before ordinary members.
3. Open a participant profile from the list and from a message avatar.
4. Confirm friend, block and report actions remain available for another verified account.
5. Confirm your own profile does not show actions against yourself.
6. As a moderator, verify:
   - kick
   - ten-minute mute
   - room ban
7. As the owner, verify moderator promotion and removal.
8. Confirm every destructive action remains explicit and the result appears as a success or error notice.

## Room settings and moderation test

As a room owner or moderator:

1. Open **Ustawienia pokoju**.
2. Change the topic and confirm it updates immediately.
3. Toggle guest access and confirm the directory metadata updates.
4. Enable slow mode and confirm the title and composer show its value.
5. Lock the room and confirm ordinary participants see a clear locked banner and disabled composer.
6. Unlock the room and confirm composing is restored.
7. Submit a room report and confirm the protected-snapshot explanation is visible.

## Connection-state test

1. Join a room and temporarily stop the backend process or disable the browser network.
2. Confirm the room shows a clear offline banner.
3. Confirm the composer is disabled while disconnected.
4. Restore the service or network.
5. Confirm the banner disappears after reconnection.
6. Confirm the room socket does not briefly disconnect merely because account information finishes loading.

## Tablet test

Test around 900–1180 px wide.

1. Confirm the room directory remains visible until the narrower breakpoint.
2. Confirm the participant list opens as a right-side drawer.
3. Confirm the drawer closes through:
   - close button
   - backdrop
   - Escape key
4. Confirm the room information drawer remains usable and has an explicit close button.

## Mobile test

Test at 390 × 844 and 360 × 740.

1. Confirm the conversation occupies the main screen rather than sitting below the full room list.
2. Open the room directory from the header.
3. Confirm search, filters, guest nickname and room cards are usable in the full-height drawer.
4. Join a room and confirm the drawer closes automatically.
5. Open participants and room information from the title area.
6. Confirm the notification bell does not overlap room controls.
7. Confirm the composer remains visible when the virtual keyboard opens.
8. Confirm the send target is large enough for touch and respects the bottom safe area.
9. Confirm profile cards and settings/report dialogs appear as bottom sheets.
10. Confirm no horizontal page scrolling occurs.

## Accessibility test

1. Navigate the directory, tabs, title actions, messages and composer using only the keyboard.
2. Confirm visible focus outlines appear.
3. Press Escape to close drawers, user cards and dialogs.
4. Confirm drawer and dialog close buttons have meaningful accessible names.
5. Confirm notification, connection and moderation messages are announced through status or alert regions.
6. Enable reduced motion and confirm drawers/dialogs no longer use meaningful animation.
7. Zoom the page to 200% and confirm primary room actions remain reachable.

## Regression checks

Confirm these existing behaviours still work:

- terms acceptance before entering rooms
- guest room access
- verified account room access
- automatic room joining
- multiple open rooms
- favourites and auto-join
- room creation
- public message history
- mentions and notification processing
- message reporting and deletion
- participant friend/block/report actions
- room kick, mute, ban and moderator controls
- room topic, guest access, slow mode and lock settings
- room close and administration archive events

Keep the pull request in draft until `yarn build` and the desktop/mobile smoke tests pass on the server.
