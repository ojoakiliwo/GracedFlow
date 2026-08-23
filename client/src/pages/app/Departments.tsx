import { useState } from "react";
import { Link } from "react-router-dom";
import { DoorOpen, Plus, Users } from "lucide-react";
import { apiPost } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";
import { useToast } from "../../components/toast";
import { useAuth } from "../../lib/auth";

interface Department {
  id: string;
  name: string;
  description: string | null;
  type: string;
  member_count: number;
  leader_name: string | null;
}

export default function Departments() {
  const { data, loading, reload } = useApi<Department[]>("/departments");
  const { hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", type: "department" });
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/departments", form);
      notify("Department created");
      setOpen(false);
      setForm({ name: "", description: "", type: "department" });
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
        title="Rooms & Departments"
        subtitle="Ministry arms, worker rooms and meeting spaces."
        actions={
          hasRole("admin") && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New department
            </Button>
          )
        }
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((d) => (
            <Link key={d.id} to={`/app/departments/${d.id}`}>
              <Card className="h-full p-6 transition hover:border-brand-200 hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl grace-gradient text-white">
                    <DoorOpen className="h-6 w-6" />
                  </div>
                  {d.type === "general" && <Badge color="gold">General Room</Badge>}
                </div>
                <h3 className="mt-4 text-lg text-ink-900">{d.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-ink-500">{d.description}</p>
                <div className="mt-4 flex items-center gap-1.5 text-sm text-ink-500">
                  <Users className="h-4 w-4" /> {d.member_count} members
                </div>
                {d.leader_name && (
                  <p className="mt-2 text-xs font-medium text-brand-700">Leader · {d.leader_name}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New department / room">
        <form onSubmit={create} className="space-y-4">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g. Media & Publicity"
            />
          </Field>
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="department">Department</option>
              <option value="general">General room (all workers)</option>
            </Select>
          </Field>
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
