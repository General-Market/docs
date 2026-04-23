import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rename, rm, stat } from "node:fs/promises";
import type { ChildProcess } from "node:child_process";
import ffmpeg from "fluent-ffmpeg";
import { ProjectSchema } from "../../app/src/project/schema";

const Body = z.object({
  project: ProjectSchema,
  outPath: z.string().min(1),
  codec: z.literal("h264").optional(),
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE_ENTRY = resolve(__dirname, "../../remotion/bundle.ts");

/**
 * One render at a time. A queue is reserved for v1.1; UI already assumes this.
 */
interface ActiveRender {
  cancel: () => void;
  ffmpegProc?: ChildProcess;
  tmpPath?: string;
}
let active: ActiveRender | null = null;

function sseSend(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function applyLoudness(
  inPath: string,
  outPath: string,
  target: "-16 LUFS" | "-14 LUFS",
): Promise<void> {
  // Two-pass loudnorm. Pass 1 measures, pass 2 applies with measured values.
  const I = target === "-14 LUFS" ? -14 : -16;

  const measured = await new Promise<Record<string, string>>((resolvePromise, rejectPromise) => {
    let stderr = "";
    ffmpeg(inPath)
      .audioFilters([
        `loudnorm=I=${I}:TP=-1.5:LRA=11:print_format=json`,
      ])
      .format("null")
      .output("-")
      .on("stderr", (line: string) => {
        stderr += line + "\n";
      })
      .on("error", rejectPromise)
      .on("end", () => {
        const match = stderr.match(/\{[\s\S]*\}/);
        if (!match) return rejectPromise(new Error("loudnorm pass 1 produced no JSON"));
        try {
          resolvePromise(JSON.parse(match[0]));
        } catch (err) {
          rejectPromise(err as Error);
        }
      })
      .run();
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const filter =
      `loudnorm=I=${I}:TP=-1.5:LRA=11:` +
      `measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:` +
      `measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:` +
      `offset=${measured.target_offset}:linear=true:print_format=summary`;
    ffmpeg(inPath)
      .audioFilters([filter])
      .videoCodec("copy")
      .audioCodec("aac")
      .audioBitrate("192k")
      .on("error", rejectPromise)
      .on("end", () => resolvePromise())
      .save(outPath);
  });
}

const renderRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/render", async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    const { project, outPath } = parsed.data;

    if (active) {
      return reply.code(409).send({ error: "render already in progress" });
    }

    const wantsSse = (req.headers.accept ?? "").includes("text/event-stream");
    if (wantsSse) {
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      });
    }

    const loudness = project.meta.loudnessTarget;
    const needsLoudnessPass = loudness === "-16 LUFS" || loudness === "-14 LUFS";
    const renderPath = needsLoudnessPass ? outPath + ".pre-loud.mp4" : outPath;

    let cancelled = false;
    let bundler: typeof import("@remotion/bundler") | null = null;
    let renderer: typeof import("@remotion/renderer") | null = null;

    const handle: ActiveRender = {
      cancel: () => {
        cancelled = true;
      },
    };
    active = handle;

    try {
      try {
        bundler = await import("@remotion/bundler");
        renderer = await import("@remotion/renderer");
      } catch (err) {
        const e = err as Error;
        if (wantsSse) {
          sseSend(reply, "error", { error: e.message });
          reply.raw.end();
          return;
        }
        return reply.code(500).send({ error: `remotion not available: ${e.message}` });
      }

      if (wantsSse) sseSend(reply, "bundling", { entry: BUNDLE_ENTRY });
      const bundleLocation = await bundler.bundle({ entryPoint: BUNDLE_ENTRY });

      if (cancelled) throw new Error("cancelled");

      const composition = await renderer.selectComposition({
        serveUrl: bundleLocation,
        id: "MaxCut",
        inputProps: { project },
      });

      if (wantsSse) sseSend(reply, "rendering", { fps: project.meta.fps });

      await renderer.renderMedia({
        composition: {
          ...composition,
          fps: project.meta.fps,
          width: project.meta.width,
          height: project.meta.height,
          durationInFrames: Math.max(1, project.meta.duration || composition.durationInFrames),
        },
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: renderPath,
        inputProps: { project },
        onProgress: (p: {
          progress: number;
          renderedFrames: number;
          encodedFrames: number;
        }) => {
          if (cancelled) throw new Error("cancelled");
          if (wantsSse) {
            sseSend(reply, "progress", {
              progress: p.progress,
              renderedFrames: p.renderedFrames,
              encodedFrames: p.encodedFrames,
            });
          }
        },
      });

      if (cancelled) throw new Error("cancelled");

      if (needsLoudnessPass) {
        if (wantsSse) sseSend(reply, "loudness", { target: loudness });
        handle.tmpPath = renderPath;
        await applyLoudness(renderPath, outPath, loudness);
        await rm(renderPath, { force: true });
      } else if (renderPath !== outPath) {
        await rename(renderPath, outPath);
      }

      if (wantsSse) {
        sseSend(reply, "done", { outPath });
        reply.raw.end();
        return;
      }
      return reply.send({ ok: true, outPath });
    } catch (err) {
      const e = err as Error;
      // Clean up partial output on cancel / failure.
      await rm(renderPath, { force: true }).catch(() => {});
      if (renderPath !== outPath) {
        await rm(outPath, { force: true }).catch(() => {});
      }
      if (wantsSse) {
        sseSend(reply, cancelled ? "cancelled" : "error", { error: e.message });
        reply.raw.end();
        return;
      }
      return reply.code(500).send({ error: e.message });
    } finally {
      if (active === handle) active = null;
    }
  });

  app.post("/api/render/cancel", async (_req, reply) => {
    if (!active) return reply.send({ cancelled: false, reason: "no active render" });
    active.cancel();
    if (active.ffmpegProc && !active.ffmpegProc.killed) {
      active.ffmpegProc.kill("SIGTERM");
    }
    if (active.tmpPath) {
      await stat(active.tmpPath).then(
        () => rm(active!.tmpPath!, { force: true }),
        () => {},
      );
    }
    return reply.send({ cancelled: true });
  });

};

export default renderRoutes;
