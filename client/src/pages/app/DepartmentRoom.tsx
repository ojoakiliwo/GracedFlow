import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users } from "lucide-react";
import { apiPost } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Avatar, Badge, Button, Card, Input, Spinner } from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../components/toast";

interface RoomData {
  id: string;
  name: string;
  description: string | null;
  members: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    position: string;
  }[];
}
interface RoomMessage {
  id: string;
  author_name: string;
  body: string;
  member_id: string | null;
  created_at: string;
}

export default function DepartmentRoom() {
  const { id } = useParams();
  const { user, hasRole } = useAuth();
  const { data: dept, loading, reload } = useApi<RoomData>(`/departments/${id}`);
  const { data: messages, reload: reloadMessages } = useApi<RoomMessage[]>(`/departments/${id}/room`);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { notify } = useToast();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await apiPost(`/departments/${id}/room`, { body });
      setBody("");
      reloadMessages();
    } finally {
      setSending(false);
    }
  }

  if (loading || !dept)
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );

  return (
    <div>
      <Link
        to="/app/departments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> All departments
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex h-[70vh] flex-col lg:col-span-2">
          <div className="border-b border-ink-100 px-5 py-4">
            <h2 className="text-lg text-ink-900">{dept.name} · Room</h2>
            <p className="text-sm text-ink-500">
              Discuss, plan and hold meetings with your team.
            </p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {!messages || messages.length === 0 ? (
              <p className="mt-10 text-center text-sm text-ink-400">
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.member_id === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar
                      first={m.author_name?.split(" ")[0]}
                      last={m.author_name?.split(" ")[1]}
                      className="h-8 w-8 shrink-0 text-xs"
                    />
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        mine
                          ? "bg-brand-700 text-white"
                          : "bg-ink-100 text-ink-800"
                      }`}
                    >
                      {!mine && (
                        <p className="mb-0.5 text-xs font-semibold text-brand-700">
                          {m.author_name}
                        </p>
                      )}
                      <p className="text-sm">{m.body}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          mine ? "text-brand-200" : "text-ink-400"
                        }`}
                      >
                        {formatDateTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-ink-100 p-3">
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type a message to the room..."
            />
            <Button type="submit" loading={sending} disabled={!body.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-600" />
            <h3 className="text-lg text-ink-900">Members ({dept.members.length})</h3>
          </div>
          <ul className="space-y-2.5">
            {dept.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar first={m.first_name} last={m.last_name} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-800">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-xs capitalize text-ink-400">{m.position}</p>
                </div>
                {["leader", "hod", "head", "chairman"].includes(m.position.toLowerCase()) && (
                  <Badge color="gold">Leader</Badge>
                )}
                {hasRole("pastor") &&
                  !["leader", "hod", "head", "chairman"].includes(m.position.toLowerCase()) && (
                    <button
                      className="text-xs font-medium text-brand-700 hover:underline"
                      onClick={async () => {
                        try {
                          await apiPost(`/departments/${id}/members`, {
                            memberId: m.id,
                            position: "leader",
                          });
                          notify(`${m.first_name} is now the department leader`);
                          reload();
                        } catch (e) {
                          notify((e as Error).message, "error");
                        }
                      }}
                    >
                      Make leader
                    </button>
                  )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
