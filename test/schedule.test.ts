// Checks for schedule normalization and the stable-id logic that keeps covers,
// selections and scores attached to the right show across re-fetches.
// Run: npx tsx test/schedule.test.ts
import { carryOverSchedule, entryKey, isLegacyKey, migrateKeys, normalizeSeason } from "../src/lib/schedule";
import type { AnimeEntry, SeasonData } from "../src/lib/types";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) fails++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  got=${g} want=${w}`}`);
}

const entry = (day: number, id: string, time: string): AnimeEntry => ({
  day,
  index: 0,
  title: `show-${id}`,
  cover: `http://i0.hdslb.com/bfs/archive/${id}.jpg`,
  time,
  startDate: "",
  area: "",
});

function season(byDay: Record<number, AnimeEntry[]>): SeasonData {
  const weekdays = [1, 2, 3, 4, 5, 6, 7, 8].map((day) => ({ day, name: `d${day}` }));
  for (const w of weekdays) byDay[w.day] ||= [];
  return normalizeSeason({ yearMonth: "202604", weekdays, byDay });
}
const layout = (s: SeasonData) =>
  Object.fromEntries(
    Object.entries(s.byDay)
      .filter(([, l]) => l.length)
      .map(([d, l]) => [d, l.map((e) => `${e.index}:${entryKey(e)}@${e.time}`)])
  );

// ---- entryKey
eq("entryKey = cover file stem", entryKey(entry(1, "abc123", "")), "abc123");
eq(
  "entryKey ignores scheme, host, query",
  entryKey({ ...entry(1, "x", ""), cover: "https://i.imgs.ovh/a/b/abc123.webp?x=1#y" }),
  "abc123"
);
eq("entryKey falls back to title", entryKey({ ...entry(1, "x", ""), cover: "" }), "t_show-x");
eq("isLegacyKey", [isLegacyKey("3.12"), isLegacyKey("abc123"), isLegacyKey("3.12.jpg")], [true, false, false]);

// ---- normalizeSeason: late-night shows roll over, days sort by time
const base = season({
  1: [entry(1, "late", "25:30"), entry(1, "b", "23:00"), entry(1, "a", "21:00")],
  2: [entry(2, "c", "22:00")],
  7: [entry(7, "sun", "24:00")],
  8: [entry(8, "web2", ""), entry(8, "web1", "")],
});
eq("normalize: rollover + sort + reindex", layout(base), {
  1: ["1:sun@00:00", "2:a@21:00", "3:b@23:00"],
  2: ["1:late@01:30", "2:c@22:00"],
  8: ["1:web2@", "2:web1@"], // extra categories keep page order
});

// ---- migrateKeys: legacy "<day>.<index>" -> entryKey, using the data they were saved against
eq(
  "migrateKeys",
  migrateKeys({ "1.2": true, "2.1": true, "9.9": true, kept: false }, base),
  { a: true, late: true, kept: false }
);

// ---- carryOverSchedule: the site drops air times once a show ends
const fresh = season({
  1: [entry(1, "late", ""), entry(1, "b", ""), entry(1, "a", "21:00"), entry(1, "new", "")],
  2: [entry(2, "c", "22:30")],
  7: [entry(7, "sun", "")],
  8: [entry(8, "web2", ""), entry(8, "web1", "")],
});
carryOverSchedule(fresh, base);
eq("carryOver: times + weekdays restored, new data wins", layout(fresh), {
  1: ["1:new@", "2:sun@00:00", "3:a@21:00", "4:b@23:00"],
  2: ["1:late@01:30", "2:c@22:30"],
  8: ["1:web2@", "2:web1@"],
});
eq(
  "carryOver: every entry's day matches its bucket",
  Object.entries(fresh.byDay).every(([d, l]) => l.every((e) => e.day === Number(d))),
  true
);

console.log(fails === 0 ? "\n全部通过 ✅" : `\n${fails} 项失败 ❌`);
if (fails) process.exit(1);
