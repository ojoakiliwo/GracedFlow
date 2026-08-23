import { Router } from "express";
import { db } from "../db.js";
import { authenticate } from "../auth.js";
import { asyncHandler } from "./helpers.js";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const count = async (sql: string, ...params: unknown[]) =>
      ((await db.prepare(sql).get(...params)) as { c: number }).c;

    const totalMembers = await count("SELECT COUNT(*)::int AS c FROM members");
    const newConverts = await count(
      "SELECT COUNT(*)::int AS c FROM members WHERE spiritual_class = 'new_convert'",
    );
    const workers = await count(
      "SELECT COUNT(*)::int AS c FROM members WHERE role IN ('worker','pastor','admin','super_admin')",
    );
    const departments = await count("SELECT COUNT(*)::int AS c FROM departments");

    const projectsByStatus = await db
      .prepare("SELECT status, COUNT(*)::int AS count FROM projects GROUP BY status")
      .all();
    const givingConfirmed = await db
      .prepare(
        `SELECT currency, COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS count
         FROM donations WHERE status = 'confirmed' GROUP BY currency`,
      )
      .all();
    const givingConfirmedCount = givingConfirmed.reduce(
      (sum, row) => sum + Number((row as { count: number }).count),
      0,
    );
    const givingPending = await count(
      "SELECT COUNT(*)::int AS c FROM donations WHERE status = 'pending'",
    );

    const membersByClass = await db
      .prepare(
        "SELECT spiritual_class, COUNT(*)::int AS count FROM members GROUP BY spiritual_class ORDER BY count DESC",
      )
      .all();

    const upcomingMeetings = await db
      .prepare(
        `SELECT mt.*, d.name AS department_name FROM meetings mt
         LEFT JOIN departments d ON d.id = mt.department_id
         WHERE mt.scheduled_at >= now() ORDER BY mt.scheduled_at ASC LIMIT 5`,
      )
      .all();

    const openTasks = await count("SELECT COUNT(*)::int AS c FROM tasks WHERE status != 'done'");
    const newPrayers = await count(
      "SELECT COUNT(*)::int AS c FROM prayer_requests WHERE status = 'new'",
    );
    const recentMessages = await db
      .prepare(
        "SELECT id, subject, channel, audience_type, recipients_count, category, created_at FROM messages ORDER BY created_at DESC LIMIT 5",
      )
      .all();

    // Upcoming celebrations in the next 30 days.
    const celebrations = (await db
      .prepare(
        `SELECT id, first_name, last_name, date_of_birth, wedding_anniversary FROM members
         WHERE date_of_birth IS NOT NULL OR wedding_anniversary IS NOT NULL`,
      )
      .all()) as {
      id: string;
      first_name: string;
      last_name: string;
      date_of_birth: string | null;
      wedding_anniversary: string | null;
    }[];
    const today = new Date();
    const upcomingCelebrations = celebrations
      .flatMap((m) => {
        const items: { name: string; kind: string; date: string; inDays: number }[] = [];
        const push = (dateStr: string | null, kind: string) => {
          if (!dateStr || dateStr.length < 10) return;
          const [, mm, dd] = dateStr.split("-");
          let next = new Date(today.getFullYear(), Number(mm) - 1, Number(dd));
          if (next < new Date(today.toDateString()))
            next = new Date(today.getFullYear() + 1, Number(mm) - 1, Number(dd));
          const inDays = Math.round(
            (next.getTime() - new Date(today.toDateString()).getTime()) / 86400000,
          );
          if (inDays <= 30)
            items.push({
              name: `${m.first_name} ${m.last_name}`,
              kind,
              date: `${mm}-${dd}`,
              inDays,
            });
        };
        push(m.date_of_birth, "Birthday");
        push(m.wedding_anniversary, "Anniversary");
        return items;
      })
      .sort((a, b) => a.inDays - b.inDays)
      .slice(0, 8);

    res.json({
      stats: {
        totalMembers,
        newConverts,
        workers,
        departments,
        openTasks,
        newPrayers,
        givingPending,
        givingConfirmed: { count: givingConfirmedCount, byCurrency: givingConfirmed },
      },
      projectsByStatus,
      membersByClass,
      upcomingMeetings,
      recentMessages,
      upcomingCelebrations,
    });
  }),
);
