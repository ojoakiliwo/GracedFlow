import { HeartHandshake } from "lucide-react";
import { apiPut } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Select,
  Spinner,
} from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import { useToast } from "../../components/toast";

interface PrayerRequest {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  request: string;
  status: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, "amber" | "blue" | "green"> = {
  new: "amber",
  praying: "blue",
  answered: "green",
};

export default function PrayerRequests() {
  const { data, loading, reload } = useApi<PrayerRequest[]>("/prayer-requests");
  const { notify } = useToast();

  async function setStatus(id: string, status: string) {
    await apiPut(`/prayer-requests/${id}`, { status });
    notify("Status updated");
    reload();
  }

  return (
    <div>
      <PageHeader
        title="Prayer Requests"
        subtitle="Requests submitted from the website and members."
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-7 w-7" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<HeartHandshake className="h-6 w-6" />}
          title="No prayer requests yet"
          description="Requests from the public prayer page will appear here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-ink-800">{p.name || "Anonymous"}</p>
                  <p className="text-xs text-ink-400">{formatDateTime(p.created_at)}</p>
                </div>
                <Badge color={STATUS_COLOR[p.status]}>{p.status}</Badge>
              </div>
              <p className="mt-3 text-sm text-ink-600">{p.request}</p>
              {(p.email || p.phone) && (
                <p className="mt-2 text-xs text-ink-400">
                  {[p.email, p.phone].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="mt-4">
                <Select
                  value={p.status}
                  onChange={(e) => setStatus(p.id, e.target.value)}
                  className="w-full"
                >
                  <option value="new">New</option>
                  <option value="praying">Praying</option>
                  <option value="answered">Answered</option>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
