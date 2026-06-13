// One anime entry on the seasonal schedule.
export interface AnimeEntry {
  day: number; // weekday/category number, 1-based by appearance on the page
  index: number; // 1-based position within its day (after sorting)
  title: string;
  cover: string; // cover image URL (from data-src)
  time: string; // air time "HH:MM", or "" if unknown
  startDate: string; // first-air date like "4/6", or ""
  area: string; // broadcast region/platform, or ""
}

export interface WeekdayInfo {
  day: number; // 1-based
  name: string; // e.g. "周一 (月)" or "网络放送 & 其他"
}

export interface SeasonData {
  yearMonth: string; // e.g. "202604"
  weekdays: WeekdayInfo[];
  byDay: Record<number, AnimeEntry[]>;
}
