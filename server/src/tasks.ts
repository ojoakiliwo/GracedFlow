import { randomUUID } from "node:crypto";

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  status?: TaskStatus;
}

const VALID_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

export class TaskStore {
  private tasks: Task[] = [];

  list(): Task[] {
    return [...this.tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  create(input: CreateTaskInput): Task {
    const title = input.title?.trim();
    if (!title) {
      throw new ValidationError("title is required");
    }
    const status = input.status ?? "todo";
    if (!VALID_STATUSES.includes(status)) {
      throw new ValidationError(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    const task: Task = {
      id: randomUUID(),
      title,
      status,
      createdAt: new Date().toISOString(),
    };
    this.tasks.push(task);
    return task;
  }

  update(id: string, status: TaskStatus): Task {
    if (!VALID_STATUSES.includes(status)) {
      throw new ValidationError(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    const task = this.tasks.find((t) => t.id === id);
    if (!task) {
      throw new NotFoundError(`task ${id} not found`);
    }
    task.status = status;
    return task;
  }

  remove(id: string): void {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new NotFoundError(`task ${id} not found`);
    }
    this.tasks.splice(index, 1);
  }

  clear(): void {
    this.tasks = [];
  }
}

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
