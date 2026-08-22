import { useState } from "react";
import { Plus } from "lucide-react";
import { apiPost, apiPut } from "../../lib/api";
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
import { formatDate } from "../../lib/format";
import { useToast } from "../../components/toast";
import { useAuth } from "../../lib/auth";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  department_name: string | null;
  assignee_first: string | null;
  assignee_last: string | null;
}
interface Dept {
  id: string;
  name: string;
}
interface Member {
  id: string;
  first_name: string;
  last_name: string;
}

const COLUMNS = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];
const PRIORITY_COLOR: Record<string, "red" | "amber" | "gray"> = {
  high: "red",
  medium: "amber",
  low: "gray",
};

export default function Tasks() {
  const { data, loading, reload } = useApi<Task[]>("/tasks");
  const { data: depts } = useApi<Dept[]>("/departments");
  const { data: members } = useApi<Member[]>("/members");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    departmentId: "",
    assignedTo: "",
    dueDate: "",
    priority: "medium",
  });
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();
  const { hasRole, user } = useAuth();
  const canCreate = hasRole("pastor") || (user?.ledDepartments?.length ?? 0) > 0;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/tasks", {
        ...form,
        departmentId: form.departmentId || undefined,
        assignedTo: form.assignedTo || undefined,
      });
      notify("Task created");
      setOpen(false);
      setForm({
        title: "",
        description: "",
        departmentId: "",
        assignedTo: "",
        dueDate: "",
        priority: "medium",
      });
      reload();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function move(task: Task, status: string) {
    await apiPut(`/tasks/${task.id}`, { status });
    reload();
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Assign and track ministry tasks across departments."
        actions={
          canCreate ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New task
          </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = data?.filter((t) => t.status === col.key) ?? [];
            return (
              <div key={col.key} className="rounded-2xl bg-ink-100/50 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold text-ink-700">{col.label}</h3>
                  <span className="text-xs text-ink-400">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((t) => (
                    <Card key={t.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink-800">{t.title}</p>
                        <Badge color={PRIORITY_COLOR[t.priority]}>{t.priority}</Badge>
                      </div>
                      {t.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-ink-500">
                          {t.description}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                        {t.department_name && <Badge color="brand">{t.department_name}</Badge>}
                        {t.assignee_first && (
                          <span>
                            {t.assignee_first} {t.assignee_last}
                          </span>
                        )}
                        {t.due_date && <span>· due {formatDate(t.due_date)}</span>}
                      </div>
                      <div className="mt-3 flex gap-1.5">
                        {COLUMNS.filter((c) => c.key !== t.status).map((c) => (
                          <button
                            key={c.key}
                            onClick={() => move(t, c.key)}
                            className="rounded-lg bg-ink-100 px-2 py-1 text-[11px] font-medium text-ink-600 hover:bg-brand-100 hover:text-brand-700"
                          >
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <p className="py-6 text-center text-xs text-ink-400">No tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create task">
        <form onSubmit={create} className="space-y-4">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Department">
              <Select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">None</option>
                {depts?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assign to">
              <Select
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              >
                <option value="">Unassigned</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </Field>
            <Field label="Priority">
              <Select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
