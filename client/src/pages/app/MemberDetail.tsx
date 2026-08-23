import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Cake,
  Heart,
  Mail,
  Phone,
  MapPin,
  Sprout,
  HandCoins,
  Plus,
} from "lucide-react";
import { apiPost, apiPut } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";
import { classLabel, formatDate, naira, roleLabel } from "../../lib/format";
import { money } from "../../lib/currencies";
import { DEPARTMENT_POSITIONS, officeFor } from "../../lib/offices";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../components/toast";

interface MemberDetailData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  spiritual_class: string;
  membership_status: string;
  gender: string | null;
  date_of_birth: string | null;
  wedding_anniversary: string | null;
  marital_status: string | null;
  address: string | null;
  occupation: string | null;
  join_date: string | null;
  growth: { id: string; type: string; title: string; description: string | null; date: string }[];
  support: { id: string; type: string; description: string | null; amount: number | null; date: string }[];
  departments: { id: string; name: string; position: string }[];
  donations: { id: string; type: string; amount: number; currency?: string; status: string; created_at: string }[];
}

export default function MemberDetail() {
  const { id } = useParams();
  const { data, loading, reload } = useApi<MemberDetailData>(`/members/${id}`);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  if (loading || !data)
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );

  return (
    <div>
      <Link
        to="/app/members"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to members
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile */}
        <Card className="p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar
              first={data.first_name}
              last={data.last_name}
              className="h-20 w-20 text-2xl"
            />
            <h2 className="mt-3 text-xl text-ink-900">
              {data.first_name} {data.last_name}
            </h2>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <Badge color="brand">{classLabel(data.spiritual_class)}</Badge>
              <Badge color="gold">{roleLabel(data.role)}</Badge>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <Info icon={Mail} value={data.email} />
            <Info icon={Phone} value={data.phone} />
            <Info icon={MapPin} value={data.address} />
            <Info icon={Cake} value={data.date_of_birth ? formatDate(data.date_of_birth) : null} label="Birthday" />
            <Info
              icon={Heart}
              value={data.wedding_anniversary ? formatDate(data.wedding_anniversary) : null}
              label="Anniversary"
            />
          </div>

          {data.departments.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase text-ink-400">
                Departments
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.departments.map((d) => (
                  <Badge key={d.id} color="gray">
                    {d.name} {d.position !== "member" ? `· ${d.position}` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <OfficeAccessNote role={data.role} />
        </Card>

        {/* Growth, support, giving */}
        <div className="space-y-6 lg:col-span-2">
          <OfficeEditor
            key={`${data.id}-${data.role}-${data.departments.map((d) => `${d.id}:${d.position}`).join(",")}`}
            member={data}
            onSaved={reload}
          />
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg text-ink-900">Spiritual Growth</h3>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setGrowthOpen(true)}>
                <Plus className="h-4 w-4" /> Add milestone
              </Button>
            </div>
            {data.growth.length === 0 ? (
              <p className="text-sm text-ink-400">No growth milestones recorded yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
                {data.growth.map((g) => (
                  <li key={g.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-brand-50" />
                    <p className="text-sm font-medium text-ink-800">{g.title}</p>
                    <p className="text-xs capitalize text-brand-600">
                      {g.type} · {formatDate(g.date)}
                    </p>
                    {g.description && (
                      <p className="mt-0.5 text-sm text-ink-500">{g.description}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-gold-600" />
                <h3 className="text-lg text-ink-900">Support & Care</h3>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setSupportOpen(true)}>
                <Plus className="h-4 w-4" /> Record support
              </Button>
            </div>
            {data.support.length === 0 ? (
              <p className="text-sm text-ink-400">No support records yet.</p>
            ) : (
              <ul className="divide-y divide-ink-50">
                {data.support.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium capitalize text-ink-800">
                        {s.type}
                      </p>
                      <p className="text-xs text-ink-500">
                        {s.description} · {formatDate(s.date)}
                      </p>
                    </div>
                    {s.amount ? (
                      <span className="text-sm font-medium text-ink-700">
                        {naira(s.amount)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-brand-600" />
              <h3 className="text-lg text-ink-900">Giving History</h3>
            </div>
            {data.donations.length === 0 ? (
              <p className="text-sm text-ink-400">No giving records yet.</p>
            ) : (
              <ul className="divide-y divide-ink-50">
                {data.donations.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium capitalize text-ink-800">
                        {d.type}
                      </p>
                      <p className="text-xs text-ink-500">{formatDate(d.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{money(d.amount, d.currency)}</span>
                      <Badge color={d.status === "confirmed" ? "green" : "amber"}>
                        {d.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <GrowthModal
        open={growthOpen}
        onClose={() => setGrowthOpen(false)}
        memberId={id!}
        onSaved={reload}
      />
      <SupportModal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        memberId={id!}
        onSaved={reload}
      />
    </div>
  );
}

function OfficeAccessNote({ role }: { role: string }) {
  const office = officeFor(role);
  return (
    <div className="mt-6 rounded-xl bg-ink-50 p-3 text-left">
      <p className="text-xs font-semibold uppercase text-ink-400">Access with this office</p>
      <p className="mt-1 text-sm text-ink-600">{office.summary}</p>
    </div>
  );
}

function OfficeEditor({
  member,
  onSaved,
}: {
  member: MemberDetailData;
  onSaved: () => void;
}) {
  const { isSuperAdmin } = useAuth();
  const { data: depts } = useApi<{ id: string; name: string }[]>("/departments");
  const office = officeFor(member.role);
  const [role, setRole] = useState(member.role);
  const [positions, setPositions] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    member.departments.forEach((d) => {
      next[d.id] = d.position;
    });
    return next;
  });
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  if (!isSuperAdmin) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPut(`/members/${member.id}/office`, {
        role,
        departments: (depts ?? []).map((d) => ({
          departmentId: d.id,
          position: positions[d.id] || "none",
        })),
      });
      notify("Office updated. Matching access is now attached.");
      onSaved();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  const preview = officeFor(role);

  return (
    <Card className="p-6">
      <h3 className="text-lg text-ink-900">Office & access</h3>
      <p className="mt-1 text-sm text-ink-500">
        Only the super admin can change anyone’s position. The access for that
        office attaches automatically.
      </p>
      <form onSubmit={save} className="mt-4 space-y-4">
        <Field label="Church office">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {["member", "worker", "pastor", "admin", "super_admin"].map((value) => (
              <option key={value} value={value}>
                {officeFor(value).label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
          <p className="font-medium">{preview.label}</p>
          <p className="mt-0.5">{preview.summary}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
            {preview.grants.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">Department positions</p>
          <div className="space-y-2">
            {(depts ?? []).map((d) => (
              <div key={d.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <span className="text-sm text-ink-700">{d.name}</span>
                <Select
                  value={positions[d.id] || "none"}
                  onChange={(e) =>
                    setPositions((prev) => ({ ...prev, [d.id]: e.target.value }))
                  }
                  className="w-52"
                >
                  {DEPARTMENT_POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Leader, HOD, Head, or Chairman immediately gives that department’s
            meeting and task access. Current office: {office.label}.
          </p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Update office
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Info({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value?: string | null;
  label?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 text-ink-600">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
      <span>
        {label && <span className="text-ink-400">{label}: </span>}
        {value}
      </span>
    </div>
  );
}

function GrowthModal({
  open,
  onClose,
  memberId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ type: "salvation", title: "", description: "", date: "" });
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost(`/members/${memberId}/growth`, form);
      notify("Milestone recorded");
      onClose();
      setForm({ type: "salvation", title: "", description: "", date: "" });
      onSaved();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Add growth milestone">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Type">
          <Select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="salvation">Salvation</option>
            <option value="baptism">Water Baptism</option>
            <option value="holy_ghost">Holy Ghost Baptism</option>
            <option value="membership_class">Membership Class</option>
            <option value="discipleship">Discipleship</option>
            <option value="promotion">Promotion</option>
            <option value="note">Note</option>
          </Select>
        </Field>
        <Field label="Title">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
        <Field label="Notes">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SupportModal({
  open,
  onClose,
  memberId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ type: "welfare", description: "", amount: "", date: "" });
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost(`/members/${memberId}/support`, {
        type: form.type,
        description: form.description,
        amount: form.amount ? Number(form.amount) : undefined,
        date: form.date || undefined,
      });
      notify("Support recorded");
      onClose();
      setForm({ type: "welfare", description: "", amount: "", date: "" });
      onSaved();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Record support / care">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Type">
          <Select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="welfare">Welfare</option>
            <option value="financial">Financial</option>
            <option value="counseling">Counseling</option>
            <option value="visitation">Visitation</option>
            <option value="prayer">Prayer</option>
            <option value="followup">Follow-up</option>
          </Select>
        </Field>
        <Field label="Amount (optional)">
          <Input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
