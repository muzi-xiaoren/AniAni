/**
 * Optional downloadable Chinese fonts (all SIL OFL, from the official
 * google/fonts repo via jsDelivr — single-file TTFs).
 *
 * They are NOT bundled (1.4–7.9 MB each); the user downloads the ones they
 * want, the file is stored in the app data dir under fonts/, registered via
 * FontFace at startup, and can be deleted any time. Downloaded fonts render
 * identically on macOS and Windows (unlike the system stacks).
 */
import { useSyncExternalStore } from "react";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { BaseDirectory, exists, mkdir, readFile, remove } from "@tauri-apps/plugin-fs";

export interface CjkFont {
  id: string; // file name stem
  label: string;
  family: string; // CSS font-family it registers as
  path: string; // path inside google/fonts repo, under ofl/
  sizeMB: number;
}

export const CJK_FONTS: CjkFont[] = [
  { id: "zcool-kuaile", label: "站酷快乐体", family: "ZCOOL KuaiLe", path: "zcoolkuaile/ZCOOLKuaiLe-Regular.ttf", sizeMB: 1.4 },
  { id: "zhi-mang-xing", label: "智芒星·手写", family: "Zhi Mang Xing", path: "zhimangxing/ZhiMangXing-Regular.ttf", sizeMB: 3.9 },
  { id: "liu-jian-mao-cao", label: "柳建·毛草书", family: "Liu Jian Mao Cao", path: "liujianmaocao/LiuJianMaoCao-Regular.ttf", sizeMB: 4.7 },
  { id: "long-cang", label: "龙藏·行书", family: "Long Cang", path: "longcang/LongCang-Regular.ttf", sizeMB: 4.9 },
  { id: "ma-shan-zheng", label: "马善政·毛笔楷书", family: "Ma Shan Zheng", path: "mashanzheng/MaShanZheng-Regular.ttf", sizeMB: 5.6 },
  { id: "zcool-xiaowei", label: "站酷小薇·标题", family: "ZCOOL XiaoWei", path: "zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf", sizeMB: 6.0 },
  { id: "zcool-huangyou", label: "站酷庆科黄油体", family: "ZCOOL QingKe HuangYou", path: "zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf", sizeMB: 7.9 },
];

// Mirror order: fastly first (more reliable in CN), then the default host.
const CDN_BASES = [
  "https://fastly.jsdelivr.net/gh/google/fonts@main/ofl/",
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/",
];

const FONTS_DIR = "fonts";
const BASE = { baseDir: BaseDirectory.AppData };

// ---- tiny external store so any component can subscribe to the installed list ----
let installed: string[] = []; // font ids
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
export function useInstalledCjkFonts(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => installed
  );
}

function fontFile(id: string) {
  return `${FONTS_DIR}/${id}.ttf`;
}

async function register(font: CjkFont, bytes: Uint8Array) {
  const face = new FontFace(font.family, bytes as unknown as ArrayBufferView);
  await face.load();
  document.fonts.add(face);
}

/** Scan the fonts dir at startup and register every downloaded font. */
export async function initCjkFonts(): Promise<void> {
  const found: string[] = [];
  for (const font of CJK_FONTS) {
    try {
      if (await exists(fontFile(font.id), BASE)) {
        await register(font, await readFile(fontFile(font.id), BASE));
        found.push(font.id);
      }
    } catch {
      /* unreadable file — treat as not installed */
    }
  }
  installed = found;
  emit();
}

/** Download one font (tries mirrors in order), store it, register it. */
export async function downloadCjkFont(id: string): Promise<void> {
  const font = CJK_FONTS.find((f) => f.id === id);
  if (!font) throw new Error(`未知字体: ${id}`);
  let bytes: Uint8Array | null = null;
  let lastErr = "";
  for (const base of CDN_BASES) {
    try {
      const res = await tauriFetch(base + font.path, { method: "GET" });
      if (res.ok) {
        bytes = new Uint8Array(await res.arrayBuffer());
        break;
      }
      lastErr = `HTTP ${res.status}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  if (!bytes) throw new Error(`下载失败(${lastErr})`);
  await mkdir(FONTS_DIR, { ...BASE, recursive: true });
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(fontFile(id), bytes, BASE);
  await register(font, bytes);
  if (!installed.includes(id)) {
    installed = [...installed, id];
    emit();
  }
}

/** Delete a downloaded font file. (FontFace stays usable until restart.) */
export async function removeCjkFont(id: string): Promise<void> {
  try {
    await remove(fontFile(id), BASE);
  } catch {
    /* already gone */
  }
  installed = installed.filter((x) => x !== id);
  emit();
}
