# 🌐 Metaverse 2D Multiplayer Platform

🚀 **Live Demo:**  
👉 Web App: https://metaverse-repo-web-xqc5.vercel.app  
👉 Backend API: https://metaverse-repo.onrender.com  
👉 WebSocket Server: https://metaverse-repo-ws.onrender.com  

##  Test Login Credentials

You can use the following test account to explore the platform:

Username: falcon-0.12304315669971455
Password: 123456


> ⚠️ This is a public demo account. Please don’t change its password.

---


---

##  What is this?

This is a **real-time 2D multiplayer metaverse platform** inspired by Gather, Zep, and Spatial.

Users can:

- Sign up / log in
- Create and join spaces (rooms)
- Walk around in a 2D world
- See other users moving in real-time
- Chat with people in the same space
- Use avatars
- Experience true multiplayer via WebSockets

Built fully from scratch with **modern full-stack + realtime architecture**.

---

##  Features

###  Authentication & Accounts
- JWT-based authentication
- Signup / Login / Logout
- Secure password hashing using bcrypt
- Protected routes using Next.js middleware
- Persistent login using tokens

---

###  Spaces (Rooms)
- Users can:
  - Create spaces
  - Join spaces
- Each space has:
  - Width & height
  - Tile-based map
  - Collision grid
- Each space is a **separate multiplayer room**

---

###  Multiplayer System (Core Feature)

- Real-time communication using **WebSockets**
- When a user joins a space:
  - Server assigns a spawn position
  - Broadcasts to other users
- When a user moves:
  - Position is validated on server
  - Movement is broadcast to all players
- When a user leaves:
  - Others are notified instantly

---

###  Movement System

- Grid-based movement (32px steps)
- Server-authoritative movement
- Collision checked
- Invalid moves are rejected
- Everyone stays in sync

---

###  Avatars

- Each user has an avatar
- Avatar is fetched from DB on join
- Avatar is synced to all players in the room

---

###  Chat System

- Real-time chat inside each space
- Messages are broadcast only inside the room
- Timestamped messages
- Server-validated messages

---

###  Game Engine (Phaser)

- Map rendering using **Phaser 3**
- Tilemap based world
- Layers:
  - Floor
  - Walls
  - Foreground
  - Collision grid
- Smooth camera movement
- Multiplayer sprite sync

---

###  Admin System

- Admin can:
  - Create maps
  - Create elements
  - Control the world layout

---

#  Future Updates (Roadmap)

This project is just getting started. Planned features:

##   Multiple Maps

Different worlds

Different themes

Map selector UI

Teleport between maps

##  Video & Voice Chat

WebRTC based voice chat

Proximity-based audio

Optional video rooms

##  Custom Avatars

Avatar editor

Upload avatar skins

NFT/avatar marketplace (maybe 👀)

##  Private Rooms

Invite-only spaces

Password protected spaces

Team rooms

##  Interactions

Sit on chairs

Click objects

Open doors

Mini-games inside spaces


##  Mobile Support

Touch controls

Responsive UI

PWA mode

##  Architecture

metaverse-repo/
├── apps/
│ ├── web/ (Next.js frontend)
│ ├── http/ (Express REST API)
│ └── ws/ (WebSocket realtime server)
│
├── packages/
│ └── db/ (Prisma + DB client)


---

##  Tech Stack

###  Frontend
- Next.js 16 (App Router)
- React
- Tailwind CSS
- Phaser 3 (Game Engine)
- React Query
- Axios
- Zod

---

###  Backend (HTTP API)
- Node.js
- Express
- Prisma ORM
- PostgreSQL (Neon)
- JWT Authentication
- bcrypt

---

###  Realtime Server
- Node.js
- WebSocket (`ws`)
- JWT verification
- Room Manager
- Server-authoritative movement

---

###  Database
- PostgreSQL (Neon)
- Prisma ORM

---

###  Dev & Infra
- Turborepo (Monorepo)
- Vercel (Frontend)
- Render (Backend + WS)
- GitHub

---

##  Security

- Password hashing using bcrypt
- JWT authentication
- Token verification on WebSocket join
- Server-authoritative movement (anti-cheat)
- Protected API routes

---

## 🌍 How Multiplayer Works (High Level)

1. User logs in → gets JWT
2. Frontend connects to WebSocket
3. Sends:
```bash 
{
  "type": "join",
  "payload": {
    "spaceId": "...",
    "token": "JWT"
  }
}
```
4.Server:

Verifies token

Fetches user from DB

Assigns spawn

Adds user to room

Broadcasts presence

Movement:
```bash
{
  "type": "move",
  "payload": { "x": 64, "y": 128 }
}
```
# 🚀 How to Run Locally
1️⃣ Clone repo
```bash
git clone https://github.com/your-username/metaverse-repo.git
cd metaverse-repo
```
2️⃣ Install deps
```bash
npm install

```
3️⃣ Setup env

Create .env in:
```bash
apps/http
apps/ws
packages/db
```
4️⃣ Run everything
```bash
npm run dev
```
# 🧑‍💻 Author

Built by Hussain Taher Kagalwala
BITS Pilani, Hyderabad Campus
