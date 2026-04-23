import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { probe } from "../lib/ffmpeg";

const ProbeBody = z.object({
  path: z.string().min(1),
});

const assetsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/assets/probe", async (req, reply) => {
    const parsed = ProbeBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    try {
      const r = await probe(parsed.data.path);
      const fps = r.fps || 60;
      const durationFrames = Math.round(r.durationSec * fps);
      return reply.send({
        duration: durationFrames,
        fps,
        width: r.width,
        height: r.height,
        audioChannels: r.audioChannels,
        audioSampleRate: r.audioSampleRate,
        videoCodec: r.videoCodec,
        audioCodec: r.audioCodec,
        container: r.container,
        bitrate: r.bitrate,
      });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") {
        return reply.code(404).send({ error: "file not found", path: parsed.data.path });
      }
      req.log.error({ err }, "probe failed");
      return reply.code(500).send({ error: e.message ?? "probe failed" });
    }
  });
};

export default assetsRoutes;
