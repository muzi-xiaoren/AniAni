/**
 * App settings + image export.
 *
 * Generated images are written to a user-chosen base folder (configurable in the
 * Settings dialog), split into subfolders so different kinds don't mix:
 *   <base>/wordcloud/<ym>_wordcloud.png   word-cloud backgrounds
 *   <base>/before/<ym>_before.png         collage WITHOUT scores (不打分)
 *   <base>/after/<ym>_after.png           collage WITH scores (打分)
 *
 * Default base = <home>/追番贴贴. It must live under the user's home directory:
 * the app's file-access scope is $HOME/**, and OS permissions usually forbid
 * writing next to the installed app anyway.
 */
import { BaseDirectory, exists, mkdir, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { homeDir, join } from "@tauri-apps/api/path";

const APP = { baseDir: BaseDirectory.AppData };
const SETTINGS_FILE = "settings.json";

export interface Settings {
  outputDir: string; // absolute path
}

let cached: Settings | null = null;

/** Default export folder: <home>/追番贴贴. */
export async function defaultOutputDir(): Promise<string> {
  return await join(await homeDir(), "追番贴贴");
}

export async function loadSettings(): Promise<Settings> {
  if (cached) return cached;
  try {
    if (await exists(SETTINGS_FILE, APP)) {
      const s = JSON.parse(await readTextFile(SETTINGS_FILE, APP)) as Partial<Settings>;
      if (s.outputDir) {
        cached = { outputDir: s.outputDir };
        return cached;
      }
    }
  } catch {
    /* fall back to default */
  }
  cached = { outputDir: await defaultOutputDir() };
  return cached;
}

export async function saveSettings(s: Settings): Promise<void> {
  cached = s;
  try {
    await mkdir("", { ...APP, recursive: true });
  } catch {
    /* AppData root usually already exists */
  }
  await writeTextFile(SETTINGS_FILE, JSON.stringify(s), APP);
}

/** mkdir -p the parent folder, then write the file (absolute path, under $HOME). */
async function writeInto(absPath: string, bytes: Uint8Array): Promise<void> {
  const parent = absPath.replace(/[/\\][^/\\]+$/, "");
  await mkdir(parent, { recursive: true });
  await writeFile(absPath, bytes);
}

/** Save a collage; `scored` picks the after/before folder + name. Returns the path. */
export async function downloadCollage(
  outputDir: string,
  ym: string,
  scored: boolean,
  bytes: Uint8Array
): Promise<string> {
  const sub = scored ? "after" : "before";
  const path = await join(outputDir, sub, `${ym}_${sub}.png`);
  await writeInto(path, bytes);
  return path;
}

/** Save a word-cloud background to <base>/wordcloud/<ym>_wordcloud.png. Returns the path. */
export async function downloadWordCloud(outputDir: string, ym: string, bytes: Uint8Array): Promise<string> {
  const path = await join(outputDir, "wordcloud", `${ym}_wordcloud.png`);
  await writeInto(path, bytes);
  return path;
}
