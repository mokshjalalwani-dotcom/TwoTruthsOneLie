# 🎭 Two Truths, One Room

A real-time multiplayer party game. Each round, one player secretly writes 2 truths and 1 lie — everyone else votes on which is the fake.

**Live demo:** _Add your Vercel URL here after deploying_

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 18 + Vite, plain CSS          |
| Backend  | Node.js + Express + Socket.io       |
| State    | In-memory (`Map<roomCode, Room>`)   |
| Deploy   | Frontend → Vercel · Backend → Render|

---

## Local Development

### Prerequisites
- Node.js 18+

### 1. Clone & install

```powershell
git clone <your-repo-url>
cd TwoTruthsOneLie

# Server
cd server
npm install
Copy-Item .env.example .env   # edit CLIENT_URL if needed

# Client
cd ..\client
npm install
Copy-Item .env.example .env   # edit VITE_SERVER_URL if needed
```

### 2. Run both servers

Open **two** terminal windows:

```powershell
# Terminal 1 — backend
cd server
npm run dev
# → http://localhost:3001

# Terminal 2 — frontend
cd client
npm run dev
# → http://localhost:5173
```

### 3. Play

Open `http://localhost:5173`, create a room, share the link with friends (or open more tabs).

---

## Deployment

### Backend → Render

1. Push this repo to GitHub.
2. On [Render](https://render.com), create a new **Web Service**.
3. Set **Root Directory** to `server`.
4. **Build command:** `npm install`
5. **Start command:** `npm start`
6. Add environment variables:
   | Key          | Value                          |
   |--------------|--------------------------------|
   | `CLIENT_URL` | Your Vercel URL (set after frontend deploy) |

> **Deploy backend first** to get its public URL, then use that URL when configuring the frontend.

### Frontend → Vercel

1. On [Vercel](https://vercel.com), import the GitHub repo.
2. Set **Root Directory** to `client`.
3. **Framework Preset:** Vite
4. Add environment variable:
   | Key               | Value                           |
   |-------------------|---------------------------------|
   | `VITE_SERVER_URL` | Your Render service's public URL |
5. Deploy. Once you have the Vercel URL, go back to Render and set `CLIENT_URL` to that URL, then redeploy the backend.

### Chicken-and-egg order

```
1. Deploy backend on Render  →  get https://yourapp.onrender.com
2. Deploy frontend on Vercel with VITE_SERVER_URL=https://yourapp.onrender.com
3. Get Vercel URL: https://yourapp.vercel.app
4. Update Render CLIENT_URL=https://yourapp.vercel.app → redeploy backend
```

---

## Game Flow

```
Lobby → Writing (75s) → Voting (25s) → Reveal → [next round | Game Over]
```

- **Subject** writes 3 statements (2 true, 1 lie) in private
- **Other players** vote which they think is the lie
- **Scoring:** +1 per correct guesser · Subject gets +1 per player fooled
- Host controls round count (3–10) and advances rounds
- Subject rotates so everyone gets a turn before repeats

---

## Project Structure

```
TwoTruthsOneLie/
├── server/
│   ├── index.js        # Express + Socket.io entry point
│   ├── gameLogic.js    # State machine, scoring, room cleanup
│   ├── utils.js        # Room code generator, shuffle helper
│   └── .env.example
└── client/
    ├── src/
    │   ├── pages/      # Home, Room
    │   └── components/ # Lobby, Writing, Waiting, Voting, Reveal, GameOver, …
    ├── public/         # og-image.png, favicon.svg
    ├── vercel.json     # SPA rewrite (prevents 404 on /room/:code refresh)
    └── .env.example
```
