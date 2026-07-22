# Account dashboard UI/UX polish deployment

This release changes only the public frontend. It does not add a database migration, backend route, package dependency or GitHub workflow.

## Build and deploy

```bash
cd /var/www/chat

git fetch origin
git checkout agent/account-dashboard-ui-ux-polish
git pull origin agent/account-dashboard-ui-ux-polish

cd /var/www/chat/frontend
yarn install
yarn build

sudo nginx -t
sudo systemctl reload nginx
```

No Prisma command, backend build or PM2 restart is required.

## Release gate

Do not merge until `yarn build` completes successfully and all checks below pass.

## Desktop checks

Test at approximately 1440 px, 1280 px and 1024 px wide.

- Open `/konto` while signed in.
- Confirm the sidebar remains visible while scrolling.
- Confirm the active section is visually clear.
- Confirm the header links open Friends and Rooms.
- Confirm the logout action returns to the homepage.
- Confirm cards do not overflow or overlap.

## Mobile and tablet checks

Test at approximately 820 px, 768 px, 430 px, 390 px and 360 px wide.

- Confirm the desktop sidebar becomes a mobile drawer.
- Confirm the drawer opens from the menu button.
- Confirm the drawer closes from its close button, backdrop and Escape key.
- Confirm body scrolling is locked while the drawer is open.
- Confirm the horizontal section tabs can be scrolled.
- Confirm each section is reachable from both the drawer and the tabs.
- Confirm forms remain readable above the mobile keyboard.
- Confirm buttons remain at least comfortably touchable.
- Confirm the deletion confirmation fields and button do not overflow.

## Profile

- Confirm nickname and e-mail are displayed correctly.
- Confirm the e-mail field cannot be edited.
- Confirm the save button remains disabled when the nickname is unchanged.
- Change the nickname to another valid value and save.
- Confirm the success message appears.
- Confirm the updated nickname appears in the profile summary.
- Restore the original nickname if this is a production test account.
- Confirm invalid or already-used nicknames show a readable error.

## Privacy

- Change the friend-request policy.
- Toggle private messages, online status and last-seen visibility.
- Confirm the save button activates only after a change.
- Save and reload the page.
- Confirm the saved values remain selected.
- Confirm blocked users are listed when present.
- Unblock a disposable test user and confirm the row disappears.
- Confirm the Friends shortcut opens its privacy/settings view.

## Rooms

- Confirm membership, favourite and moderator totals are accurate.
- Confirm official, owner, moderator, member, favourite and auto-join badges display correctly.
- Toggle mention notifications for a disposable room.
- Reload the page and confirm the setting persists.
- Open a room from its row and confirm the correct room is selected.
- Confirm the empty state is useful for an account with no memberships.

## Security and password

Use a disposable test account for password changes.

- Confirm all password inputs use password masking.
- Confirm the button remains disabled until:
  - the current password is present;
  - the new password has at least 10 characters;
  - both new-password fields match.
- Confirm the password-strength indicator updates.
- Enter an incorrect current password and confirm a readable error.
- Change the password successfully.
- Confirm other sessions are revoked as documented.
- Confirm the new password works at the next login.

## Sessions

Use two browsers or a normal and private window.

- Sign into the same account on both devices.
- Confirm both sessions appear.
- Confirm the current session is clearly marked.
- Confirm device, approximate location, last activity and expiry are readable.
- Revoke the other session and confirm it disappears.
- Confirm the revoked browser loses access.
- Sign in again on the second browser.
- Use “Wyloguj pozostałe” and confirm only the current session remains.
- Test revoking the current session and confirm the app returns to login.

## Data export

- Select Data and account.
- Download the export.
- Confirm a JSON file is downloaded.
- Confirm the file opens and contains the expected account sections.
- Confirm no error is shown after a successful download.

## Account deletion

Use only a disposable test account.

- Confirm the delete button is disabled initially.
- Enter a password without the exact confirmation phrase and confirm it stays disabled.
- Enter `USUŃ KONTO` without a password and confirm it stays disabled.
- Enter both required values.
- Confirm the native final warning appears.
- Cancel and confirm no deletion occurs.
- Repeat and confirm deletion using the disposable account.
- Confirm the account is signed out and returned to the homepage.
- Confirm the deleted credentials no longer sign in.

## Navigation and state

- Open `/konto#privacy`, `/konto#rooms`, `/konto#security`, `/konto#sessions` and `/konto#data` directly.
- Confirm the requested section opens.
- Refresh each section and confirm it remains selected.
- Confirm navigation between account sections does not trigger extra backend polling.

## Accessibility

- Navigate the complete dashboard using only Tab, Shift+Tab, Enter, Space and Escape.
- Confirm every interactive control has a visible focus state.
- Confirm custom toggles work from the keyboard.
- Confirm status and error messages are announced appropriately.
- Confirm the mobile menu has an accessible label and expanded state.
- Enable reduced motion and confirm transitions are effectively removed.
- Zoom the browser to 200% and confirm the page remains usable.

## Regression checks

- Friends still opens and works normally.
- Rooms still opens and deep-links to the selected room.
- Notification links to account sections still work.
- Logout invalidates the current session.
- Changing a nickname, password or session does not expose raw IP information.
- No console error appears during normal account navigation.
