import { useState } from "react";
import { HandCoins, Plus, CheckCircle2 } from "lucide-react";
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
} from "../../components/ui";
import { formatDate, naira } from "../../lib/format";
import { useToast } from "../../components/toast";

interface Donation {
  id: string;
  donor_name: string | null;
  member_first: string | null;
  member_last: string | null;
  type: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  created_at: string;
}
interface GivingData {
  donations: Donation[];
  totals: { type: string; count: number; total: number }[];
}

const TYPES = ["tithe", "offering", "seed", "building", "missions", "donation", "welfare"];

export default function Giving() {
  const { data, loading, reload } = useApi<GivingData>("/donations");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    donorName: "",
    type: "offering",
    amount: "",
    method: "cash",
  });
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  async function record(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/donations", {
        ...form,
        amount: Number(form.amount),
        status: "confirmed",
      });
      notify("Donation recorded");
      setOpen(false);
      setForm({ donorName: "", type: "offering", amount: "", method: "cash" });
      reload();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirm(id: string) {
    await apiPost(`/donations/${id}/confirm`);
    notify("Donation confirmed");
    reload();
  }

  const grandTotal = data?.totals.reduce((s, t) => s + t.total, 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Giving & Donations"
        subtitle="Tithes, offerings, seeds and project donations."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Record giving
          </Button>
        }
      />

      {loading || !data ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-gold-700">
                <HandCoins className="h-6 w-6" />
              </div>
              <p className="mt-4 font-display text-2xl font-semibold text-ink-900">
                {naira(grandTotal)}
              </p>
              <p className="text-sm text-ink-500">Total confirmed</p>
            </Card>
            {data.totals.slice(0, 3).map((t) => (
              <Card key={t.type} className="p-5">
                <Badge color="brand" className="capitalize">
                  {t.type}
                </Badge>
                <p className="mt-3 font-display text-2xl font-semibold text-ink-900">
                  {naira(t.total)}
                </p>
                <p className="text-sm text-ink-500">{t.count} gift(s)</p>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-3 font-medium">Donor</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Method</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {data.donations.map((d) => (
                    <tr key={d.id} className="hover:bg-brand-50/40">
                      <td className="px-5 py-3 font-medium text-ink-800">
                        {d.member_first
                          ? `${d.member_first} ${d.member_last}`
                          : d.donor_name || "Anonymous"}
                        {d.reference && (
                          <div className="text-xs font-normal text-ink-400">
                            {d.reference}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 capitalize text-ink-600">{d.type}</td>
                      <td className="px-5 py-3 font-medium text-ink-800">
                        {naira(d.amount)}
                      </td>
                      <td className="px-5 py-3 capitalize text-ink-600">{d.method}</td>
                      <td className="px-5 py-3 text-ink-500">{formatDate(d.created_at)}</td>
                      <td className="px-5 py-3">
                        <Badge color={d.status === "confirmed" ? "green" : "amber"}>
                          {d.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {d.status === "pending" && (
                          <Button size="sm" variant="secondary" onClick={() => confirm(d.id)}>
                            <CheckCircle2 className="h-4 w-4" /> Confirm
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.donations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-ink-400">
                        No donations recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Record giving">
        <form onSubmit={record} className="space-y-4">
          <Field label="Donor name">
            <Input
              value={form.donorName}
              onChange={(e) => setForm({ ...form, donorName: e.target.value })}
              placeholder="Optional (Anonymous if blank)"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Method">
              <Select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </Select>
            </Field>
          </div>
          <Field label="Amount (₦)">
            <Input
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" loading={saving}>
              Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
