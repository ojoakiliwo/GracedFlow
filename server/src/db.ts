import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initSchema(): void {
  db.exec(`
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
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'department',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS department_members (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      position TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_records (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      description TEXT,
      amount REAL,
      date TEXT,
      recorded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'vision',
      visibility TEXT NOT NULL DEFAULT 'private',
      progress INTEGER NOT NULL DEFAULT 0,
      budget REAL,
      amount_raised REAL DEFAULT 0,
      lead_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      start_date TEXT,
      target_date TEXT,
      completed_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
      scheduled_at TEXT NOT NULL,
      duration_mins INTEGER DEFAULT 60,
      location TEXT,
      link TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      audience_type TEXT NOT NULL,
      audience_value TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TEXT,
      recipients_count INTEGER DEFAULT 0,
      category TEXT DEFAULT 'manual',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT
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
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS social_posts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      media_url TEXT,
      platforms TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS social_post_targets (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      external_url TEXT,
      error TEXT,
      published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      donor_name TEXT,
      donor_email TEXT,
      donor_phone TEXT,
      type TEXT NOT NULL DEFAULT 'offering',
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NGN',
      method TEXT NOT NULL DEFAULT 'online',
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      recorded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS prayer_requests (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      request TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'service',
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      location TEXT,
      is_public INTEGER NOT NULL DEFAULT 1,
      recurrence TEXT NOT NULL DEFAULT 'none',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      author_name TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_name TEXT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      meta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      job TEXT NOT NULL,
      detail TEXT,
      recipients_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_dept_members_member ON department_members(member_id);
    CREATE INDEX IF NOT EXISTS idx_growth_member ON growth_records(member_id);
    CREATE INDEX IF NOT EXISTS idx_support_member ON support_records(member_id);
    CREATE INDEX IF NOT EXISTS idx_msg_recipients_msg ON message_recipients(message_id);
    CREATE INDEX IF NOT EXISTS idx_room_messages_dept ON room_messages(department_id);
  `);
}
