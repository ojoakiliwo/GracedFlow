import { useState } from "react";
import { CalendarDays, MapPin, Plus, Video } from "lucide-react";
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
import { useAuth } from "../../lib/auth";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  department_name: string | null;
  scheduled_at: string;
  location: string | null;
  link: string | null;
  status: string;
}
interface Dept {
  id: string;
  name: string;
}
interface Review {
  id: string;
  meeting_title: string;
  scheduled_at: string;
  department_name: string | null;
  author_first: string;
  author_last: string;
  attendance_present: number;
  attendance_absent: number;
  review: string;
  created_at: string;
}

export default function Meetings() {
  const { data, loading, reload } = useApi<Meeting[]>("/meetings");
  const { data: depts } = useApi<Dept[]>("/departments");
  const { hasRole, leadsDepartment, user } = useAuth();
  const { data: reviews, reload: reloadReviews } = useApi<Review[]>(
    hasRole("pastor") ? "/meetings/reviews" : null,
  );
  const canSchedule = hasRole("admin") || (user?.ledDepartments?.length ?? 0) > 0;
  const scheduleDepts = hasRole("admin")
    ? depts
    : depts?.filter((d) => leadsDepartment(d.id));
  const [open, setOpen] = useState(false);
  const [reviewFor, setReviewFor] = useState<Meeting | null>(null);
  const [reviewForm, setReviewForm] = useState({
    review: "",
    attendancePresent: "0",
    attendanceAbsent: "0",
  });
  const [form, setForm] = useState({
    title: "",
    description: "",
    departmentId: "",
    scheduledAt: "",
    location: "",
    link: "",
  });
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/meetings", {
        ...form,
        departmentId: form.departmentId || undefined,
      });
      notify("Meeting scheduled");
      setOpen(false);
      setForm({
        title: "",
        description: "",
        departmentId: "",
        scheduledAt: "",
        location: "",
        link: "",
      });
      reload();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewFor) return;
    setSaving(true);
    try {
      await apiPost(`/meetings/${reviewFor.id}/reviews`, {
        review: reviewForm.review,
        attendancePresent: Number(reviewForm.attendancePresent) || 0,
        attendanceAbsent: Number(reviewForm.attendanceAbsent) || 0,
      });
      notify("Attendance review submitted");
      setReviewFor(null);
      setReviewForm({ review: "", attendancePresent: "0", attendanceAbsent: "0" });
      reloadReviews();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Meetings"
        subtitle="Department leaders schedule their team's meetings. Pastors see attendance reviews."
        actions={
          canSchedule ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Schedule meeting
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-7 w-7" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="No meetings scheduled"
          description={
            canSchedule
              ? "Schedule a meeting for your department."
              : "Your department leader will post meetings here."
          }
        />
      ) : (
        <div className="space-y-3">
          {data.map((m) => {
            const upcoming = new Date(m.scheduled_at) >= new Date();
            const canReview = leadsDepartment(m.department_id);
            return (
              <Card key={m.id} className="flex flex-wrap items-center gap-4 p-5">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl grace-gradient text-white">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-ink-900">{m.title}</h3>
                    <Badge color={upcoming ? "green" : "gray"}>
                      {upcoming ? "Upcoming" : "Past"}
                    </Badge>
                    {m.department_name && <Badge color="brand">{m.department_name}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-500">{formatDateTime(m.scheduled_at)}</p>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-ink-400">
                    {m.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {m.location}
                      </span>
                    )}
                    {m.link && (
                      <a
                        href={m.link}
                        className="flex items-center gap-1 text-brand-600 hover:underline"
                      >
                        <Video className="h-3.5 w-3.5" /> Join online
                      </a>
                    )}
                  </div>
                </div>
                {canReview && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReviewFor(m);
                      setReviewForm({ review: "", attendancePresent: "0", attendanceAbsent: "0" });
                    }}
                  >
                    Attendance review
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {hasRole("pastor") && reviews && reviews.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-ink-900">Attendance reviews</h2>
          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink-900">{r.meeting_title}</h3>
                  {r.department_name && <Badge color="brand">{r.department_name}</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {r.author_first} {r.author_last} · {formatDateTime(r.created_at)} · Present{" "}
                  {r.attendance_present} · Absent {r.attendance_absent}
                </p>
                <p className="mt-2 text-sm text-ink-700">{r.review}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Schedule a meeting">
        <form onSubmit={create} className="space-y-4">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label="Room / Department">
            <Select
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              {hasRole("admin") && <option value="">All workers (general)</option>}
              {scheduleDepts?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date & time">
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
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
            <Field label="Online link">
              <Input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="https://meet..."
              />
            </Field>
          </div>
          <Field label="Agenda / description">
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
              Schedule
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!reviewFor}
        onClose={() => setReviewFor(null)}
        title={reviewFor ? `Review · ${reviewFor.title}` : "Attendance review"}
      >
        <form onSubmit={submitReview} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Present">
              <Input
                type="number"
                min={0}
                value={reviewForm.attendancePresent}
                onChange={(e) =>
                  setReviewForm({ ...reviewForm, attendancePresent: e.target.value })
                }
              />
            </Field>
            <Field label="Absent">
              <Input
                type="number"
                min={0}
                value={reviewForm.attendanceAbsent}
                onChange={(e) =>
                  setReviewForm({ ...reviewForm, attendanceAbsent: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Review for pastors">
            <Textarea
              value={reviewForm.review}
              onChange={(e) => setReviewForm({ ...reviewForm, review: e.target.value })}
              required
              placeholder="How did the meeting go? Who was missing? What should pastors know?"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReviewFor(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Submit review
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
