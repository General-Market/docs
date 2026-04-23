import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { thumbsPath } from "../lib/paths";
import { generateSprite } from "../lib/ffmpeg";

const HEADER = "x-maxcut-project";

function projectHeader(req: FastifyRequest): string {
  const v = req.headers[HEADER];
  if (Array.isArray(v)) return v[0] ?? "";
  return (v as string | undefined) ?? "";
}

const Query = z.object({ path: z.string().optional() });

const inflight = new Map<string, Promise<void>>();

async function ensureSprite(
  projectPath: string,
  assetId: string,
  sourcePath: string,
): Promise<string> {
  const out = await thumbsPath(projectPath, assetId);
  const key = `${projectPath}::${assetId}`;

  const [outStat, srcStat] = await Promise.all([
    stat(out).catch(() => null),
    stat(sourcePath).catch(() => null),
  ]);
  if (!srcStat) {
    const err: NodeJS.ErrnoException = new Error(`source missing: ${sourcePath}`);
    err.code = "ENOENT";
    throw err;
  }
  if (outStat && outStat.mtimeMs > srcStat.mtimeMs) return out;

  if (inflight.has(key)) {
    await inflight.get(key);
    return out;
  }

  const task = generateSprite(sourcePath, out);
  inflight.set(key, task);
  try {
    await task;
  } finally {
    inflight.delete(key);
  }
  return out;
}

const thumbsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/thumbs/:file", async (req, reply) => {
    const { file } = req.params as { file: string };
    if (!file.endsWith(".webp")) {
      return reply.code(400).send({ error: "expected <assetId>.webp" });
    }
    const assetId = file.slice(0, -".webp".length);
    const q = Query.safeParse(req.query);
    if (!q.success) {
      return reply.code(400).send({ error: "invalid query", issues: q.error.issues });
    }
    const projectPath = projectHeader(req);
    const out = await thumbsPath(projectPath, assetId);

    try {
      if (q.data.path) {
        await ensureSprite(projectPath, assetId, q.data.path);
      } else {
        const s = await stat(out).catch(() => null);
        if (!s) {
          return reply.code(404).send({
            error: "sprite not cached and no source path supplied",
            hint: "pass ?path=<absolute> on first call",
          });
        }
      }
      const s = await stat(out);
      reply.header("content-type", "image/webp");
      reply.header("content-length", s.size.toString());
      return reply.send(createReadStream(out));
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return reply.code(404).send({ error: e.message });
      req.log.error({ err }, "thumbs failed");
      return reply.code(500).send({ error: e.message ?? "thumbs failed" });
    }
  });
};

export default thumbsRoutes;
