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
- Elegant landing page, About the church, **About the Founding President**, **Give**,
  and **Prayer request** pages, live service times, public events and projects.

### Security & roles
- JWT authentication; roles ranked **member → worker → pastor → admin → super_admin**,
  enforced on every protected endpoint. Full audit log.

## Prerequisites
- Node.js `>= 20` (developed against Node 22)

## Run it yourself (view the app locally)

1. Install **Node.js 20+** (https://nodejs.org), **Git**, and **PostgreSQL 14+**.
2. Create a local database and point the app at it:

   ```bash
   createdb gracedflow    # or use any Postgres instance
   export DATABASE_URL="postgres://<user>:<password>@127.0.0.1:5432/gracedflow"
   ```

3. Get the code and start it:

   ```bash
   git clone https://github.com/ojoakiliwo/GracedFlow.git
   cd GracedFlow
   git checkout cursor/infinitely-graced-church-system-f8d5   # this branch, until it's merged
   npm install        # install everything
   npm run dev        # start API (:3001) + website/app (:5173)
   ```

4. Open **http://localhost:5173** in your browser.
   - Public site: `/`, `/about`, `/founder`, `/give`, `/prayer`.
   - Ministry portal: click **Member Login** (or go to `/login`).

**Demo login:** `admin@igc.church` / `Grace@2024`

The API auto-creates the schema and seeds demo data on first run. Everything (SMS, email,
payments, social) works in safe **simulated mode** until you add credentials, so you can
explore the whole system immediately.

## Deploy to Vercel

The app is Vercel-ready: the React client is served as static files, the Express API runs
as a **serverless function** (`api/[...path].ts`), the database is **serverless Postgres**,
and the automations run via **Vercel Cron**.

### 1. Create a Postgres database
In the Vercel dashboard → **Storage** → create a **Postgres** database (Neon). Copy its
connection string — Vercel exposes it as `DATABASE_URL`/`POSTGRES_URL` automatically when
the store is linked to the project.

### 2. Import the repo
Vercel dashboard → **Add New… → Project** → import `GracedFlow`. Vercel reads
`vercel.json` (build command, output dir, functions, cron), so no framework tweaking is
needed. (CLI alternative: `npm i -g vercel && vercel && vercel --prod`.)

### 3. Set environment variables (Project → Settings → Environment Variables)

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | From your Vercel/Neon Postgres (auto-set if the store is linked) |
| `JWT_SECRET` | Long random string |
| `CRON_SECRET` | Long random string — required for the automation endpoints |
| `APP_URL` | Your production URL, e.g. `https://your-app.vercel.app` |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | For live giving (optional) |
| `SMS_PROVIDER=twilio`, `TWILIO_*` | For live SMS (optional) |
| `EMAIL_PROVIDER=smtp`, `SMTP_*` | For live email (optional) |
| `SOCIAL_CONNECTED` | Connected social platforms (optional) |

### 4. Deploy
Click **Deploy**. On first request the API creates the schema and seeds demo data. Visit
your URL — the public site and `/login` (admin@igc.church / Grace@2024) both work.

### 5. Paystack webhook (if using live giving)
In Paystack → **Settings → Webhooks**, set the URL to
`https://<your-app>.vercel.app/api/webhooks/paystack`.

### Automations on Vercel Cron
`vercel.json` schedules three cron jobs (UTC): Sunday-service reminder (Sat 17:00),
prayer reminder (Wed 05:00) and daily celebrations (06:00) — matching 6 PM / 6 AM / 7 AM
West Africa Time. Vercel sends `Authorization: Bearer $CRON_SECRET` to
`/api/cron/:job`, which the endpoint verifies.

> Note: Vercel's **Hobby** plan runs cron jobs at most once per day. For the exact
> weekly Saturday/Wednesday schedules use the **Pro** plan, or trigger the same endpoints
> from any external scheduler (GitHub Actions, cron-job.org) with the `CRON_SECRET`
> bearer token.

> Deploying elsewhere instead? Host the API on any Node host (it self-runs node-cron for
> automations) and the built client (`client/dist`) on any static host.

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
| Payments (Paystack) | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYMENT_CURRENCY`, `APP_URL` |
| Social | `SOCIAL_CONNECTED=facebook,twitter,...` |
| Giving (bank) | `GIVING_BANK_NAME`, `GIVING_ACCOUNT_NAME`, `GIVING_ACCOUNT_NUMBER`, `GIVING_ONLINE_URL` |
| Scheduler | `SCHEDULER_ENABLED`, `TZ_NAME` (default `Africa/Lagos`) |

Without these, SMS/email/payments/social run in **simulated** mode (records are created,
targeted and logged) so everything is fully demonstrable out of the box. The
**Settings → Integrations** page shows the live/simulated status of each and lets admins
send a test SMS/email.

## Going live with integrations

The adapters are already wired — you only add credentials.

### Payments — Paystack
1. Create a Paystack account and copy your keys from
   Dashboard → Settings → API Keys & Webhooks.
2. Set `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, and `APP_URL` (your public site URL),
   then restart the API. The **Card / Online** giving option now creates a real Paystack
   checkout; donors are redirected back to `/give/callback` which verifies the payment.
3. Add a webhook in Paystack pointing to `https://<your-api-host>/api/webhooks/paystack`.
   Incoming `charge.success` events are signature-verified (HMAC-SHA512) and auto-confirm
   the donation in the giving ledger.

### SMS — Twilio
Set `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`.
Real SMS then sends for single/bulk/segmented messages and the automated reminders.

### Email — SMTP / SendGrid
Set `EMAIL_PROVIDER=smtp` plus `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`EMAIL_FROM`. Works with SendGrid, Mailgun, Gmail, etc.

### Social
Set `SOCIAL_CONNECTED` to the platforms you have API tokens for (Meta/Facebook,
X/Twitter, Instagram, YouTube, Telegram, WhatsApp Cloud API), and plug the tokens into
`server/src/comms.ts` (`publishToPlatform`).

## Cloud Agent environment

`.cursor/environment.json` configures the Cloud Agent dev environment: `npm install`
plus `server` (:3001) and `client` (:5173) dev-server terminals.
