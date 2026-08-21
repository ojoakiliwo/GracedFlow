# GracedFlow — Infinitely Graced Church Management System

A world-class, all-in-one ministry management platform for **Infinitely Graced Church**.
It runs the entire church from one place: members, workers, departments (rooms),
projects & visions, meetings, tasks, giving, prayer, bulk/segmented SMS & email,
automated reminders and greetings, and one-click social-media broadcasting — with a
beautiful public website in front.

Built as an npm-workspaces monorepo:

- **`server/`** — Express + TypeScript API with a SQLite database (via `better-sqlite3`),
  JWT auth, role-based access control, a messaging engine, and a cron scheduler.
- **`client/`** — Vite + React + TypeScript SPA styled with Tailwind CSS v4 (royal
  purple + glory gold theme, Fraunces + Inter typography).

## Feature overview

### People & discipleship
- Full member profiles: contact, gender, marital status, **date of birth**,
  **wedding anniversary**, occupation, address, join date, photo.
- Spiritual class segmentation (New Convert, New Believer, Growing, Established/Born
  Again, General Worker, Choir, Leader) and membership status.
- Per-member **spiritual growth timeline** (salvation, baptisms, discipleship,
  promotions) and **support & care** records (welfare, financial, counseling, visitation).
- Giving history per member.

### Rooms, departments & collaboration
- Departments/arms (Pastoral, Choir & Worship, Ushering, Media, Evangelism, Children…)
  plus a **General "All Workers" room**.
- Each room has a membership roster and a **live discussion/meeting board (chat)**.
- **Meetings** (departmental or general) with schedule, location and online link.
- **Task board** (to-do / in-progress / done) with assignment, priority and due dates.

### Projects & visions
- Track **completed**, **ongoing**, and **future (vision)** projects with progress,
  budget vs. amount raised, and public/private visibility.
- Public projects appear automatically on the church website.

### Communication
- **Single & bulk SMS and Email**, personalized with `{{first_name}}` etc.
- **Audience segmentation**: whole church, by spiritual class, by department, by role,
  or an individual — with a live audience **preview** and a per-recipient **outbox** log.
- Pluggable providers: **Twilio** (SMS) and **SMTP/nodemailer** (email). Without
  credentials they run in safe **dry-run** mode so the full flow is testable.

### Automations (runs on autopilot)
- **Saturday 6:00 PM** — reminder to all members for Sunday service.
- **Wednesday 6:00 AM** — reminder to all members for the prayer meeting.
- **Daily 7:00 AM** — private **birthday** and **wedding-anniversary** greetings to
  members celebrating that day.
- Each automation can also be triggered manually and every run is logged.

### Social broadcast
- Compose once and **distribute to all social accounts** (Facebook, X, Instagram,
  YouTube, Telegram, WhatsApp) with a per-platform distribution log. Adapters are
  pluggable; unconnected platforms are queued in preview mode.

### Giving
- Public **giving page** (tithes, offerings, seed, building, missions, donations) that
  creates a pending gift with a reference and bank details.
- Admin giving ledger with totals by type and one-click confirmation.

### Public website
- Elegant landing page, About, **Give**, and **Prayer request** pages, live service
  times, public events and projects.

### Security & roles
- JWT authentication; roles ranked **member → worker → pastor → admin → super_admin**,
  enforced on every protected endpoint. Full audit log.

## Prerequisites
- Node.js `>= 20` (developed against Node 22)

## Getting started

```bash
npm install        # install all workspaces
npm run dev        # run API (:3001) and client (:5173) together
```

Open http://localhost:5173. The API auto-creates and seeds the SQLite database on first
run.

**Demo login:** `admin@igc.church` / `Grace@2024`

### Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run API + client together |
| `npm test` | Run the server API test suite (Vitest) |
| `npm run typecheck` | Type-check both workspaces |
| `npm run build` | Build server and client |
| `npm run seed --workspace server` | Re-seed a fresh database |

## Configuration (environment variables, all optional)

Copy `server/.env.example` to `server/.env` to enable real integrations.

| Area | Variables |
| --- | --- |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| SMS (Twilio) | `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| Email (SMTP) | `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` |
| Social | `SOCIAL_CONNECTED=facebook,twitter,...` |
| Giving | `GIVING_BANK_NAME`, `GIVING_ACCOUNT_NAME`, `GIVING_ACCOUNT_NUMBER`, `GIVING_ONLINE_URL` |
| Scheduler | `SCHEDULER_ENABLED`, `TZ_NAME` (default `Africa/Lagos`) |

Without these, SMS/email/social run in **dry-run** mode (messages are composed, targeted
and logged) so everything is fully demonstrable out of the box.

## Notes on external integrations

To go fully live you only need to add credentials — the adapters are already wired:
- **Twilio** for real SMS, **SMTP/SendGrid** for real email.
- Social platform API tokens (Meta, X, YouTube, Telegram, WhatsApp Cloud API).
- A payment gateway (e.g. Paystack/Flutterwave) can be attached to the giving flow.

## Cloud Agent environment

`.cursor/environment.json` configures the Cloud Agent dev environment: `npm install`
plus `server` (:3001) and `client` (:5173) dev-server terminals.
