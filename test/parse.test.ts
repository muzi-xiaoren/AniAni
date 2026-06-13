// Offline validation of the parser against a real cached page.
// Run with: npx tsx test/parse.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseHTML } from "linkedom";
import { parseSeasonDocument } from "../src/lib/parse";
import { normalizeSeason } from "../src/lib/schedule";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "202604.html"), "utf-8");

const { document } = parseHTML(html);
const data = parseSeasonDocument(document as unknown as Document, "202604");
normalizeSeason(data);

let total = 0;
for (const wd of data.weekdays) {
  const entries = data.byDay[wd.day] || [];
  total += entries.length;
  console.log(`\n${wd.name}  (${entries.length})`);
  for (const e of entries) {
    const bits = [
      `${e.index}.`,
      e.title || "‼无标题",
      `[${e.time || "—"}]`,
      e.startDate ? `开播${e.startDate}` : "",
      e.area || "",
      e.cover ? "" : "‼无封面",
    ].filter(Boolean);
    console.log("   " + bits.join(" "));
  }
}

const all = Object.values(data.byDay).flat();
const noTitle = all.filter((e) => !e.title).length;
const noCover = all.filter((e) => !e.cover).length;
const noTime = all.filter((e) => !e.time).length;
console.log("\n========== 体检 ==========");
console.log(`分类数: ${data.weekdays.length}`);
console.log(`番剧总数: ${total}`);
console.log(`缺标题: ${noTitle}   缺封面: ${noCover}   缺时间: ${noTime}`);
