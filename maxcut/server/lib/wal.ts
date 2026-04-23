import { open, appendFile, rm } from "node:fs/promises";
import type { Project } from "../../app/src/project/schema";
import { walPath } from "./paths";

/**
 * WAL v1 — append JSON lines. Every action is fsynced to disk.
 * Replay is a v2 problem. For now we preserve the log and hand back the base.
 */
export async function appendAction(
  projectPath: string,
  action: unknown,
): Promise<void> {
  const path = await walPath(projectPath);
  const line = JSON.stringify({ t: Date.now(), a: action }) + "\n";
  await appendFile(path, line, "utf8");
  // fsync so a crash does not amputate the last action.
  const fh = await open(path, "r+");
  try {
    await fh.sync();
  } finally {
    await fh.close();
  }
}

export async function replayFrom(
  _projectPath: string,
  baseProject: Project,
): Promise<Project> {
  // v1: identity. v2 will apply each logged action as a reducer.
  return baseProject;
}

export async function clearWal(projectPath: string): Promise<void> {
  const path = await walPath(projectPath);
  await rm(path, { force: true });
}
