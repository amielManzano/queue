# STP Badminton Queue

A React + Firebase app for running STP club sessions: skill-based
queueing, court management, live win/loss stats, and a payment
list you can export as an image at the end of a session.

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Connect Firebase**
   - Create a project at https://console.firebase.google.com
   - Add a Web App inside it, copy the config it gives you
   - Paste those values into `src/firebase.js` (`firebaseConfig`)
   - In the Firebase console, enable **Firestore Database** (start
     in test mode while you build; add real security rules before
     opening this up beyond your club)
    - The complete rules are in `firestore.rules`, including the
       `publicSessions` permissions required by QR links. Deploy them with:
       ```
       firebase deploy --only firestore:rules
       ```

3. **Run it**
   ```
   npm run dev
   ```
   Open the printed local URL on your iPad's browser (Safari).
   For real club use, deploy it (e.g. `npm run build` + Firebase
   Hosting, or Vercel/Netlify) so it has a stable URL you can bookmark
   or add to your iPad's home screen as a web app.

## How a session works

1. **Session tab** — type a session name (e.g. `stp-aug12`) and
   tap "Start / Join Session". This is the Firestore document
   everyone's device syncs to live — anyone who joins the same
   session name sees the same queue/courts in real time. Set your
   court fee, shuttle price, and number of courts here.
2. **Players tab** — add each player with a skill level (1–5),
   edit skill anytime, and add them to the queue.
3. **Queue & Courts tab** — tap **Auto-assign next match** to pull
   the 4 longest-waiting players and split them into two
   skill-balanced teams. Tap a name in the proposed match to swap
   them for the next person in line. Assign the match to an open
   court, **Start Game**, then **Done Game** when it finishes —
   you'll enter the winning team and how many shuttles were used,
   and everyone goes back to the end of the queue automatically.
4. **Leaderboard tab** — live win/loss, win rate, games played,
   and each player's payment (court fee split evenly among
   everyone who played + their share of shuttles used in the
   games they were actually in). Tap **Export as Image** to
   download a shareable PNG for your group chat.

## Payment formula

In Settings, choose whether shuttle costs are divided among the four
players in each game or among every registered player. Four-player mode
asks for the number of shuttles used. All-player mode applies one shuttle
price per completed game and divides it across the full player list, so no
shuttle-count input is needed.

For each player:
```
payment = (court fee ÷ number of players who played)
        + Σ over their games of (shuttles used in that game × shuttle price ÷ 4)
```

## Notes

- Firebase keeps everyone's iPad/phone in sync live during a
  session — no manual refresh needed.
- If you'd rather not set up Firebase yet, the app still runs
  fully locally in a single browser tab (state just won't sync
  across devices or survive a refresh) — useful for testing.
