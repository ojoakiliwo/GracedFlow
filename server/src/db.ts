import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

// Return DECIMAL/NUMERIC as JS numbers (pg returns strings by default).
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
// Return BIGINT (e.g. COUNT) as JS numbers where it is safe to do so.
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const isLocal = /localhost|127\.0\.0\.1/.test(config.databaseUrl);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
  max: config.isServerless ? 1 : 10,
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[db] unexpected pool error", err.message);
});

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Translates the app's SQLite-style placeholders to Postgres `$n` placeholders:
 * - positional `?`   -> `$1, $2, ...` (params passed as a list)
 * - named `@name`    -> `$n`          (params passed as a single object)
 */
function toPg(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  if (params.length === 1 && isPlainObject(params[0])) {
    const obj = params[0];
    const values: unknown[] = [];
    const text = sql.replace(/@(\w+)/g, (_m, name: string) => {
      values.push(obj[name] ?? null);
      return `$${values.length}`;
    });
    return { text, values };
  }
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; rowCount: number }> {
  const { text, values } = toPg(sql, params);
  const res = await pool.query(text, values as unknown[]);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}

/**
 * A thin async shim that mirrors the subset of the better-sqlite3 API used by
 * the app, so call sites only need `await` added:
 *   await db.prepare(sql).get(...)   -> first row (or undefined)
 *   await db.prepare(sql).all(...)   -> all rows
 *   await db.prepare(sql).run(...)   -> { changes }
 */
export const db = {
  prepare(sql: string) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async get<T = any>(...params: unknown[]): Promise<T | undefined> {
        const { rows } = await query<T>(sql, params);
        return rows[0];
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async all<T = any>(...params: unknown[]): Promise<T[]> {
        const { rows } = await query<T>(sql, params);
        return rows;
      },
      async run(...params: unknown[]): Promise<{ changes: number }> {
        const { rowCount } = await query(sql, params);
        return { changes: rowCount };
      },
    };
  },
  async exec(sql: string): Promise<void> {
    await pool.query(sql);
  },
};

/** Drops and recreates the public schema — used to reset the test database. */
export async function resetSchema(): Promise<void> {
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
}

export async function initSchema(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      spiritual_class TEXT NOT NULL DEFAULT 'new_convert',
      membership_status TEXT NOT NULL DEFAULT 'active',
      date_of_birth TEXT,
      wedding_anniversary TEXT,
      marital_status TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      country TEXT DEFAULT 'Nigeria',
      occupation TEXT,
      join_date TEXT,
      photo_url TEXT,
      notes TEXT,
      account_status TEXT NOT NULL DEFAULT 'active',
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'department',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS department_members (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      position TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (department_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS growth_records (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT,
      recorded_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS support_records (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      description TEXT,
      amount DOUBLE PRECISION,
      date TEXT,
      recorded_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'vision',
      visibility TEXT NOT NULL DEFAULT 'private',
      progress INTEGER NOT NULL DEFAULT 0,
      budget DOUBLE PRECISION,
      amount_raised DOUBLE PRECISION DEFAULT 0,
      lead_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      start_date TEXT,
      target_date TEXT,
      completed_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      duration_mins INTEGER DEFAULT 60,
      location TEXT,
      link TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS meeting_attendees (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'invited',
      UNIQUE (meeting_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
      assigned_to TEXT REFERENCES members(id) ON DELETE SET NULL,
      created_by TEXT,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'todo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      audience_type TEXT NOT NULL,
      audience_value TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      recipients_count INTEGER DEFAULT 0,
      category TEXT DEFAULT 'manual',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      sent_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS message_recipients (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      channel TEXT NOT NULL,
      to_address TEXT,
      recipient_name TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      provider TEXT,
      error TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS social_posts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      media_url TEXT,
      platforms TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      published_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS social_post_targets (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      external_url TEXT,
      error TEXT,
      published_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      donor_name TEXT,
      donor_email TEXT,
      donor_phone TEXT,
      type TEXT NOT NULL DEFAULT 'offering',
      amount DOUBLE PRECISION NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NGN',
      method TEXT NOT NULL DEFAULT 'online',
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      recorded_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      confirmed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS prayer_requests (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      request TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'service',
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ,
      location TEXT,
      is_public INTEGER NOT NULL DEFAULT 1,
      recurrence TEXT NOT NULL DEFAULT 'none',
      image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      author_name TEXT,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_name TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      meta TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      job TEXT NOT NULL,
      detail TEXT,
      recipients_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_dept_members_member ON department_members(member_id);
    CREATE INDEX IF NOT EXISTS idx_growth_member ON growth_records(member_id);
    CREATE INDEX IF NOT EXISTS idx_support_member ON support_records(member_id);
    CREATE INDEX IF NOT EXISTS idx_msg_recipients_msg ON message_recipients(message_id);
    CREATE INDEX IF NOT EXISTS idx_room_messages_dept ON room_messages(department_id);

    ALTER TABLE donations ADD COLUMN IF NOT EXISTS provider TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;

    CREATE TABLE IF NOT EXISTS meeting_reviews (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
      author_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      attendance_present INTEGER NOT NULL DEFAULT 0,
      attendance_absent INTEGER NOT NULL DEFAULT 0,
      review TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_meeting_reviews_meeting ON meeting_reviews(meeting_id);
  `);
}
