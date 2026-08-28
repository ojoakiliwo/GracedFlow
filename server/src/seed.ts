import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { db, initSchema } from "./db.js";
import { hashPassword } from "./auth.js";
import { newId } from "./util.js";

export const DEMO_MEMBER_EMAILS = [
  "admin@igc.church",
  "pastor@igc.church",
  "worker@igc.church",
  "blessing.eze@example.com",
  "samuel.johnson@example.com",
  "peace.bello@example.com",
  "daniel.ade@example.com",
  "mary.okoro@example.com",
  "joshua.ibrahim@example.com",
  "ruth.danjuma@example.com",
  "caleb.ola@example.com",
];

const DEMO_STAFF_PHONES = ["+2348030000001", "+2348030000002", "+2348030000003"];

const DEMO_SAMPLE_NAMES = [
  ["Blessing", "Eze"],
  ["Samuel", "Johnson"],
  ["Peace", "Bello"],
  ["Daniel", "Ade"],
  ["Mary", "Okoro"],
  ["Joshua", "Ibrahim"],
  ["Ruth", "Danjuma"],
  ["Caleb", "Ola"],
] as const;

const DEMO_STAFF_NAMES = [
  ["Grace", "Adeyemi"],
  ["Emmanuel", "Okafor"],
  ["Deborah", "Musa"],
] as const;

const DEMO_PROJECTS = [
  ["Church Auditorium Phase 1", "Construction of the main auditorium."],
  ["Community Medical Outreach", "Free medical care for the community."],
  ["Youth Skill Acquisition Center", "Empowering youths with vocational skills."],
  ["Media Studio Upgrade", "Professional livestream and podcast studio."],
] as const;

const DEMO_EVENTS = [
  ["Sunday Celebration Service", "Come and encounter His grace."],
  ["Wednesday Prayer Meeting", "Corporate prayer and the Word."],
] as const;

const DEMO_MEETINGS = [
  ["Monthly Workers Meeting", "General gathering for all ministry workers."],
  ["Choir Rehearsal", "Weekly rehearsal ahead of Sunday."],
] as const;

const DEMO_PROJECT_TITLES = DEMO_PROJECTS.map(([title]) => title);
const DEMO_EVENT_TITLES = DEMO_EVENTS.map(([title]) => title);
const DEMO_MEETING_TITLES = DEMO_MEETINGS.map(([title]) => title);

const CHURCH_DEPARTMENTS = [
  ["Pastoral Team", "pastoral", "Pastors and ministers", "department"],
  ["Choir & Worship", "choir", "Choristers and worship team", "department"],
  ["Ushering", "ushering", "Ushers and protocol", "department"],
  ["Media & Publicity", "media", "Media, sound and social media", "department"],
  ["Evangelism", "evangelism", "Outreach and soul winning", "department"],
  ["Children & Teens", "children", "Sunday school and teens", "department"],
  ["All Workers", "all-workers", "General room for every ministry worker", "general"],
] as const;

function isTruthyEnv(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase());
}

/** Sample church is local/test only. A leftover SEED_DEMO on Vercel production must not keep fake rows. */
export function demoFixturesAllowed(): boolean {
  if (isTruthyEnv(process.env.ALLOW_DEMO_DATA)) return true;
  if (!isTruthyEnv(process.env.SEED_DEMO)) return false;
  // Ignore SEED_DEMO on the hosted production app so leftover env cannot keep placeholders.
  if (process.env.VERCEL && process.env.NODE_ENV === "production") return false;
  return true;
}

function keepAdminEmail(): string {
  return (
    process.env.ADMIN_EMAIL ||
    process.env.BOOTSTRAP_ADMIN_EMAIL ||
    config.bootstrapAdmin.email ||
    ""
  ).toLowerCase();
}

