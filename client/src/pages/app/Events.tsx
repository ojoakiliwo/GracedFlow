import { useState } from "react";
import { CalendarRange, Plus, Globe, Lock } from "lucide-react";
import { apiPost } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import { useToast } from "../../components/toast";

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  starts_at: string;
  location: string | null;
  is_public: number;
  recurrence: string;
}

export default function Events() {
  const { data, loading, reload } = useApi<EventItem[]>("/events");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "service",
    startsAt: "",
    location: "",
    isPublic: "true",
    recurrence: "none",
  });
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/events", { ...form, isPublic: form.isPublic === "true" });
      notify("Event created");
      setOpen(false);
      setForm({
        title: "",
        description: "",
        type: "service",
        startsAt: "",
        location: "",
        isPublic: "true",
        recurrence: "none",
      });
      reload();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Services, programs and outreaches — public events show on the website."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New event
          </Button>
        }
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-7 w-7" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="h-6 w-6" />}
          title="No events yet"
          description="Create your first event or service."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((e) => (
            <Card key={e.id} className="p-5">
              <div className="flex items-start justify-between">
                <Badge color="brand">{e.type}</Badge>
                {e.is_public ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <Globe className="h-3.5 w-3.5" /> Public
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-ink-400">
                    <Lock className="h-3.5 w-3.5" /> Internal
                  </span>
                )}
              </div>
              <h3 className="mt-3 text-lg text-ink-900">{e.title}</h3>
              <p className="text-sm text-gold-600">{formatDateTime(e.starts_at)}</p>
              {e.location && <p className="text-sm text-ink-500">{e.location}</p>}
              {e.description && (
                <p className="mt-2 line-clamp-2 text-sm text-ink-500">{e.description}</p>
              )}
              {e.recurrence !== "none" && (
                <Badge color="gold" className="mt-3 capitalize">
                  {e.recurrence}
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create event">
        <form onSubmit={create} className="space-y-4">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="service">Service</option>
                <option value="prayer">Prayer</option>
                <option value="program">Program</option>
                <option value="outreach">Outreach</option>
              </Select>
            </Field>
            <Field label="Recurrence">
              <Select
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
              >
                <option value="none">One-off</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>
          </div>
          <Field label="Date & time">
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Location">
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </Field>
            <Field label="Visibility">
              <Select
                value={form.isPublic}
                onChange={(e) => setForm({ ...form, isPublic: e.target.value })}
              >
                <option value="true">Public (website)</option>
                <option value="false">Internal</option>
              </Select>
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
