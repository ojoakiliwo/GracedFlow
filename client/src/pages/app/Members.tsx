import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Users } from "lucide-react";
import { apiPost } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import {
  Avatar,
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
} from "../../components/ui";
import { classLabel, roleLabel, ROLES, SPIRITUAL_CLASSES } from "../../lib/format";
import { useToast } from "../../components/toast";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  spiritual_class: string;
  membership_status: string;
}

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "",
  role: "member",
  spiritualClass: "new_convert",
  dateOfBirth: "",
  weddingAnniversary: "",
  maritalStatus: "",
  address: "",
};

export default function Members() {
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("");
  const [role, setRole] = useState("");
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (cls) params.set("spiritualClass", cls);
  if (role) params.set("role", role);
  const { data, loading, reload } = useApi<Member[]>(
    `/members${params.toString() ? `?${params}` : ""}`,
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/members", form);
      notify("Member added successfully");
      setOpen(false);
      setForm(emptyForm);
      reload();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    data?.forEach((m) => (c[m.spiritual_class] = (c[m.spiritual_class] ?? 0) + 1));
    return c;
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Every soul God has added to our house."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add member
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email or phone"
              className="pl-9"
            />
          </div>
          <Select value={cls} onChange={(e) => setCls(e.target.value)} className="w-52">
            <option value="">All classes</option>
            {SPIRITUAL_CLASSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
                {counts[c.value] ? ` (${counts[c.value]})` : ""}
              </option>
            ))}
          </Select>
          <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-40">
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-7 w-7" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No members found"
          description="Try adjusting your filters or add a new member."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Class</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {data.map((m) => (
                  <tr key={m.id} className="group hover:bg-brand-50/40">
                    <td className="px-5 py-3">
                      <Link to={`/app/members/${m.id}`} className="flex items-center gap-3">
                        <Avatar first={m.first_name} last={m.last_name} />
                        <span className="font-medium text-ink-800 group-hover:text-brand-700">
                          {m.first_name} {m.last_name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink-500">
                      <div>{m.email || "—"}</div>
                      <div className="text-xs">{m.phone || ""}</div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge color="brand">{classLabel(m.spiritual_class)}</Badge>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{roleLabel(m.role)}</td>
                    <td className="px-5 py-3">
                      <Badge color={m.membership_status === "active" ? "green" : "gray"}>
                        {m.membership_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add new member" wide>
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name">
              <Input value={form.firstName} onChange={set("firstName")} required />
            </Field>
            <Field label="Last name">
              <Input value={form.lastName} onChange={set("lastName")} required />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={set("phone")} placeholder="+234..." />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onChange={set("gender")}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </Field>
            <Field label="Marital status">
              <Select value={form.maritalStatus} onChange={set("maritalStatus")}>
                <option value="">Select</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
              </Select>
            </Field>
            <Field label="Spiritual class">
              <Select value={form.spiritualClass} onChange={set("spiritualClass")}>
                {SPIRITUAL_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Role">
              <Select value={form.role} onChange={set("role")}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date of birth" hint="Used for birthday greetings">
              <Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
            </Field>
            <Field label="Wedding anniversary" hint="Used for anniversary greetings">
              <Input
                type="date"
                value={form.weddingAnniversary}
                onChange={set("weddingAnniversary")}
              />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address} onChange={set("address")} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
