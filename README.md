# Momir Basic Toolkit — landscape web app

A landscape-first recreation of the Momir Basic Toolkit's functionality:

- **Card Tool** — punch a mana value into the keypad and hit **Enter** to pull a
  random card of that mana value, or hit **Random** for any card. Cards are
  fetched live from the free [Scryfall](https://scryfall.com) API.
- **Rules** — the Momir Basic deck/emblem rules text, laid out for a landscape
  screen.
- **Token** — the emblem token image, with a Print button.
- **Config** — choose which card types are eligible (default: Creature) and
  which print pool to draw from (Paper / Arena / MTGO).

The layout is a fixed left icon rail + main stage, built for a phone held
sideways. If the phone is upright, a "turn sideways" screen shows instead of
a squished layout.

## Try it right now (no install)

Just double-click `index.html` to open it in a browser. Everything works
except "Add to Home Screen" / offline caching, which require the app to be
served over `https://` (browsers block installable-PWA features on local
files).

## Install it on Android as a real app icon

To get the standalone, full-screen, home-screen-icon experience (what makes
it feel like a native app), the files need to be hosted somewhere with
`https://`. Two free, no-account-needed options:

### Option A — Netlify Drop (easiest, ~30 seconds)
1. Go to **https://app.netlify.com/drop** on your computer.
2. Drag the whole `momir` folder onto the page.
3. You'll get a live `https://something.netlify.app` URL — open that on your
   Android phone in Chrome.
4. Tap the **⋮** menu → **Add to Home screen** → **Install**.
5. Launch it from the home screen icon — it opens full-screen, locked to
   landscape, with its own icon.

### Option B — GitHub Pages
1. Create a new GitHub repo and upload all files in this folder to it.
2. In the repo, go to **Settings → Pages**, set the source to the `main`
   branch / root folder.
3. Open the resulting `https://<you>.github.io/<repo>/` URL on your phone
   and follow the same "Add to Home screen" steps above.

Either way, re-uploading a changed file updates the live app instantly —
no rebuild, no app store.

## Notes

- The Card Tool needs an internet connection (it queries Scryfall live, so
  the card pool always matches real current Magic cards). The app shell
  itself (keypad, rules, config UI) is cached for offline use once you've
  opened it online at least once.
- The Token image is hotlinked from the same source the original site used;
  if that image ever goes offline, swap the `src` in `index.html`'s Token
  section for your own image.
- No build tools required — it's plain HTML/CSS/JS, easy to tweak.
