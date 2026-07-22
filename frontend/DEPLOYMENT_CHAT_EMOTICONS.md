# Chat emoticon conversion rollout

## Scope

This frontend-only change converts familiar text emoticons into emoji when chat messages are displayed.

The original message text sent through Socket.IO or stored by the backend is unchanged.

Supported conversions:

| Typed | Displayed |
| --- | --- |
| `:)` or `:-)` | 🙂 |
| `:D` or `:-D` | 😄 |
| `;)` or `;-)` | 😉 |
| `:(` or `:-(` | 🙁 |
| `:'(` or `:-'(` | 😢 |
| `:P` or `:-P` | 😛 |
| `:X` or `:-X` | 🤐 |
| `:O` or `:-O` | 😮 |
| `:/` or `:-/` | 😕 |
| `<3` | ❤️ |
| `XD` | 😂 |

## Deploy

```bash
cd /var/www/chat

git fetch origin
git checkout agent/chat-emoticon-conversion
git pull origin agent/chat-emoticon-conversion

cd /var/www/chat/frontend
yarn install
yarn build

sudo nginx -t
sudo systemctl reload nginx
```

No Prisma migration, backend build or PM2 restart is required.

## Random Chat

Use two browser sessions and confirm:

- `hej :)` displays as `hej 🙂` for both participants
- `:D :X <3` displays as `😄 🤐 ❤️`
- a message containing only `:)` displays as a larger standalone emoji
- incoming and outgoing message alignment remains correct
- typing, send, next-chat and report actions still work

## Public Rooms

Use two users or a user and guest and confirm:

- emoticons convert in new messages and loaded room history
- mixed text such as `świetnie :D` displays correctly
- mentions still highlight correctly in `@nickname hej :)`
- message reporting and moderator deletion still target the correct message
- full-width message layout and room directory categories remain unchanged

## Private messages

Use two accounts and confirm:

- emoticons convert in the active conversation
- the conversation preview also displays converted emoticons
- delivery and read receipts remain correct
- offline messages convert when loaded after sign-in
- unread counters, typing and online presence remain correct

## Safety cases

Confirm these values are not changed incorrectly:

- `https://chati.online`
- `http://example.com/path`
- `abcXD`
- `tekst<3`

Confirm punctuation works:

- `hej :)!`
- `(XD)`
- `smutno :'(`

## Responsive check

Test desktop and mobile widths:

- emoji-only messages do not overflow their bubble or conversation column
- message timestamps and receipts remain aligned
- the mobile keyboard and composer are unaffected

## Rollback

```bash
cd /var/www/chat
git checkout main
cd frontend
yarn build
sudo nginx -t
sudo systemctl reload nginx
```
