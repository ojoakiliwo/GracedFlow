import bcrypt from "bcryptjs";
import { db, initSchema } from "./db.js";
import { newId } from "./util.js";

function mmddThisYear(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = 1985 + Math.floor(Math.random() * 20);
  return `${yyyy}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function ensureSeed(): void {
  const memberCount = (
    db.prepare("SELECT COUNT(*) AS c FROM members").get() as { c: number }
  ).c;
  if (memberCount > 0) return;
  seed();
}

export function seed(): void {
  const hash = bcrypt.hashSync("Grace@2024", 10);

  const admin = newId("mbr");
  db.prepare(
    `INSERT INTO members (id, first_name, last_name, gender, email, phone, password_hash, role, spiritual_class, membership_status, date_of_birth, marital_status, occupation, join_date, account_status)
     VALUES (?, 'Grace', 'Adeyemi', 'female', 'admin@igc.church', '+2348030000001', ?, 'super_admin', 'leader', 'active', '1980-05-12', 'married', 'Senior Pastor', '2015-01-01', 'active')`,
  ).run(admin, hash);

  const pastor = newId("mbr");
  db.prepare(
    `INSERT INTO members (id, first_name, last_name, gender, email, phone, password_hash, role, spiritual_class, membership_status, date_of_birth, wedding_anniversary, marital_status, join_date, account_status)
     VALUES (?, 'Emmanuel', 'Okafor', 'male', 'pastor@igc.church', '+2348030000002', ?, 'pastor', 'leader', 'active', '1978-09-20', '2005-06-18', 'married', '2016-03-01', 'active')`,
  ).run(pastor, hash);

  const worker = newId("mbr");
  db.prepare(
    `INSERT INTO members (id, first_name, last_name, gender, email, phone, password_hash, role, spiritual_class, membership_status, date_of_birth, marital_status, join_date, account_status)
     VALUES (?, 'Deborah', 'Musa', 'female', 'worker@igc.church', '+2348030000003', ?, 'worker', 'choir', 'active', '1994-11-02', 'single', '2019-07-15', 'active')`,
  ).run(worker, hash);

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
    db.prepare(
      "INSERT INTO departments (id, name, slug, description, type) VALUES (?, ?, ?, ?, ?)",
    ).run(id, name, slug, description, type);
  }

  const addToDept = (deptSlug: string, memberId: string, position = "member") =>
    db
      .prepare(
        "INSERT INTO department_members (id, department_id, member_id, position) VALUES (?, ?, ?, ?)",
      )
      .run(newId("dmb"), depts[deptSlug], memberId, position);
  addToDept("pastoral", admin, "HOD");
  addToDept("pastoral", pastor, "member");
  addToDept("all-workers", admin, "member");
  addToDept("all-workers", pastor, "member");
  addToDept("all-workers", worker, "member");
  addToDept("choir", worker, "HOD");

  // Sample members — two celebrate TODAY so automations are demonstrable.
  const sampleMembers = [
    ["Blessing", "Eze", "female", "new_convert", "new", mmddThisYear(0), null],
    ["Samuel", "Johnson", "male", "new_believer", "active", "1990-03-14", mmddThisYear(0)],
    ["Peace", "Bello", "female", "growing", "active", "1996-07-08", null],
    ["Daniel", "Ade", "male", "established", "active", "1988-12-25", "2012-12-31"],
    ["Mary", " Okoro", "female", "worker", "active", "1992-02-29", null],
    ["Joshua", "Ibrahim", "male", "choir", "active", "1999-10-10", null],
    ["Ruth", "Danjuma", "female", "new_convert", "new", "2001-04-04", null],
    ["Caleb", "Ola", "male", "growing", "active", "1985-08-19", "2010-08-19"],
  ] as const;
  let i = 4;
  for (const [first, last, gender, cls, status, dob, anniv] of sampleMembers) {
    i++;
    const id = newId("mbr");
    db.prepare(
      `INSERT INTO members (id, first_name, last_name, gender, email, phone, role, spiritual_class, membership_status, date_of_birth, wedding_anniversary, marital_status, join_date)
       VALUES (?, ?, ?, ?, ?, ?, 'member', ?, ?, ?, ?, ?, ?)`,
    ).run(
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
    db.prepare(
      `INSERT INTO projects (id, title, description, category, status, visibility, progress, budget, amount_raised, lead_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId("prj"), title, description, category, status, visibility, progress, budget, raised, pastor);
  }

  // Public events
  db.prepare(
    `INSERT INTO events (id, title, description, type, starts_at, location, is_public, recurrence)
     VALUES (?, 'Sunday Celebration Service', 'Come and encounter His grace.', 'service', datetime('now','+3 days','start of day','+9 hours'), 'Main Auditorium', 1, 'weekly')`,
  ).run(newId("evt"));
  db.prepare(
    `INSERT INTO events (id, title, description, type, starts_at, location, is_public, recurrence)
     VALUES (?, 'Wednesday Prayer Meeting', 'Corporate prayer and the Word.', 'prayer', datetime('now','+1 days','start of day','+17 hours','+30 minutes'), 'Prayer Hall', 1, 'weekly')`,
  ).run(newId("evt"));

  // Meetings (upcoming) so leaders see them on the dashboard.
  db.prepare(
    `INSERT INTO meetings (id, title, description, department_id, scheduled_at, duration_mins, location, created_by, status)
     VALUES (?, 'Monthly Workers Meeting', 'General gathering for all ministry workers.', ?, datetime('now','+2 days','start of day','+16 hours'), 90, 'Fellowship Hall', ?, 'scheduled')`,
  ).run(newId("mtg"), depts["all-workers"], admin);
  db.prepare(
    `INSERT INTO meetings (id, title, description, department_id, scheduled_at, duration_mins, location, created_by, status)
     VALUES (?, 'Choir Rehearsal', 'Weekly rehearsal ahead of Sunday.', ?, datetime('now','+1 days','start of day','+17 hours'), 120, 'Music Room', ?, 'scheduled')`,
  ).run(newId("mtg"), depts["choir"], worker);

  // eslint-disable-next-line no-console
  console.log("[seed] Seeded admin (admin@igc.church / Grace@2024), departments, members, projects, events, meetings.");
}

// Allow `npm run seed` to (re)initialise a fresh database.
if (import.meta.url === `file://${process.argv[1]}`) {
  initSchema();
  ensureSeed();
}
