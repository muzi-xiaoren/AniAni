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
