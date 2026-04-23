import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractWav } from "../lib/ffmpeg";

const Body = z.object({
  assetId: z.string().min(1),
  path: z.string().min(1),
});

interface ParakeetWord {
  text?: string;
  word?: string;
  start?: number;
  end?: number;
  confidence?: number;
}

/** Walk the parakeet-mlx JSON and extract words with timestamps. */
function extractWords(obj: unknown): { text: string; start: number; end: number; confidence: number }[] {
  const out: { text: string; start: number; end: number; confidence: number }[] = [];

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const rec = node as Record<string, unknown>;
    if (Array.isArray(rec.words)) {
      for (const w of rec.words) {
        if (w && typeof w === "object") {
          const pw = w as ParakeetWord;
          const text = pw.text ?? pw.word;
          if (text && typeof pw.start === "number" && typeof pw.end === "number") {
            out.push({
              text: String(text),
              start: pw.start,
              end: pw.end,
              confidence: typeof pw.confidence === "number" ? pw.confidence : 1,
            });
          }
        }
      }
    }
    for (const value of Object.values(rec)) visit(value);
  };

  visit(obj);
  return out;
}

function runParakeet(wavPath: string): Promise<string> {
  return new Promise<string>((resolvePromise, rejectPromise) => {
    const proc = spawn(
      "parakeet-mlx",
      ["transcribe", wavPath, "--timestamps", "word", "--json"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    proc.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    proc.on("error", (err: NodeJS.ErrnoException) => rejectPromise(err));
    proc.on("close", (code) => {
      if (code === 0) return resolvePromise(stdout);
      const err: NodeJS.ErrnoException & { stderr?: string } = new Error(
        `parakeet-mlx exited ${code}`,
      );
      err.stderr = stderr;
      rejectPromise(err);
    });
  });
}

const transcribeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/transcribe", async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    const { path } = parsed.data;

    let workDir: string | null = null;
    try {
      workDir = await mkdtemp(join(tmpdir(), "maxcut-stt-"));
      const wav = join(workDir, "audio.wav");
      await extractWav(path, wav, 16000);

      let raw: string;
      try {
        raw = await runParakeet(wav);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === "ENOENT") {
          return reply.code(503).send({ error: "parakeet-mlx not installed" });
        }
        throw err;
      }

      // parakeet-mlx may print log lines before the JSON. If stdout is not pure JSON,
      // find the first '{' or '[' and parse from there; otherwise try reading a sibling
      // .json file next to the wav (some builds write that way).
      let parsed_json: unknown;
      try {
        parsed_json = JSON.parse(raw);
      } catch {
        const idx = Math.min(
          ...[raw.indexOf("{"), raw.indexOf("[")].filter((i) => i >= 0),
        );
        if (Number.isFinite(idx) && idx >= 0) {
          parsed_json = JSON.parse(raw.slice(idx));
        } else {
          // fallback: look for a sidecar json file
          try {
            parsed_json = JSON.parse(await readFile(wav.replace(/\.wav$/, ".json"), "utf8"));
          } catch {
            return reply.code(500).send({ error: "parakeet-mlx produced no JSON" });
          }
        }
      }

      const words = extractWords(parsed_json);
      return reply.send({ words });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      req.log.error({ err }, "transcribe failed");
      return reply.code(500).send({ error: e.message ?? "transcribe failed" });
    } finally {
      if (workDir) {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  });
};

export default transcribeRoutes;