function demoMemberClause(): { sql: string; params: unknown[] } {
  const emailPh = DEMO_MEMBER_EMAILS.map(() => "?").join(", ");
  const phonePh = DEMO_STAFF_PHONES.map(() => "?").join(", ");
  const sampleSql = DEMO_SAMPLE_NAMES.map(
    () =>
      "(lower(first_name) = lower(?) AND lower(last_name) = lower(?) AND join_date = '2023-01-15')",
  ).join(" OR ");
  const staffSql = DEMO_STAFF_NAMES.map(
    () => "(lower(first_name) = lower(?) AND lower(last_name) = lower(?))",
  ).join(" OR ");
  const nameParams = [
    ...DEMO_SAMPLE_NAMES.flatMap(([first, last]) => [first, last]),
    ...DEMO_STAFF_NAMES.flatMap(([first, last]) => [first, last]),
  ];
  const keep = keepAdminEmail();
  const keepSql = keep ? " AND (email IS NULL OR lower(email) <> ?)" : "";
  const keepParams = keep ? [keep] : [];
  return {
    sql: `(
      lower(coalesce(email, '')) IN (${emailPh})
      OR lower(coalesce(email, '')) LIKE '%@example.com'
      OR phone IN (${phonePh})
      OR phone LIKE '+23480100000%'
      OR (${sampleSql})
      OR (${staffSql})
    )${keepSql}`,
    params: [...DEMO_MEMBER_EMAILS, ...DEMO_STAFF_PHONES, ...nameParams, ...keepParams],
  };
}

