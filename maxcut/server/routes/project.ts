import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { readFile, writeFile, rename, stat, copyFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { ProjectSchema } from "../../app/src/project/schema";
import { backupsDir } from "../lib/paths";

const GetQuery = z.object({ path: z.string().min(1) });
const PostBody = z.object({ path: z.string().min(1), project: ProjectSchema });
const RelinkBody = z.object({ path: z.string().min(1) });

function tsStamp(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/project", async (req, reply) => {
    const q = GetQuery.safeParse(req.query);
    if (!q.success) {
      return reply.code(400).send({ error: "invalid query", issues: q.error.issues });
    }
    const abs = resolve(q.data.path);
    try {
      const raw = await readFile(abs, "utf8");
      const json: unknown = JSON.parse(raw);
      const parsed = ProjectSchema.safeParse(json);
      if (!parsed.success) {
        return reply.code(400).send({ error: "schema validation failed", issues: parsed.error.issues });
      }
      return reply.send({ path: abs, project: parsed.data });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return reply.code(404).send({ error: "project not found", path: abs });
      return reply.code(400).send({ error: e.message ?? "parse failed" });
    }
  });

  app.post("/api/project", async (req, reply) => {
    const parsed = PostBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    const abs = resolve(parsed.data.path);
    const serialized = JSON.stringify(parsed.data.project, null, 2) + "\n";

    try {
      // Back up existing file before overwrite.
      const existing = await stat(abs).catch(() => null);
      if (existing) {
        const backups = await backupsDir(abs);
        const backupName = `${basename(abs)}.${tsStamp()}.json`;
        await copyFile(abs, join(backups, backupName));
      }

      // Atomic write via tmp + rename on same dir.
      const tmp = join(dirname(abs), `.${basename(abs)}.${process.pid}.${Date.now()}.tmp`);
      await writeFile(tmp, serialized, "utf8");
      await rename(tmp, abs);
      return reply.send({ ok: true, path: abs });
    } catch (err) {
      const e = err as Error;
      req.log.error({ err }, "project write failed");
      return reply.code(500).send({ error: e.message ?? "write failed" });
    }
  });

  app.post("/api/project/relink", async (req, reply) => {
    const parsed = RelinkBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    const abs = resolve(parsed.data.path);
    try {
      const raw = await readFile(abs, "utf8");
      const json: unknown = JSON.parse(raw);
      const pj = ProjectSchema.safeParse(json);
      if (!pj.success) {
        return reply.code(400).send({ error: "schema validation failed", issues: pj.error.issues });
      }
      const projectDir = dirname(abs);
      const missing: { id: string; path: string }[] = [];
      for (const asset of pj.data.media) {
        const assetAbs = resolve(projectDir, asset.path);
        const s = await stat(assetAbs).catch(() => null);
        if (!s) missing.push({ id: asset.id, path: asset.path });
      }
      return reply.send({ missing });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return reply.code(404).send({ error: "project not found", path: abs });
      return reply.code(500).send({ error: e.message ?? "relink failed" });
    }
  });
};

export default projectRoutes;
