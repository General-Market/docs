import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import assetsRoutes from "./routes/assets";
import peaksRoutes from "./routes/peaks";
import thumbsRoutes from "./routes/thumbs";
import transcribeRoutes from "./routes/transcribe";
import renderRoutes from "./routes/render";
import projectRoutes from "./routes/project";

const PORT = Number(process.env.MAXCUT_PORT ?? 5182);
const HOST = process.env.MAXCUT_HOST ?? "127.0.0.1";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".m4v": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const MediaQuery = z.object({ path: z.string().min(1) });

async function build() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      try {
        const u = new URL(origin);
        const ok =
          u.hostname === "localhost" ||
          u.hostname === "127.0.0.1" ||
          u.hostname === "[::1]" ||
          u.hostname.endsWith(".localhost") ||
          u.protocol === "tauri:" ||
          u.protocol === "http+tauri:";
        cb(null, ok);
      } catch {
        cb(null, false);
      }
    },
    credentials: true,
  });

  // Range-aware media proxy. Reads an arbitrary absolute path supplied as query.
  // Browsers cannot `file://` — the app goes through here to play local assets.
  app.get("/media/*", async (req, reply) => {
    const q = MediaQuery.safeParse(req.query);
    if (!q.success) {
      return reply.code(400).send({ error: "missing ?path=<absolute>" });
    }
    const abs = resolve(q.data.path);
    const fileStat = await stat(abs).catch(() => null);
    if (!fileStat || !fileStat.isFile()) {
      return reply.code(404).send({ error: "not found", path: abs });
    }
    const mime = MIME[extname(abs).toLowerCase()] ?? "application/octet-stream";
    const size = fileStat.size;
    const range = req.headers.range;

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : size - 1;
        if (
          Number.isNaN(start) ||
          Number.isNaN(end) ||
          start < 0 ||
          end >= size ||
          start > end
        ) {
          reply.header("content-range", `bytes */${size}`);
          return reply.code(416).send();
        }
        reply.code(206);
        reply.header("content-range", `bytes ${start}-${end}/${size}`);
        reply.header("accept-ranges", "bytes");
        reply.header("content-length", (end - start + 1).toString());
        reply.header("content-type", mime);
        return reply.send(createReadStream(abs, { start, end }));
      }
    }

    reply.header("accept-ranges", "bytes");
    reply.header("content-length", size.toString());
    reply.header("content-type", mime);
    return reply.send(createReadStream(abs));
  });

  app.get("/health", async () => ({ ok: true, service: "maxcut", port: PORT }));

  await app.register(assetsRoutes);
  await app.register(peaksRoutes);
  await app.register(thumbsRoutes);
  await app.register(transcribeRoutes);
  await app.register(renderRoutes);
  await app.register(projectRoutes);

  return app;
}

async function main() {
  const app = await build();
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`maxcut server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Run when invoked as entry.
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("server/index.ts") ||
    process.argv[1].endsWith("server/index.js") ||
    process.argv[1].endsWith("server\\index.ts") ||
    process.argv[1].endsWith("server\\index.js"));
if (isDirectRun) {
  void main();
}

export { build };
