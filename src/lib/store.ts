/**
 * Per-season persistence in the app data directory (design idea A):
 *
 *   seasons/<YYYYMM>/page.html        raw fetched page (re-parse offline if rules change)
 *   seasons/<YYYYMM>/data.json        parsed SeasonData
 *   seasons/<YYYYMM>/covers/<d.i>.jpg downloaded cover images (cache-first)
 *   seasons/<YYYYMM>/background.png   chosen/generated background
 *   seasons/<YYYYMM>/project.json     selections, scores, options
 *
 * Nothing is ever deleted automatically — only via deleteSeason().
 */
import {
  BaseDirectory,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { fetchImageBytes } from "./fetch";
import type { SeasonData } from "./types";

const BASE = { baseDir: BaseDirectory.AppData };
const dir = (ym: string) => `seasons/${ym}`;

export interface ProjectState {
  selected: Record<string, boolean>;
  scores: Record<string, string>;
  addName: boolean;
  addTime: boolean;
  border: boolean;
  opacity: number;
  bgName: string; // display name of the stored background, "" if none
}

/** Persist a freshly fetched season (raw html + parsed data). */
export async function saveSeason(ym: string, html: string, data: SeasonData): Promise<void> {
  await mkdir(dir(ym), { ...BASE, recursive: true });
  await writeTextFile(`${dir(ym)}/page.html`, html, BASE);
  await writeTextFile(`${dir(ym)}/data.json`, JSON.stringify(data), BASE);
}

/** Load a cached season, or null if not cached. */
export async function loadCachedSeason(ym: string): Promise<SeasonData | null> {
  try {
    if (!(await exists(`${dir(ym)}/data.json`, BASE))) return null;
    return JSON.parse(await readTextFile(`${dir(ym)}/data.json`, BASE)) as SeasonData;
  } catch {
    return null;
  }
}

/** All cached season ids, newest first. */
export async function listCachedSeasons(): Promise<string[]> {
  try {
    const entries = await readDir("seasons", BASE);
    return entries
      .filter((e) => e.isDirectory && /^\d{6}$/.test(e.name))
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch {
    return []; // seasons/ doesn't exist yet
  }
}

/** Delete one season's entire cache (covers, background, project — everything). */
export async function deleteSeason(ym: string): Promise<void> {
  await remove(dir(ym), { ...BASE, recursive: true });
}

// ---- covers (cache-first) ----

/** Get cover bytes: local cache first, else fetch from the CDN and cache. */
export async function getCoverBytes(ym: string, key: string, url: string): Promise<Uint8Array> {
  const rel = `${dir(ym)}/covers/${key}.jpg`;
  try {
    return await readFile(rel, BASE);
  } catch {
    /* not cached yet */
  }
  const bytes = await fetchImageBytes(url);
  try {
    await mkdir(`${dir(ym)}/covers`, { ...BASE, recursive: true });
    await writeFile(rel, bytes, BASE);
  } catch {
    /* cache write failure is non-fatal */
  }
  return bytes;
}

// ---- project (selections / scores / options) ----

export async function saveProject(ym: string, p: ProjectState): Promise<void> {
  await mkdir(dir(ym), { ...BASE, recursive: true });
  await writeTextFile(`${dir(ym)}/project.json`, JSON.stringify(p), BASE);
}

export async function loadProject(ym: string): Promise<ProjectState | null> {
  try {
    if (!(await exists(`${dir(ym)}/project.json`, BASE))) return null;
    return JSON.parse(await readTextFile(`${dir(ym)}/project.json`, BASE)) as ProjectState;
  } catch {
    return null;
  }
}

// ---- background image ----

export async function saveBackground(ym: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dir(ym), { ...BASE, recursive: true });
  await writeFile(`${dir(ym)}/background.png`, bytes, BASE);
}

export async function loadBackground(ym: string): Promise<Uint8Array | null> {
  try {
    if (!(await exists(`${dir(ym)}/background.png`, BASE))) return null;
    return await readFile(`${dir(ym)}/background.png`, BASE);
  } catch {
    return null;
  }
}

export async function removeBackground(ym: string): Promise<void> {
  try {
    await remove(`${dir(ym)}/background.png`, BASE);
  } catch {
    /* already gone */
  }
}