function mmddThisYear(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = 1985 + Math.floor(Math.random() * 20);
  return `${yyyy}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export async function ensureSeed(): Promise<void> {
  const row = (await db
    .prepare("SELECT COUNT(*)::int AS c FROM members")
    .get()) as { c: number };
  if (row.c > 0) return;
  await seed();
}

function pairMatchSql(pairs: readonly (readonly [string, string])[]): { sql: string; params: string[] } {
  const sql = pairs.map(() => "(title = ? AND coalesce(description, '') = ?)").join(" OR ");
  return { sql, params: pairs.flatMap(([title, description]) => [title, description]) };
}

export async function countDemoLeftovers(): Promise<number> {
  const { sql, params } = demoMemberClause();
  const meetingTitles = DEMO_MEETING_TITLES.map(() => "?").join(", ");
  const eventTitles = DEMO_EVENT_TITLES.map(() => "?").join(", ");
  const projectTitles = DEMO_PROJECT_TITLES.map(() => "?").join(", ");
  const row = (await db
    .prepare(
      `SELECT (
         (SELECT COUNT(*) FROM members WHERE ${sql}) +
         (SELECT COUNT(*) FROM meetings WHERE title IN (${meetingTitles})) +
         (SELECT COUNT(*) FROM events WHERE title IN (${eventTitles})) +
         (SELECT COUNT(*) FROM projects WHERE title IN (${projectTitles}))
       )::int AS c`,
    )
    .get(...params, ...DEMO_MEETING_TITLES, ...DEMO_EVENT_TITLES, ...DEMO_PROJECT_TITLES)) as {
    c: number;
  };
  return row.c;
}

/** Removes the original demo fixtures so a live church starts from real data. */
export async function purgeDemoFixtures(): Promise<{ members: number }> {
  const { sql, params } = demoMemberClause();
  const emailPh = DEMO_MEMBER_EMAILS.map(() => "?").join(", ");

  await db
    .prepare(
      `DELETE FROM donations WHERE
         lower(coalesce(donor_email, '')) IN (${emailPh})
         OR member_id IN (SELECT id FROM members WHERE ${sql})`,
    )
    .run(...DEMO_MEMBER_EMAILS, ...params);

  const demoMembers = (await db
    .prepare(`SELECT id FROM members WHERE ${sql}`)
    .all(...params)) as { id: string }[];
  const ids = demoMembers.map((m) => m.id);
  if (ids.length) {
    const idList = ids.map(() => "?").join(", ");
    await db.prepare(`DELETE FROM department_members WHERE member_id IN (${idList})`).run(...ids);
    await db.prepare(`DELETE FROM meeting_attendees WHERE member_id IN (${idList})`).run(...ids);
    await db
      .prepare(
        `DELETE FROM message_recipients WHERE member_id IN (${idList}) OR message_id IN (SELECT id FROM messages WHERE created_by IN (${idList}))`,
      )
      .run(...ids, ...ids);
    await db.prepare(`DELETE FROM messages WHERE created_by IN (${idList})`).run(...ids);
    await db
      .prepare(
        `DELETE FROM social_post_targets WHERE post_id IN (SELECT id FROM social_posts WHERE created_by IN (${idList}))`,
      )
      .run(...ids);
    await db.prepare(`DELETE FROM social_posts WHERE created_by IN (${idList})`).run(...ids);
    await db.prepare(`DELETE FROM tasks WHERE created_by IN (${idList}) OR assigned_to IN (${idList})`).run(
      ...ids,
      ...ids,
    );
    await db.prepare(`DELETE FROM room_messages WHERE member_id IN (${idList})`).run(...ids);
  }

  const projects = pairMatchSql(DEMO_PROJECTS);
  const projectTitles = DEMO_PROJECT_TITLES.map(() => "?").join(", ");
  await db
    .prepare(
      `DELETE FROM donations WHERE project_id IN (SELECT id FROM projects WHERE ${projects.sql} OR title IN (${projectTitles}))`,
    )
    .run(...projects.params, ...DEMO_PROJECT_TITLES);
  await db
    .prepare(`DELETE FROM projects WHERE ${projects.sql} OR title IN (${projectTitles})`)
    .run(...projects.params, ...DEMO_PROJECT_TITLES);

  const events = pairMatchSql(DEMO_EVENTS);
  const eventTitles = DEMO_EVENT_TITLES.map(() => "?").join(", ");
  await db
    .prepare(`DELETE FROM events WHERE ${events.sql} OR title IN (${eventTitles})`)
    .run(...events.params, ...DEMO_EVENT_TITLES);

  const meetings = pairMatchSql(DEMO_MEETINGS);
  const meetingTitles = DEMO_MEETING_TITLES.map(() => "?").join(", ");
  const createdBySql = ids.length ? ` OR created_by IN (${ids.map(() => "?").join(", ")})` : "";
  await db
    .prepare(
      `DELETE FROM meeting_attendees WHERE meeting_id IN (SELECT id FROM meetings WHERE ${meetings.sql} OR title IN (${meetingTitles})${createdBySql})`,
    )
    .run(...meetings.params, ...DEMO_MEETING_TITLES, ...ids);
  await db
    .prepare(
      `DELETE FROM meetings WHERE ${meetings.sql} OR title IN (${meetingTitles})${createdBySql}`,
    )
    .run(...meetings.params, ...DEMO_MEETING_TITLES, ...ids);

  const deleted = await db.prepare(`DELETE FROM members WHERE ${sql}`).run(...params);

  // Guest gifts recorded while the sample church was loaded (e.g. ₦5,005,000
  // with no demo email) must not remain after the fake members are gone.
  await db
    .prepare(
      `DELETE FROM donations WHERE
         member_id IS NULL
         OR member_id NOT IN (SELECT id FROM members)
         OR project_id IN (SELECT id FROM projects WHERE title IN (${DEMO_PROJECT_TITLES.map(() => "?").join(", ")}))`,
    )
    .run(...DEMO_PROJECT_TITLES);

  return { members: Math.max(ids.length, deleted.changes) };
}

/**
 * Strips leftover sample-church rows on every request until the database is
 * clean. Boot-time purge is not enough on Vercel: a lambda may have started
 * before this code shipped, and SEED_DEMO may still be set from an old env.
 */
export async function ensureDemoDataRemoved(): Promise<void> {
  if (demoFixturesAllowed()) return;
  const leftover = await countDemoLeftovers();
  if (leftover === 0) return;
  const purged = await purgeDemoFixtures();
  if (purged.members > 0 || leftover > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[prepare] Removed ${purged.members} demo member(s) and related sample records (${leftover} leftover row(s) matched).`,
    );
  }
}

export const FREEDOM_REVIVAL_ID = "evt_igc_revival_oct2026";

const FREEDOM_REVIVAL = {
  id: FREEDOM_REVIVAL_ID,
  title: "Freedom from Jesus",
  description:
    "A three-day revival hosted by Prophet Michael Ugbede. Come expecting encounter, healing and deliverance — mighty are the works of God. 3:00pm daily.",
  type: "revival",
  startsAt: "2026-10-01T15:00:00+01:00",
  endsAt: "2026-10-03T18:00:00+01:00",
  location: "IGC Agbeji, Anyigba, Kogi State",
  imageUrl: "/programs/freedom-from-jesus-oct-2026.jpg",
};

