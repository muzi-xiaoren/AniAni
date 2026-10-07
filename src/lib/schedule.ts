import type { AnimeEntry, SeasonData } from "./types";

function toMinutes(time: string): number {
  const m = time.match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
}

/**
 * Move entries airing at >= 24:00 to the next weekday (hour - 24).
 * Mirrors tsdm.time_reload from the original project. Only weekdays 1..7.
 */
export function timeReload(byDay: Record<number, AnimeEntry[]>): void {
  for (let day = 1; day <= 7; day++) {
    if (!byDay[day]) continue;
    const nextDay = (day % 7) + 1;
    const keep: AnimeEntry[] = [];
    for (const e of byDay[day]) {
      const m = e.time.match(/(\d{1,2}):(\d{2})/);
      if (m && parseInt(m[1], 10) >= 24) {
        const nh = parseInt(m[1], 10) - 24;
        (byDay[nextDay] ||= []).push({
          ...e,
          day: nextDay,
          time: `${String(nh).padStart(2, "0")}:${m[2]}`,
        });
      } else {
        keep.push(e);
      }
    }
    byDay[day] = keep;
  }
}

/** Sort weekdays 1..7 by air time, then re-number index (1-based) for every day. */
export function sortAndReindex(byDay: Record<number, AnimeEntry[]>): void {
  for (const key of Object.keys(byDay)) {
    const day = Number(key);
    if (day >= 1 && day <= 7) {
      byDay[day].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
    }
    byDay[day].forEach((e, i) => (e.index = i + 1));
  }
}

/** Full post-parse normalization, in place; returns the same object for chaining. */
export function normalizeSeason(data: SeasonData): SeasonData {
  timeReload(data.byDay);
  sortAndReindex(data.byDay);
  return data;
}

/**
 * Stable identity of an entry: the cover file name (a content hash on the CDN),
 * falling back to the title. Unlike `${day}.${index}` it survives re-fetches —
 * once a season ends the site swaps air times for "完结", which reshuffles
 * day/index, and anything keyed by position would point at the wrong show.
 */
export function entryKey(e: AnimeEntry): string {
  const file = e.cover.split(/[?#]/)[0].split("/").pop() ?? "";
  const id = file.replace(/\.[a-z0-9]+$/i, "").replace(/[^\w-]/g, "");
  return id || `t_${e.title}`;
}

/** Legacy `${day}.${index}` keys (projects saved before entryKey existed). */
export const isLegacyKey = (k: string) => /^\d+\.\d+$/.test(k);

/** Translate legacy position keys to entryKey, using the data they were saved against. */
export function migrateKeys<T>(rec: Record<string, T>, prev: SeasonData): Record<string, T> {
  const byPos = new Map(Object.values(prev.byDay).flat().map((e) => [`${e.day}.${e.index}`, entryKey(e)]));
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!isLegacyKey(k)) out[k] = v;
    else if (byPos.has(k)) out[byPos.get(k)!] = v;
  }
  return out;
}

/**
 * After a re-fetch, restore air time + weekday for entries whose time vanished
 * (finished shows read "完结" instead of "23:00~"), then re-sort. Both inputs
 * are normalized, so the carried-over times are already past timeReload.
 */
export function carryOverSchedule(fresh: SeasonData, prev: SeasonData): SeasonData {
  const old = new Map(Object.values(prev.byDay).flat().map((e) => [entryKey(e), e]));
  const days = new Set(fresh.weekdays.map((w) => w.day));
  for (const key of Object.keys(fresh.byDay)) {
    const day = Number(key);
    fresh.byDay[day] = fresh.byDay[day].filter((e) => {
      const o = old.get(entryKey(e));
      if (e.time || !o?.time) return true;
      e.time = o.time;
      if (o.day === day || !days.has(o.day)) return true;
      (fresh.byDay[o.day] ||= []).push({ ...e, day: o.day });
      return false;
    });
  }
  sortAndReindex(fresh.byDay);
  return fresh;
}
