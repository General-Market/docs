import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { stat, readFile, writeFile } from "node:fs/promises";
import { peaksPath } from "../lib/paths";
import { generatePeaks } from "../lib/ffmpeg";

const HEADER = "x-maxcut-project";

function projectHeader(req: FastifyRequest): string {
  const v = req.headers[HEADER];
  if (Array.isArray(v)) return v[0] ?? "";
  return (v as string | undefined) ?? "";
}

const ComputeBody = z.object({
  assetId: z.string().min(1),
  path: z.string().min(1),
});

const Query = z.object({
  tier: z.enum(["low", "high"]).default("low"),
  path: z.string().optional(),
});

/**
 * In-memory lock — two simultaneous requests for the same cache key
 * must not race onto the same file.
 */
const inflight = new Map<string, Promise<{ lowBytes: number; highBytes: number }>>();

async function ensurePeaks(
  projectPath: string,
  assetId: string,
  sourcePath: string,
): Promise<void> {
  const low = await peaksPath(projectPath, assetId, "low");
  const high = await peaksPath(projectPath, assetId, "high");
  const key = `${projectPath}::${assetId}`;

  const [lowStat, highStat, srcStat] = await Promise.all([
    stat(low).catch(() => null),
    stat(high).catch(() => null),
    stat(sourcePath).catch(() => null),
  ]);
  if (!srcStat) {
    const err: NodeJS.ErrnoException = new Error(`source missing: ${sourcePath}`);
    err.code = "ENOENT";
    throw err;
  }
  const fresh =
    lowStat && highStat && lowStat.mtimeMs > srcStat.mtimeMs && highStat.mtimeMs > srcStat.mtimeMs;
  if (fresh) return;

  if (inflight.has(key)) {
    await inflight.get(key);
    return;
  }

  const task = (async () => {
    const lowChunks: Buffer[] = [];
    const highChunks: Buffer[] = [];
    const result = await generatePeaks(
      sourcePath,
      async (buf) => {
        lowChunks.push(buf);
      },
      async (buf) => {
        highChunks.push(buf);
      },
    );
    await writeFile(low, Buffer.concat(lowChunks));
    await writeFile(high, Buffer.concat(highChunks));
    return result;
  })();
  inflight.set(key, task);
  try {
    await task;
  } finally {
    inflight.delete(key);
  }
}

const peaksRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/peaks/:assetId", async (req, reply) => {
    const { assetId } = req.params as { assetId: string };
    const q = Query.safeParse(req.query);
    if (!q.success) {
      return reply.code(400).send({ error: "invalid query", issues: q.error.issues });
    }
    const projectPath = projectHeader(req);
    const file = await peaksPath(projectPath, assetId, q.data.tier);

    try {
      if (q.data.path) {
        await ensurePeaks(projectPath, assetId, q.data.path);
      } else {
        const s = await stat(file).catch(() => null);
        if (!s) {
          return reply.code(404).send({
            error: "peaks not cached and no source path supplied",
            hint: "POST /api/peaks/compute or pass ?path=<absolute>",
          });
        }
      }
      const data = await readFile(file);
      reply.header("content-type", "application/octet-stream");
      reply.header("content-length", data.length.toString());
      return reply.send(data);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return reply.code(404).send({ error: e.message });
      req.log.error({ err }, "peaks failed");
      return reply.code(500).send({ error: e.message ?? "peaks failed" });
    }
  });

  app.post("/api/peaks/compute", async (req, reply) => {
    const parsed = ComputeBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    const projectPath = projectHeader(req);
    const { assetId, path } = parsed.data;

    try {
      await ensurePeaks(projectPath, assetId, path);
      const low = await peaksPath(projectPath, assetId, "low");
      const high = await peaksPath(projectPath, assetId, "high");
      const [lowStat, highStat] = await Promise.all([stat(low), stat(high)]);
      return reply.send({ lowBytes: lowStat.size, highBytes: highStat.size });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return reply.code(404).send({ error: e.message });
      req.log.error({ err }, "peaks compute failed");
      return reply.code(500).send({ error: e.message ?? "peaks compute failed" });
    }
  });
};

export default peaksRoutes;