/** Real church programs that should exist on the live site, not demo fixtures. */
export async function ensureChurchPrograms(): Promise<void> {
  await db
    .prepare(
      `INSERT INTO events (id, title, description, type, starts_at, ends_at, location, is_public, recurrence, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'none', ?)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         type = EXCLUDED.type,
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at,
         location = EXCLUDED.location,
         is_public = 1,
         image_url = EXCLUDED.image_url`,
    )
    .run(
      FREEDOM_REVIVAL.id,
      FREEDOM_REVIVAL.title,
      FREEDOM_REVIVAL.description,
      FREEDOM_REVIVAL.type,
      FREEDOM_REVIVAL.startsAt,
      FREEDOM_REVIVAL.endsAt,
      FREEDOM_REVIVAL.location,
      FREEDOM_REVIVAL.imageUrl,
    );
}

/** Strip sample data, keep ministry rooms, seed church programs, and promote ADMIN_EMAIL. */
export async function ensureProductionData(): Promise<void> {
  if (demoFixturesAllowed()) return;
  await ensureDemoDataRemoved();
  await ensureChurchStructure();
  await ensureChurchPrograms();
  await ensureBootstrapAdmin();
}

export async function ensureChurchStructure(): Promise<void> {
  for (const [name, slug, description, type] of CHURCH_DEPARTMENTS) {
    const existing = await db.prepare("SELECT id FROM departments WHERE slug = ?").get(slug);
    if (existing) continue;
    await db
      .prepare("INSERT INTO departments (id, name, slug, description, type) VALUES (?, ?, ?, ?, ?)")
      .run(newId("dpt"), name, slug, description, type);
  }
}

export async function ensureBootstrapAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
  if (!email || !password) return;

  const firstName = process.env.ADMIN_FIRST_NAME || config.bootstrapAdmin.firstName;
  const lastName = process.env.ADMIN_LAST_NAME || config.bootstrapAdmin.lastName;
  const passwordHash = await hashPassword(password);
  const existing = (await db.prepare("SELECT id, role FROM members WHERE email = ?").get(email)) as
    | { id: string; role: string }
    | undefined;

  let id = existing?.id;
  if (existing) {
    const promote = existing.role !== "super_admin";
    if (promote) {
      await db
        .prepare(
          `UPDATE members SET
             first_name = ?, last_name = ?, password_hash = ?,
             role = 'super_admin', spiritual_class = 'leader',
             membership_status = 'active', account_status = 'active',
             updated_at = now()
           WHERE id = ?`,
        )
        .run(firstName, lastName, passwordHash, existing.id);
    } else {
      await db
        .prepare(
          `UPDATE members SET
             role = 'super_admin', spiritual_class = 'leader',
             membership_status = 'active', account_status = 'active',
             updated_at = now()
           WHERE id = ?`,
        )
        .run(existing.id);
    }
  } else {
    id = newId("mbr");
    await db
      .prepare(
        `INSERT INTO members (id, first_name, last_name, email, password_hash, role, spiritual_class, membership_status, account_status, join_date)
         VALUES (?, ?, ?, ?, ?, 'super_admin', 'leader', 'active', 'active', ?)`,
      )
      .run(id, firstName, lastName, email, passwordHash, new Date().toISOString().slice(0, 10));
  }

  const pastoral = (await db.prepare("SELECT id FROM departments WHERE slug = 'pastoral'").get()) as
    | { id: string }
    | undefined;
  const workers = (await db.prepare("SELECT id FROM departments WHERE slug = 'all-workers'").get()) as
    | { id: string }
    | undefined;
  if (pastoral) {
    const link = await db
      .prepare("SELECT id FROM department_members WHERE department_id = ? AND member_id = ?")
      .get(pastoral.id, id);
    if (link) {
      await db.prepare("UPDATE department_members SET position = ? WHERE id = ?").run(
        "leader",
        (link as { id: string }).id,
      );
    } else {
      await db
        .prepare("INSERT INTO department_members (id, department_id, member_id, position) VALUES (?, ?, ?, ?)")
        .run(newId("dmb"), pastoral.id, id, "leader");
    }
  }
  if (workers) {
    const link = await db
      .prepare("SELECT id FROM department_members WHERE department_id = ? AND member_id = ?")
      .get(workers.id, id);
    if (!link) {
      await db
        .prepare("INSERT INTO department_members (id, department_id, member_id, position) VALUES (?, ?, ?, ?)")
        .run(newId("dmb"), workers.id, id, "member");
    }
  }
}

