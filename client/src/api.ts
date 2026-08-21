export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function fetchTasks(): Promise<Task[]> {
  return handle<Task[]>(await fetch("/api/tasks"));
}

export async function createTask(title: string): Promise<Task> {
  return handle<Task>(
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  );
}

export async function updateTask(id: string, status: TaskStatus): Promise<Task> {
  return handle<Task>(
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
}

export async function deleteTask(id: string): Promise<void> {
  return handle<void>(await fetch(`/api/tasks/${id}`, { method: "DELETE" }));
}
