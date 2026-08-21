import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { TaskStore } from "../src/tasks.js";

function appWithFreshStore() {
  return createApp(new TaskStore());
}

describe("GracedFlow API", () => {
  it("reports healthy", async () => {
    const res = await request(appWithFreshStore()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("starts with no tasks", async () => {
    const res = await request(appWithFreshStore()).get("/api/tasks");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("creates a task and lists it", async () => {
    const app = appWithFreshStore();
    const create = await request(app).post("/api/tasks").send({ title: "Write docs" });
    expect(create.status).toBe(201);
    expect(create.body.title).toBe("Write docs");
    expect(create.body.status).toBe("todo");
    expect(create.body.id).toBeTruthy();

    const list = await request(app).get("/api/tasks");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe("Write docs");
  });

  it("rejects empty titles", async () => {
    const res = await request(appWithFreshStore()).post("/api/tasks").send({ title: "  " });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it("updates a task status", async () => {
    const app = appWithFreshStore();
    const create = await request(app).post("/api/tasks").send({ title: "Ship it" });
    const id = create.body.id;
    const update = await request(app).patch(`/api/tasks/${id}`).send({ status: "done" });
    expect(update.status).toBe(200);
    expect(update.body.status).toBe("done");
  });

  it("returns 404 when updating a missing task", async () => {
    const res = await request(appWithFreshStore())
      .patch("/api/tasks/does-not-exist")
      .send({ status: "done" });
    expect(res.status).toBe(404);
  });

  it("deletes a task", async () => {
    const app = appWithFreshStore();
    const create = await request(app).post("/api/tasks").send({ title: "Temp" });
    const id = create.body.id;
    const del = await request(app).delete(`/api/tasks/${id}`);
    expect(del.status).toBe(204);
    const list = await request(app).get("/api/tasks");
    expect(list.body).toHaveLength(0);
  });
});
