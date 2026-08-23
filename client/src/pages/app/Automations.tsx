import { useState } from "react";
import { CalendarClock, Play, Cake, Sun, Sunrise } from "lucide-react";
import { apiPost } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Badge, Button, Card, PageHeader, Spinner } from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import { useToast } from "../../components/toast";
import { useAuth } from "../../lib/auth";

interface AutomationsData {
  schedules: {
    job: string;
    label: string;
    cadence: string;
    description: string;
  }[];
  runs: {
    id: string;
    job: string;
    detail: string;
    recipients_count: number;
    created_at: string;
  }[];
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sunday_reminder: Sun,
  prayer_reminder: Sunrise,
  celebrations: Cake,
};

export default function Automations() {
  const { data, loading, reload } = useApi<AutomationsData>("/automations");
  const { hasRole } = useAuth();
  const [running, setRunning] = useState<string | null>(null);
  const { notify } = useToast();

  async function run(job: string) {
    setRunning(job);
    try {
      const res = await apiPost<{ recipients?: number; birthdays?: number; anniversaries?: number }>(
        "/automations/run",
        { job },
      );
      if (job === "celebrations") {
        notify(
          `Greetings sent · ${res.birthdays} birthday(s), ${res.anniversaries} anniversary(ies)`,
        );
      } else {
        notify(`Reminder sent to ${res.recipients} member(s)`);
      }
      reload();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setRunning(null);
    }
  }

  if (loading || !data)
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Automations"
        subtitle="Scheduled reminders and personalized greetings that run on autopilot."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {data.schedules.map((s) => {
          const Icon = ICONS[s.job] ?? CalendarClock;
          return (
            <Card key={s.job} className="flex flex-col p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl grace-gradient text-white">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg text-ink-900">{s.label}</h3>
              <Badge color="gold" className="mt-1 w-fit">
                {s.cadence}
              </Badge>
              <p className="mt-3 flex-1 text-sm text-ink-500">{s.description}</p>
              {hasRole("admin") && (
                <Button
                  variant="secondary"
                  className="mt-4"
                  loading={running === s.job}
                  onClick={() => run(s.job)}
                >
                  <Play className="h-4 w-4" /> Run now
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 p-6">
        <h3 className="mb-4 text-lg text-ink-900">Recent automation runs</h3>
        {data.runs.length === 0 ? (
          <p className="text-sm text-ink-400">
            No runs yet. Trigger one above or wait for the schedule.
          </p>
        ) : (
          <ul className="divide-y divide-ink-50">
            {data.runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium capitalize text-ink-800">
                    {r.job.replace("_", " ")}
                  </p>
                  <p className="text-xs text-ink-500">{r.detail}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-brand-700">
                    {r.recipients_count} sent
                  </p>
                  <p className="text-xs text-ink-400">{formatDateTime(r.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
