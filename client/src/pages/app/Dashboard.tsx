import {
  Users,
  UserPlus,
  DoorOpen,
  ListChecks,
  HeartHandshake,
  Cake,
  CalendarDays,
  Send,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/useApi";
import { Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { classLabel, formatDateTime } from "../../lib/format";
import { money } from "../../lib/currencies";
import { useAuth } from "../../lib/auth";

interface DashboardData {
  stats: {
    totalMembers: number;
    newConverts: number;
    workers: number;
    departments: number;
    openTasks: number;
    newPrayers: number;
    givingPending: number;
    givingConfirmed: {
      count: number;
      byCurrency?: { currency: string; total: number; count: number }[];
      total?: number;
    };
  };
  projectsByStatus: { status: string; count: number }[];
  membersByClass: { spiritual_class: string; count: number }[];
  upcomingMeetings: {
    id: string;
    title: string;
    scheduled_at: string;
    department_name: string | null;
  }[];
  recentMessages: {
    id: string;
    subject: string | null;
    channel: string;
    recipients_count: number;
    created_at: string;
  }[];
  upcomingCelebrations: {
    name: string;
    kind: string;
    date: string;
    inDays: number;
  }[];
}

const CLASS_COLORS = ["#6d28d9", "#7c3aed", "#a78bfa", "#c8912f", "#e0bd6f", "#8b5cf6", "#4c1d95"];

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading } = useApi<DashboardData>("/dashboard");

  if (loading || !data)
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );

  const { stats } = data;
  const statCards = [
    { label: "Total Members", value: stats.totalMembers, icon: Users, color: "text-brand-700 bg-brand-50" },
    { label: "New Converts", value: stats.newConverts, icon: UserPlus, color: "text-emerald-700 bg-emerald-50" },
    { label: "Workers", value: stats.workers, icon: HeartHandshake, color: "text-gold-700 bg-gold-50" },
    { label: "Departments", value: stats.departments, icon: DoorOpen, color: "text-sky-700 bg-sky-50" },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.first_name} 🙏`}
        subtitle="Here is what's happening across Infinitely Graced Church today."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.color}`}>
                <s.icon className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-4 font-display text-3xl font-semibold text-ink-900">
              {s.value}
            </p>
            <p className="text-sm text-ink-500">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-ink-500">Confirmed Giving</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900">
            {(stats.givingConfirmed.byCurrency ?? []).length === 0
              ? money(0)
              : (stats.givingConfirmed.byCurrency ?? []).map((row) => (
                  <span key={row.currency} className="mr-3 last:mr-0">
                    {money(Number(row.total), row.currency)}
                  </span>
                ))}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {stats.givingConfirmed.count} recorded ·{" "}
            <Link to="/app/giving" className="text-brand-600 hover:underline">
              {stats.givingPending} pending
            </Link>
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-ink-500">
            <ListChecks className="h-4 w-4" />
            <p className="text-sm">Open Tasks</p>
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900">
            {stats.openTasks}
          </p>
          <Link to="/app/tasks" className="mt-1 text-xs text-brand-600 hover:underline">
            View task board →
          </Link>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-ink-500">
            <HeartHandshake className="h-4 w-4" />
            <p className="text-sm">New Prayer Requests</p>
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900">
            {stats.newPrayers}
          </p>
          <Link to="/app/prayer" className="mt-1 text-xs text-brand-600 hover:underline">
            Attend to requests →
          </Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg text-ink-900">Membership by Class</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.membersByClass.map((m) => ({
                  name: classLabel(m.spiritual_class),
                  count: m.count,
                }))}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#8f8f9c" }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={60}
                />
                <Tooltip
                  cursor={{ fill: "#f6f4ff" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid #ede9fe" }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.membersByClass.map((_, i) => (
                    <Cell key={i} fill={CLASS_COLORS[i % CLASS_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg text-ink-900">Projects</h3>
          <div className="mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.projectsByStatus.map((p) => ({
                    name: p.status,
                    value: p.count,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {data.projectsByStatus.map((_, i) => (
                    <Cell key={i} fill={CLASS_COLORS[i % CLASS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #ede9fe" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1">
            {data.projectsByStatus.map((p, i) => (
              <div key={p.status} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 capitalize text-ink-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: CLASS_COLORS[i % CLASS_COLORS.length] }}
                  />
                  {p.status}
                </span>
                <span className="font-medium text-ink-800">{p.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Cake className="h-5 w-5 text-gold-500" />
            <h3 className="text-lg text-ink-900">Upcoming Celebrations</h3>
          </div>
          {data.upcomingCelebrations.length === 0 ? (
            <p className="text-sm text-ink-400">No celebrations in the next 30 days.</p>
          ) : (
            <ul className="space-y-3">
              {data.upcomingCelebrations.map((c, i) => (
                <li key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink-800">{c.name}</p>
                    <p className="text-xs text-ink-400">{c.kind}</p>
                  </div>
                  <Badge color={c.inDays === 0 ? "gold" : "gray"}>
                    {c.inDays === 0 ? "Today 🎉" : `in ${c.inDays}d`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-brand-600" />
            <h3 className="text-lg text-ink-900">Upcoming Meetings</h3>
          </div>
          {data.upcomingMeetings.length === 0 ? (
            <p className="text-sm text-ink-400">No meetings scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {data.upcomingMeetings.map((m) => (
                <li key={m.id}>
                  <p className="text-sm font-medium text-ink-800">{m.title}</p>
                  <p className="text-xs text-ink-400">
                    {formatDateTime(m.scheduled_at)}
                    {m.department_name ? ` · ${m.department_name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-brand-600" />
            <h3 className="text-lg text-ink-900">Recent Broadcasts</h3>
          </div>
          {data.recentMessages.length === 0 ? (
            <p className="text-sm text-ink-400">No messages sent yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentMessages.map((m) => (
                <li key={m.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-800">
                      {m.subject || "Message"}
                    </p>
                    <p className="text-xs text-ink-400">
                      {m.recipients_count} recipients · {m.channel}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
