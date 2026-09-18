# Role-Based Realtime Chat App

Full-stack take-home assessment implementation: JWT authentication, a three-role
authorization system (ADMIN / MODERATOR / MEMBER), and real-time chat channels.

- **Backend**: Node.js, Express, TypeScript, Prisma (PostgreSQL), Socket.IO, JWT, Zod, bcryptjs
- **Frontend**: React (Vite, TypeScript), react-router-dom, axios, socket.io-client

```
chat-app/
  backend/   Express API + Socket.IO server
  frontend/  React SPA
```

## 1. Prerequisites

- Node.js 18+
- A running PostgreSQL instance (local install, Docker, or a hosted DB)

## 2. Backend setup

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` (already done in this bundle) and set `DATABASE_URL`
to point at your Postgres instance, e.g.:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chatapp?schema=public"
```

If you don't have Postgres running locally, the fastest option is Docker:

```bash
docker run --name chatapp-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=chatapp -p 5432:5432 -d postgres:16
```

Then run migrations and seed the database:

```bash
npx prisma migrate dev --name init
npm run seed
```

Start the API + Socket.IO server:

```bash
npm run dev
```

The server listens on `http://localhost:4000` by default (`PORT` in `.env`).

## 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:5173` and talks to the API at the URL set in
`frontend/.env` (`VITE_API_URL`, defaults to `http://localhost:4000`).

## 4. Test credentials

All seeded accounts share the same password: **`Password123!`**

| Email                | Role      |
|-----------------------|-----------|
| admin@test.com        | ADMIN     |
| moderator@test.com    | MODERATOR |
| member@test.com       | MEMBER    |
| ayush@test.com        | MEMBER    |
| rahul@test.com        | MEMBER    |

The seed script also creates:
- `general` — public channel, all seeded users are joined
- `announcements` — public channel
- `private-ops` — marked private (still visible/joinable in this simple demo; only ADMIN/MODERATOR are pre-joined)

You can also register new accounts from the UI — every self-registered user is
always created as `MEMBER`; there is no role selector on the registration form,
and the API never accepts a role from the client on `POST /api/auth/register`.

## 5. What's implemented

**Auth**
- `POST /api/auth/register` — Zod-validated, bcrypt-hashed password, role hardcoded to MEMBER
- `POST /api/auth/login` — issues JWT access + refresh tokens
- `POST /api/auth/refresh` — rotates refresh tokens (old one revoked, new pair issued)
- `POST /api/auth/logout` — revokes the given refresh token
- `GET /api/auth/me` — current user from access token

**Roles & permissions (enforced server-side, not just hidden in the UI)**
- Channel create/update/delete: **ADMIN only**
- Join/leave a channel, view participants: any authenticated user
- Mute/unmute a member: **ADMIN or MODERATOR**
- Delete a message: the message's own author, or **ADMIN/MODERATOR** for any message
- Change a user's role: **ADMIN only** (and an admin cannot change their own role)
- Sending a message requires an active `ChannelMember` row — leaving a channel
  immediately blocks further messages from that user in that channel

**Real-time (Socket.IO)**
- JWT-authenticated socket handshake
- Room-per-channel (`channel:<id>`) broadcast of new messages, deletions, joins/leaves, mute/unmute, and channel deletion
- Typing indicators and join/leave presence events
- Server re-checks active channel membership before allowing a socket to join a room

**Frontend**
- Login / Register (no role field) pages
- Dashboard: browse channels, join/leave, ADMIN-only create/delete channel and a
  role-management table
- Chat page: live message list, participant list with mute/unmute controls for
  ADMIN/MODERATOR, delete-message buttons gated by ownership/role, typing indicator

## 6. Notes

- Passwords are hashed with `bcryptjs` (pure JS, avoids native build issues in
  grading environments) rather than the native `bcrypt`/`argon2` packages — this
  satisfies the "bcrypt or argon2" requirement while staying dependency-light.
- Refresh tokens are stored server-side (`RefreshToken` table) so logout and
  rotation can actually invalidate them, rather than relying on stateless JWTs alone.
- "Private" channels are modelled with an `isPrivate` flag but, for simplicity in
  this assessment, are still listed and joinable by any authenticated user (only
  channel creation and destructive actions are role-restricted). This can be
  tightened to invite-only membership if required.