/**
 * Production boot: strip demo fixtures, keep empty ministry rooms, and create
 * the real admin from ADMIN_EMAIL / ADMIN_PASSWORD when those are set.
 * Set ALLOW_DEMO_DATA=true (or SEED_DEMO=true locally) to load the sample church.
 */
export async function prepareAppData(): Promise<void> {
  if (demoFixturesAllowed()) {
    await ensureSeed();
    await ensureChurchPrograms();
    return;
  }
  await ensureProductionData();
}

export async function seed(): Promise<void> {
  const hash = bcrypt.hashSync("Grace@2024", 10);

  const admin = newId("mbr");
  await db
    .prepare(
      `INSERT INTO members (id, first_name, last_name, gender, email, phone, password_hash, role, spiritual_class, membership_status, date_of_birth, marital_status, occupation, join_date, account_status)
     VALUES (?, 'Grace', 'Adeyemi', 'female', 'admin@igc.church', '+2348030000001', ?, 'super_admin', 'leader', 'active', '1980-05-12', 'married', 'Senior Pastor', '2015-01-01', 'active')`,
    )
    .run(admin, hash);

  const pastor = newId("mbr");
  await db
    .prepare(
      `INSERT INTO members (id, first_name, last_name, gender, email, phone, password_hash, role, spiritual_class, membership_status, date_of_birth, wedding_anniversary, marital_status, join_date, account_status)
     VALUES (?, 'Emmanuel', 'Okafor', 'male', 'pastor@igc.church', '+2348030000002', ?, 'pastor', 'leader', 'active', '1978-09-20', '2005-06-18', 'married', '2016-03-01', 'active')`,
    )
    .run(pastor, hash);

  const worker = newId("mbr");
  await db
    .prepare(
      `INSERT INTO members (id, first_name, last_name, gender, email, phone, password_hash, role, spiritual_class, membership_status, date_of_birth, marital_status, join_date, account_status)
     VALUES (?, 'Deborah', 'Musa', 'female', 'worker@igc.church', '+2348030000003', ?, 'worker', 'choir', 'active', '1994-11-02', 'single', '2019-07-15', 'active')`,
    )
    .run(worker, hash);

  // Departments (rooms)
  const depts: Record<string, string> = {};
  const deptList = [
    ["Pastoral Team", "pastoral", "Pastors and ministers", "department"],
    ["Choir & Worship", "choir", "Choristers and worship team", "department"],
    ["Ushering", "ushering", "Ushers and protocol", "department"],
    ["Media & Publicity", "media", "Media, sound and social media", "department"],
    ["Evangelism", "evangelism", "Outreach and soul winning", "department"],
    ["Children & Teens", "children", "Sunday school and teens", "department"],
    ["All Workers", "all-workers", "General room for every ministry worker", "general"],
  ];
  for (const [name, slug, description, type] of deptList) {
    const id = newId("dpt");
    depts[slug] = id;
    await db
      .prepare(
        "INSERT INTO departments (id, name, slug, description, type) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, name, slug, description, type);
  }

  const addToDept = (deptSlug: string, memberId: string, position = "member") =>
    db.prepare(
        "INSERT INTO department_members (id, department_id, member_id, position) VALUES (?, ?, ?, ?)",
      )
      .run(newId("dmb"), depts[deptSlug], memberId, position);
  await addToDept("pastoral", admin, "HOD");
  await addToDept("pastoral", pastor, "member");
  await addToDept("all-workers", admin, "member");
  await addToDept("all-workers", pastor, "member");
  await addToDept("all-workers", worker, "member");
  await addToDept("choir", worker, "HOD");

  // Sample members — two celebrate TODAY so automations are demonstrable.
  const sampleMembers = [
    ["Blessing", "Eze", "female", "new_convert", "new", mmddThisYear(0), null],
    ["Samuel", "Johnson", "male", "new_believer", "active", "1990-03-14", mmddThisYear(0)],
    ["Peace", "Bello", "female", "growing", "active", "1996-07-08", null],
    ["Daniel", "Ade", "male", "established", "active", "1988-12-25", "2012-12-31"],
    ["Mary", "Okoro", "female", "worker", "active", "1992-02-28", null],
    ["Joshua", "Ibrahim", "male", "choir", "active", "1999-10-10", null],
    ["Ruth", "Danjuma", "female", "new_convert", "new", "2001-04-04", null],
    ["Caleb", "Ola", "male", "growing", "active", "1985-08-19", "2010-08-19"],
  ] as const;
  let i = 4;
  for (const [first, last, gender, cls, status, dob, anniv] of sampleMembers) {
    i++;
    const id = newId("mbr");
    await db
      .prepare(
        `INSERT INTO members (id, first_name, last_name, gender, email, phone, role, spiritual_class, membership_status, date_of_birth, wedding_anniversary, marital_status, join_date)
       VALUES (?, ?, ?, ?, ?, ?, 'member', ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        first,
        last,
        gender,
        `${first.toLowerCase()}.${last.toLowerCase().replace(/\s/g, "")}@example.com`,
        `+23480100000${String(i).padStart(2, "0")}`,
        cls,
        status,
        dob,
        anniv,
        anniv ? "married" : "single",
        "2023-01-15",
      );
  }

  // Projects: done, ongoing, vision
  const projects = [
    ["Church Auditorium Phase 1", "Construction of the main auditorium.", "Building", "done", "public", 100, 50000000, 50000000],
    ["Community Medical Outreach", "Free medical care for the community.", "Outreach", "ongoing", "public", 65, 3000000, 1950000],
    ["Youth Skill Acquisition Center", "Empowering youths with vocational skills.", "Empowerment", "vision", "public", 10, 12000000, 800000],
    ["Media Studio Upgrade", "Professional livestream and podcast studio.", "Media", "ongoing", "private", 40, 5000000, 2000000],
  ] as const;
  for (const [title, description, category, status, visibility, progress, budget, raised] of projects) {
    await db
      .prepare(
        `INSERT INTO projects (id, title, description, category, status, visibility, progress, budget, amount_raised, lead_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId("prj"), title, description, category, status, visibility, progress, budget, raised, pastor);
  }

  // Public events
  await db
    .prepare(
      `INSERT INTO events (id, title, description, type, starts_at, location, is_public, recurrence)
     VALUES (?, 'Sunday Celebration Service', 'Come and encounter His grace.', 'service', date_trunc('day', now() + interval '3 days') + interval '8 hours', 'Main Auditorium', 1, 'weekly')`,
    )
    .run(newId("evt"));
  await db
    .prepare(
      `INSERT INTO events (id, title, description, type, starts_at, location, is_public, recurrence)
     VALUES (?, 'Wednesday Prayer Meeting', 'Corporate prayer and the Word.', 'prayer', date_trunc('day', now() + interval '1 day') + interval '16 hours', 'Prayer Hall', 1, 'weekly')`,
    )
    .run(newId("evt"));

  // Meetings (upcoming) so leaders see them on the dashboard.
  await db
    .prepare(
      `INSERT INTO meetings (id, title, description, department_id, scheduled_at, duration_mins, location, created_by, status)
     VALUES (?, 'Monthly Workers Meeting', 'General gathering for all ministry workers.', ?, date_trunc('day', now() + interval '2 days') + interval '16 hours', 90, 'Fellowship Hall', ?, 'scheduled')`,
    )
    .run(newId("mtg"), depts["all-workers"], admin);
  await db
    .prepare(
      `INSERT INTO meetings (id, title, description, department_id, scheduled_at, duration_mins, location, created_by, status)
     VALUES (?, 'Choir Rehearsal', 'Weekly rehearsal ahead of Sunday.', ?, date_trunc('day', now() + interval '1 day') + interval '17 hours', 120, 'Music Room', ?, 'scheduled')`,
    )
    .run(newId("mtg"), depts["choir"], worker);

  // eslint-disable-next-line no-console
  console.log("[seed] Seeded admin (admin@igc.church / Grace@2024), departments, members, projects, events, meetings.");
}

// Allow `npm run seed` to (re)initialise a fresh database.
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await initSchema();
    await ensureSeed();
    process.exit(0);
  })();
}
