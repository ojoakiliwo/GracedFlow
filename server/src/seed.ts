import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { db, initSchema } from "./db.js";
import { hashPassword } from "./auth.js";
import { newId } from "./util.js";

export const DEMO_MEMBER_EMAILS = [
  "admin@igc.church",
  "pastor@igc.church",
  "worker@igc.church",
];

const DEMO_PROJECT_TITLES = [
  "Church Auditorium Phase 1",
  "Community Medical Outreach",
  "Youth Skill Acquisition Center",
  "Media Studio Upgrade",
];

const DEMO_EVENT_TITLES = [
  "Sunday Celebration Service",
  "Wednesday Prayer Meeting",
];

const DEMO_MEETING_TITLES = [
  "Monthly Workers Meeting",
  "Choir Rehearsal",
];

const CHURCH_DEPARTMENTS = [
  ["Pastoral Team", "pastoral", "Pastors and ministers", "department"],
  ["Choir & Worship", "choir", "Choristers and worship team", "department"],
  ["Ushering", "ushering", "Ushers and protocol", "department"],
  ["Media & Publicity", "media", "Media, sound and social media", "department"],
  ["Evangelism", "evangelism", "Outreach and soul winning", "department"],
  ["Children & Teens", "children", "Sunday school and teens", "department"],
  ["All Workers", "all-workers", "General room for every ministry worker", "general"],
] as const;

function demoEmailClause(): { sql: string; params: string[] } {
  const placeholders = DEMO_MEMBER_EMAILS.map(() => "?").join(", ");
  return {
    sql: `(lower(email) LIKE '%@example.com' OR lower(email) IN (${placeholders}))`,
    params: DEMO_MEMBER_EMAILS,
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

/** Removes the original demo fixtures so a live church starts from real data. */
export async function purgeDemoFixtures(): Promise<{ members: number }> {
  const { sql, params } = demoEmailClause();
  await db
    .prepare(
      `DELETE FROM donations WHERE
         lower(coalesce(donor_email, '')) LIKE '%@example.com'
         OR lower(coalesce(donor_email, '')) IN (${DEMO_MEMBER_EMAILS.map(() => "?").join(", ")})
         OR member_id IN (SELECT id FROM members WHERE ${sql})`,
    )
    .run(...DEMO_MEMBER_EMAILS, ...params);

  const demoMembers = (await db
    .prepare(`SELECT id FROM members WHERE ${sql}`)
    .all(...params)) as { id: string }[];
  const ids = demoMembers.map((m) => m.id);
  if (ids.length) {
    const idList = ids.map(() => "?").join(", ");
    await db.prepare(`DELETE FROM messages WHERE created_by IN (${idList})`).run(...ids);
    await db.prepare(`DELETE FROM social_posts WHERE created_by IN (${idList})`).run(...ids);
    await db.prepare(`DELETE FROM tasks WHERE created_by IN (${idList}) OR assigned_to IN (${idList})`).run(
      ...ids,
      ...ids,
    );
    await db.prepare(`DELETE FROM room_messages WHERE member_id IN (${idList})`).run(...ids);
  }

  const projectTitles = DEMO_PROJECT_TITLES.map(() => "?").join(", ");
  await db.prepare(`DELETE FROM projects WHERE title IN (${projectTitles})`).run(...DEMO_PROJECT_TITLES);
  const eventTitles = DEMO_EVENT_TITLES.map(() => "?").join(", ");
  await db.prepare(`DELETE FROM events WHERE title IN (${eventTitles})`).run(...DEMO_EVENT_TITLES);
  const meetingTitles = DEMO_MEETING_TITLES.map(() => "?").join(", ");
  await db.prepare(`DELETE FROM meetings WHERE title IN (${meetingTitles})`).run(...DEMO_MEETING_TITLES);

  await db.prepare(`DELETE FROM members WHERE ${sql}`).run(...params);
  return { members: ids.length };
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
  const email = (
    process.env.ADMIN_EMAIL ||
    process.env.BOOTSTRAP_ADMIN_EMAIL ||
    config.bootstrapAdmin.email
  ).toLowerCase();
  const password =
    process.env.ADMIN_PASSWORD ||
    process.env.BOOTSTRAP_ADMIN_PASSWORD ||
    config.bootstrapAdmin.password;
  if (!email || !password) return;

  const existing = await db.prepare("SELECT id FROM members WHERE email = ?").get(email);
  if (existing) return;

  const id = newId("mbr");
  await db
    .prepare(
      `INSERT INTO members (id, first_name, last_name, email, password_hash, role, spiritual_class, membership_status, account_status, join_date)
       VALUES (?, ?, ?, ?, ?, 'super_admin', 'leader', 'active', 'active', ?)`,
    )
    .run(
      id,
      process.env.ADMIN_FIRST_NAME || config.bootstrapAdmin.firstName,
      process.env.ADMIN_LAST_NAME || config.bootstrapAdmin.lastName,
      email,
      await hashPassword(password),
      new Date().toISOString().slice(0, 10),
    );

  const pastoral = (await db.prepare("SELECT id FROM departments WHERE slug = 'pastoral'").get()) as
    | { id: string }
    | undefined;
  const workers = (await db.prepare("SELECT id FROM departments WHERE slug = 'all-workers'").get()) as
    | { id: string }
    | undefined;
  if (pastoral) {
    await db
      .prepare("INSERT INTO department_members (id, department_id, member_id, position) VALUES (?, ?, ?, ?)")
      .run(newId("dmb"), pastoral.id, id, "HOD");
  }
  if (workers) {
    await db
      .prepare("INSERT INTO department_members (id, department_id, member_id, position) VALUES (?, ?, ?, ?)")
      .run(newId("dmb"), workers.id, id, "member");
  }
}

/**
 * Production boot: strip demo fixtures, keep empty ministry rooms, and create
 * the real admin from ADMIN_EMAIL / ADMIN_PASSWORD when those are set.
 * Set SEED_DEMO=true to load the old sample church instead.
 */
export async function prepareAppData(): Promise<void> {
  const seedDemo = ["1", "true", "yes", "on"].includes((process.env.SEED_DEMO ?? "").toLowerCase());
  if (seedDemo) {
    await ensureSeed();
    return;
  }
  const purged = await purgeDemoFixtures();
  await ensureChurchStructure();
  await ensureBootstrapAdmin();
  if (purged.members > 0) {
    // eslint-disable-next-line no-console
    console.log(`[prepare] Removed ${purged.members} demo member(s) and related sample records.`);
  }
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
     VALUES (?, 'Sunday Celebration Service', 'Come and encounter His grace.', 'service', date_trunc('day', now() + interval '3 days') + interval '9 hours', 'Main Auditorium', 1, 'weekly')`,
    )
    .run(newId("evt"));
  await db
    .prepare(
      `INSERT INTO events (id, title, description, type, starts_at, location, is_public, recurrence)
     VALUES (?, 'Wednesday Prayer Meeting', 'Corporate prayer and the Word.', 'prayer', date_trunc('day', now() + interval '1 day') + interval '17 hours 30 minutes', 'Prayer Hall', 1, 'weekly')`,
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
