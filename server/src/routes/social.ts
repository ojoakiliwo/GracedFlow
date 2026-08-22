import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { config } from "../config.js";
import { publishToPlatform } from "../comms.js";
import { HttpError, audit, newId, nowIso } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

export const socialRouter = Router();
socialRouter.use(authenticate);

socialRouter.get(
  "/",
  requireRole("pastor"),
  asyncHandler(async (_req, res) => {
    const posts = (await db
      .prepare("SELECT * FROM social_posts ORDER BY created_at DESC LIMIT 100")
      .all()) as { id: string; platforms: string }[];
    const withTargets = await Promise.all(
      posts.map(async (p) => ({
        ...p,
        platforms: JSON.parse(p.platforms) as string[],
        targets: await db
          .prepare("SELECT * FROM social_post_targets WHERE post_id = ?")
          .all(p.id),
      })),
    );
    res.json({ connected: config.social.connected, posts: withTargets });
  }),
);

const postSchema = z.object({
  content: z.string().min(1),
  mediaUrl: z.string().optional().nullable(),
  platforms: z.array(z.string()).min(1),
});

// Compose a post and distribute it to every selected social platform.
socialRouter.post(
  "/",
  requireRole("pastor"),
  asyncHandler(async (req, res) => {
    const input = parseBody(postSchema, req.body);
    const id = newId("post");
    await db.prepare(
      `INSERT INTO social_posts (id, content, media_url, platforms, status, created_by, published_at)
       VALUES (?, ?, ?, ?, 'publishing', ?, NULL)`,
    ).run(
      id,
      input.content,
      input.mediaUrl ?? null,
      JSON.stringify(input.platforms),
      req.user!.id,
    );

    let published = 0;
    for (const platform of input.platforms) {
      const result = await publishToPlatform(platform, input.content);
      await db.prepare(
        `INSERT INTO social_post_targets (id, post_id, platform, status, external_url, error, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId("tgt"),
        id,
        platform,
        result.ok ? "published" : "failed",
        result.externalUrl ?? null,
        result.error ?? null,
        result.ok ? nowIso() : null,
      );
      if (result.ok) published++;
    }
    await db.prepare(
      "UPDATE social_posts SET status = 'published', published_at = ? WHERE id = ?",
    ).run(nowIso(), id);
    audit("publish", "social_post", id, req.user, { platforms: input.platforms });

    res.status(201).json({ id, platforms: input.platforms.length, published });
  }),
);

socialRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const post = await db.prepare("SELECT * FROM social_posts WHERE id = ?").get(req.params.id);
    if (!post) throw new HttpError(404, "Post not found");
    const targets = await db.prepare("SELECT * FROM social_post_targets WHERE post_id = ?")
      .all(req.params.id);
    res.json({ ...(post as object), targets });
  }),
);
