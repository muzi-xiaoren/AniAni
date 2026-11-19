import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import i18n from "../i18n";

const BASE = "https://yuc.wiki";

function seasonUrl(yearMonth: string): string {
  return `${BASE}/${yearMonth}/`;
}

/** ym from a year + month, e.g. (2026, 4) -> "202604". */
export function toYearMonth(year: number, month: number): string {
  return `${year}${String(month).padStart(2, "0")}`;
}

/** Fetch the raw season page HTML through the Tauri http plugin (no CORS).
 *  Falls back to plain http when https fails — yuc.wiki has let its TLS
 *  certificate expire before (2026-07), which breaks every https request. */
export async function fetchSeasonHTML(yearMonth: string): Promise<string> {
  const url = seasonUrl(yearMonth);
  let res: Response;
  try {
    res = await tauriFetch(url, { method: "GET" });
  } catch {
    res = await tauriFetch(url.replace(/^https:/, "http:"), { method: "GET" });
  }
  if (!res.ok) throw new Error(i18n.t("errors.fetchPage", { status: res.status, url }));
  return await res.text();
}

/** Fetch one cover image as raw bytes. hdslb.com serves over http; the native
 *  request avoids the webview's mixed-content / CORS blocks. */
export async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const res = await tauriFetch(url, { method: "GET" });
  if (!res.ok) throw new Error(i18n.t("errors.fetchImage", { status: res.status }));
  return new Uint8Array(await res.arrayBuffer());
}
