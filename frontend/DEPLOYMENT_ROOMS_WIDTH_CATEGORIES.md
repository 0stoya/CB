# Rooms width and categories rollout

## Scope

This frontend-only refinement:

- lets room message rows use the full width of the centre workspace
- reduces excessive horizontal padding in the conversation
- groups official rooms into Towarzyskie, Regionalne and Tematyczne
- keeps user-created rooms under Społeczności
- preserves room search, Official and Favourites filters
- does not change room APIs, sockets, database models or moderation behaviour

## Deployment

```bash
cd /var/www/chat

git fetch origin
git checkout agent/rooms-width-categories-refinement
git pull origin agent/rooms-width-categories-refinement

cd /var/www/chat/frontend
yarn install
yarn build

sudo nginx -t
sudo systemctl reload nginx
```

No Prisma command, backend build or PM2 restart is required.

## Desktop smoke test

1. Open `/pokoje` at 1440px or wider.
2. Join an active room.
3. Confirm message rows extend across the available centre column rather than being limited to a centred 820px block.
4. Confirm incoming messages stay aligned left and your messages stay aligned right.
5. Confirm long messages wrap normally and do not run underneath the participant column.
6. Confirm the composer remains full width and usable.

## Directory grouping

1. Open the All filter.
2. Confirm official social rooms such as `Towarzyski`, `Po 30` and `Po 40` appear under **Towarzyskie**.
3. Confirm city and location rooms such as `Poznań`, `Warszawa`, `3miasto`, `Polska` and `UK` appear under **Regionalne**.
4. Confirm other official rooms such as `Na ryby` and `Na wakacje` appear under **Tematyczne**.
5. Confirm user-created rooms appear under **Społeczności**.
6. Confirm each heading shows the number of currently visible rooms in that group.

## Filters and search

1. Select Official and confirm Społeczności disappears.
2. Select Favourites and confirm only favourite rooms and their relevant headings remain.
3. Search for a city and confirm only the Regionalne heading and matching rooms remain.
4. Search for a thematic room and confirm only the relevant heading remains.
5. Clear search and confirm all applicable groups return.
6. Change online presence and confirm the directory remains grouped.

## Mobile test

1. Open the room directory drawer on a narrow phone viewport.
2. Confirm category headings and room cards fit without horizontal scrolling.
3. Confirm the list scrolls normally.
4. Join rooms from each category.
5. Confirm the room drawer closes after joining.
6. Confirm the conversation and composer remain usable with the software keyboard open.

## Regression checks

- join and leave rooms
- switch between open room tabs
- favourite and unfavourite a room
- auto-join controls
- create a community room
- guest nickname joining
- account-only room handling
- mentions and notification deep links
- member list and information drawer
- reporting and moderation actions
- offline and reconnect states

## Rollback

```bash
cd /var/www/chat
git checkout main
git pull origin main

cd frontend
yarn build

sudo nginx -t
sudo systemctl reload nginx
```
