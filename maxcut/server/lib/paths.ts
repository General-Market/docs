import { mkdir } from "node:fs/promises";
import { dirname, join, resolve, basename } from "node:path";

/**
 * All sidecars live next to the project file in a `.maxcut` directory.
 * Caches are keyed to this directory — one project, one set of caches.
 * If no project path is given, fall back to cwd-local `./project.maxcut.json`.
 */
export function normalizeProjectPath(projectPath?: string | null): string {
  const raw = projectPath && projectPath.trim().length > 0
    ? projectPath
    : "./project.maxcut.json";
  return resolve(raw);
}

export async function maxcutDir(projectPath: string): Promise<string> {
  const abs = normalizeProjectPath(projectPath);
  const dir = join(dirname(abs), ".maxcut");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function peaksDir(projectPath: string): Promise<string> {
  const dir = join(await maxcutDir(projectPath), "peaks");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function thumbsDir(projectPath: string): Promise<string> {
  const dir = join(await maxcutDir(projectPath), "thumbs");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function backupsDir(projectPath: string): Promise<string> {
  const dir = join(await maxcutDir(projectPath), "backups");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function historyDir(projectPath: string): Promise<string> {
  const dir = join(await maxcutDir(projectPath), "history");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function peaksPath(
  projectPath: string,
  assetId: string,
  tier: "low" | "high",
): Promise<string> {
  const hz = tier === "low" ? 200 : 1000;
  return join(await peaksDir(projectPath), `${assetId}.${hz}.peaks`);
}

export async function thumbsPath(projectPath: string, assetId: string): Promise<string> {
  return join(await thumbsDir(projectPath), `${assetId}.webp`);
}

export async function walPath(projectPath: string): Promise<string> {
  return join(await maxcutDir(projectPath), "wal.jsonl");
}

export function projectBasename(projectPath: string): string {
  return basename(normalizeProjectPath(projectPath));
}
