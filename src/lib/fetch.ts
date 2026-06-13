import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { parseSeasonHTML } from "./parse";
import { normalizeSeason } from "./schedule";
import type { SeasonData } from "./types";

const BASE = "https://yuc.wiki";

export function seasonUrl(yearMonth: string): string {
  return `${BASE}/${yearMonth}/`;
}

/** ym from a year + month, e.g. (2026, 4) -> "202604". */
export function toYearMonth(year: number, month: number): string {
  return `${year}${String(month).padStart(2, "0")}`;
}

/** Fetch the raw season page HTML through the Tauri http plugin (no CORS). */
export async function fetchSeasonHTML(yearMonth: string): Promise<string> {
  const res = await tauriFetch(seasonUrl(yearMonth), { method: "GET" });
  if (!res.ok) throw new Error(`抓取页面失败:HTTP ${res.status}(${seasonUrl(yearMonth)})`);
  return await res.text();
}

/** Fetch one cover image as raw bytes. hdslb.com serves over http; the native
 *  request avoids the webview's mixed-content / CORS blocks. */
export async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const res = await tauriFetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`图片下载失败:HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Fetch + parse + normalize a whole season. */
export async function loadSeasonFromWeb(yearMonth: string): Promise<SeasonData> {
  const html = await fetchSeasonHTML(yearMonth);
  return normalizeSeason(parseSeasonHTML(html, yearMonth));
}
