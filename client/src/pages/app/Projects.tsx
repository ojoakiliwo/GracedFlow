import { useState } from "react";
import { Pencil, Plus, Target, Eye, EyeOff } from "lucide-react";
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
import { naira } from "../../lib/format";
import { useToast } from "../../components/toast";
import { useAuth } from "../../lib/auth";

interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  visibility: string;
  progress: number;
  budget: number | null;
  amount_raised: number | null;
}

const COLUMNS = [
  { key: "vision", label: "Vision / Future", color: "gold" as const },
  { key: "ongoing", label: "Ongoing", color: "blue" as const },
  { key: "done", label: "Completed", color: "green" as const },
];

const emptyForm = {
  title: "",
  description: "",
  category: "",
  status: "vision",
  visibility: "private",
  progress: "0",
  budget: "",
  amountRaised: "",
};

export default function Projects() {
  const { data, loading, reload } = useApi<Project[]>("/projects");
  const { isSuperAdmin, hasRole } = useAuth();
  const canEdit = isSuperAdmin || hasRole("pastor");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setForm({
      title: project.title,
      description: project.description ?? "",
      category: project.category ?? "",
      status: project.status,
      visibility: project.visibility,
      progress: String(project.progress ?? 0),
      budget: project.budget != null ? String(project.budget) : "",
      amountRaised: project.amount_raised != null ? String(project.amount_raised) : "",
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      progress: Number(form.progress),
      budget: form.budget ? Number(form.budget) : null,
      amountRaised: form.amountRaised ? Number(form.amountRaised) : null,
    };
    try {
      if (editing) {
        await apiPut(`/projects/${editing.id}`, payload);
        notify("Project updated");
      } else {
        await apiPost("/projects", payload);
        notify("Project created");
      }
      closeModal();
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
        title="Projects & Visions"
        subtitle="Completed works, ongoing projects and future visions of the ministry."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New project
          </Button>
        }
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = data?.filter((p) => p.status === col.key) ?? [];
            return (
              <div key={col.key}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge color={col.color}>{col.label}</Badge>
                  </div>
                  <span className="text-sm text-ink-400">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((p) => (
                    <Card key={p.id} className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold text-ink-900">{p.title}</h3>
                        <div className="flex shrink-0 items-center gap-1">
                          {p.visibility === "public" ? (
                            <Eye className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-ink-300" />
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-brand-700"
                              aria-label={`Edit ${p.title}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {p.category && (
                        <p className="mt-0.5 text-xs uppercase tracking-wide text-brand-500">
                          {p.category}
                        </p>
                      )}
                      <p className="mt-2 line-clamp-3 text-sm text-ink-500">
                        {p.description}
                      </p>
                      <div className="mt-4">
                        <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                          <div
                            className="h-full rounded-full grace-gradient"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs text-ink-400">
                          <span>{p.progress}%</span>
                          {p.budget ? (
                            <span>
                              {naira(p.amount_raised)} / {naira(p.budget)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-ink-200 py-8 text-center text-sm text-ink-400">
                      <Target className="mx-auto mb-1 h-5 w-5" /> Nothing here yet
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? "Edit project / vision" : "New project / vision"}
        wide
      >
        <form onSubmit={save} className="space-y-4">
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
            <Field label="Category">
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Building, Outreach..."
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="vision">Vision / Future</option>
                <option value="ongoing">Ongoing</option>
                <option value="done">Completed</option>
              </Select>
            </Field>
            <Field label="Progress (%)">
              <Input
                type="number"
                min="0"
                max="100"
                value={form.progress}
                onChange={(e) => setForm({ ...form, progress: e.target.value })}
              />
            </Field>
            <Field label="Budget (₦)">
              <Input
                type="number"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
            </Field>
            {editing && (
              <Field label="Amount raised (₦)">
                <Input
                  type="number"
                  value={form.amountRaised}
                  onChange={(e) => setForm({ ...form, amountRaised: e.target.value })}
                />
              </Field>
            )}
          </div>
          <Field label="Visibility" hint="Public projects appear on the church website">
            <Select
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            >
              <option value="private">Private (internal)</option>
              <option value="public">Public (show on website)</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Create project"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
