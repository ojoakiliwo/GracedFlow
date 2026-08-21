import { useEffect, useMemo, useState } from "react";
import {
  createTask,
  deleteTask,
  fetchTasks,
  updateTask,
  type Task,
  type TaskStatus,
} from "./api";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];

function nextStatus(status: TaskStatus): TaskStatus {
  const idx = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks()
      .then(setTasks)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      done: tasks.filter((t) => t.status === "done").length,
    };
  }, [tasks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const created = await createTask(trimmed);
      setTasks((prev) => [created, ...prev]);
      setTitle("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCycleStatus(task: Task) {
    setError(null);
    try {
      const updated = await updateTask(task.id, nextStatus(task.status));
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(task: Task) {
    setError(null);
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero__mark" aria-hidden>~</div>
        <h1>GracedFlow</h1>
        <p>Track your work, one graceful flow at a time.</p>
        <div className="hero__stats">
          <span>
            <strong>{stats.total}</strong> total
          </span>
          <span>
            <strong>{stats.done}</strong> done
          </span>
        </div>
      </header>

      <main className="panel">
        <form className="composer" onSubmit={handleCreate}>
          <input
            aria-label="New task title"
            placeholder="What needs to flow today?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" disabled={!title.trim()}>
            Add task
          </button>
        </form>

        {error && <p className="error" role="alert">{error}</p>}

        {loading ? (
          <p className="muted">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="muted">No tasks yet. Add your first one above.</p>
        ) : (
          <ul className="tasks">
            {tasks.map((task) => (
              <li key={task.id} className={`task task--${task.status}`}>
                <button
                  className={`chip chip--${task.status}`}
                  onClick={() => handleCycleStatus(task)}
                  title="Click to change status"
                >
                  {STATUS_LABELS[task.status]}
                </button>
                <span className="task__title">{task.title}</span>
                <button
                  className="task__delete"
                  onClick={() => handleDelete(task)}
                  aria-label={`Delete ${task.title}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="footer">
        <span>GracedFlow · local development</span>
      </footer>
    </div>
  );
}
