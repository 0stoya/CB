# Final design system and accessibility polish

This branch changes the public frontend only. It adds no backend route, database migration, Socket.IO event, package dependency, Nginx setting, or GitHub workflow.

## Deploy

```bash
cd /var/www/chat
git fetch origin
git checkout agent/final-design-system-accessibility-polish
git pull origin agent/final-design-system-accessibility-polish

cd /var/www/chat/frontend
yarn install
yarn build
```

Then validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

No Prisma command, backend build, or PM2 restart is required.

## Build gate

The frontend build must complete without TypeScript or Vite errors:

```bash
cd /var/www/chat/frontend
yarn build
```

## Public shell

Test as a guest and as a signed-in user.

- The skip link appears when pressing Tab at the top of a public page.
- Activating the skip link moves focus to the main content.
- Browser Back and Forward update the page and title correctly.
- Page titles are correct for Home, Random Chat, Rooms, Friends, Account, FAQ, Contact, Terms, Privacy, and unknown routes.
- An unknown URL displays the 404 card rather than a blank page.
- Footer destinations behave as links and can be opened in a new tab.

## Desktop navigation

- Rooms and Random Chat remain visible.
- Friends and Notifications appear only when signed in.
- The account state is clear for guest, loading, and signed-in users.
- Active destinations expose a visible state.
- Keyboard focus is visible on every control.

## Mobile navigation

At 320 px, 375 px, and 430 px widths:

- Open the menu with the keyboard and touch.
- Focus moves inside the menu.
- Tab and Shift+Tab remain inside the open menu.
- Escape closes the menu.
- Closing the menu restores focus to the menu trigger.
- The backdrop closes the menu.
- Background scrolling is locked while the menu is open.
- Guest and signed-in actions remain distinct.

## Notifications

With a signed-in account:

- Opening the bell moves focus into the popover when an action is available.
- Escape closes the popover and restores focus to the bell.
- Clicking outside closes it.
- The unread count is announced by a live region.
- Mark-all-read remains functional.
- Notification deep links still open the expected room, friend, or account destination.

## Terms and age consent

Clear `terms_accepted` in local storage before testing.

- Opening Random Chat, Rooms, or Friends displays the consent dialog.
- Focus moves to the confirmation checkbox.
- Tab and Shift+Tab remain inside the dialog.
- Escape returns to the homepage.
- The backdrop returns to the homepage.
- Attempting to continue without checking the box shows a visible error and focuses the checkbox.
- Terms and Privacy links close the dialog and open the selected page.
- Accepting stores the choice and opens the originally requested destination.
- Refreshing does not request consent again after acceptance.

## Cookie choices

Clear `cookies_choice` and `cookies_accepted` in local storage.

- The privacy banner appears without covering essential page controls.
- “Tylko niezbędne” closes the banner and records `cookies_choice=essential`.
- Analytics consent is denied when essential-only is selected.
- “Zgadzam się na analityczne” records `cookies_choice=analytics`.
- Advertising consent remains denied for both choices.
- The Privacy link opens the privacy page.
- Legacy `cookies_accepted=1` still behaves as an analytics choice.
- Test with local storage disabled or restricted; the page must remain usable.

## Authentication

Test Login, Registration, Verification, Forgot Password, and Reset Password.

- Every input has a visible associated label.
- Browser autofill attributes remain correct.
- Show/Hide password controls work with mouse, touch, and keyboard.
- Password controls expose pressed state to assistive technology.
- Password mismatch feedback is visible and announced.
- Submit is disabled while a request is running.
- API success and error messages use live status or alert semantics.
- Verification with a valid token offers a direct Login action.
- Invalid or expired verification/reset links show a clear error.
- The layout remains usable when the mobile keyboard is open.
- Random Chat remains available without creating an account.

## FAQ and static pages

- FAQ items open with Enter and Space.
- Each FAQ answer remains readable at 200% zoom.
- Terms and Privacy have one H1 and sequential H2 headings.
- Legal lists and callouts do not overflow narrow screens.
- Updated dates are presented as time elements.
- Contact inputs, select, and textarea have visible labels.
- Contact character count updates.
- Contact success and error states are announced.
- Form submission still reaches `/api/contact` with category, email, subject, and message.

## Keyboard-only journey

Complete these flows without a mouse:

```text
Home → Terms consent → Random Chat → leave
Home → Rooms → Friends → Account
Home → Login → Forgot Password → Login
Home → FAQ → Contact → Terms → Privacy
Unknown URL → Home
```

Confirm:

- no focus trap outside an open dialog or drawer;
- no invisible focused control;
- no action requires hover;
- Escape closes the active modal, drawer, or popover;
- focus returns to a sensible trigger after closing overlays.

## Zoom and responsive checks

Test at:

- 320 × 568
- 375 × 667
- 430 × 932
- 768 × 1024
- 1024 × 768
- 1440 × 900
- browser zoom at 200%

Confirm there is no horizontal page scrolling, clipped text, hidden submit button, or inaccessible footer link.

## Motion and contrast

- Enable `prefers-reduced-motion`; transitions and animations should become effectively instant.
- Enable Windows High Contrast or browser forced-colours mode; primary controls and custom surfaces retain visible boundaries.
- Check text contrast for muted copy, errors, success messages, disabled controls, and focus rings.

## Existing feature regression

This branch must not change feature contracts. Re-test:

- Random Chat matching, messaging, typing, next, leave, report, reconnect, and tab lock.
- Room discovery, joining, messaging, mentions, favourites, participant drawers, and moderation.
- Friend requests, person search, private messages, offline delivery, typing, read receipts, privacy, and blocking.
- Account profile, room notification settings, password changes, session revocation, data export, and account deletion.
- Notification polling and live Socket.IO updates.

## Release decision

Keep the pull request in draft until:

1. `yarn build` passes;
2. guest and signed-in navigation pass on desktop and mobile;
3. terms and cookie choices pass after clearing local storage;
4. all five authentication modes pass;
5. keyboard-only, 200% zoom, and reduced-motion checks pass;
6. Random Chat, Rooms, Friends, Account, and Notifications show no regression.
