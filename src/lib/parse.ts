import type { AnimeEntry, SeasonData, WeekdayInfo } from "./types";
import { parseRules as R } from "./parseRules";

/** Next sibling that is a <div> (mirrors BeautifulSoup's find_next_sibling('div')). */
function nextDivSibling(el: Element | null): Element | null {
  let n: Element | null = el ? el.nextElementSibling : null;
  while (n && n.tagName.toLowerCase() !== "div") n = n.nextElementSibling;
  return n;
}

/**
 * Smallest ancestor of the cover image that also contains a title cell.
 * This pairs a cover with its title WITHOUT relying on any class name or the
 * `style="float:left"` wrapper — robust to markup churn.
 */
function findEntryBlock(img: Element): Element {
  let n: Element | null = img.parentElement;
  while (n) {
    if (n.querySelector(R.titleSelector)) return n;
    n = n.parentElement;
  }
  return img.parentElement ?? img;
}

function cleanTitle(el: Element | null): string {
  if (!el) return "";
  // Titles use <br> to wrap; join the lines and strip any stray tags.
  const noBr = el.innerHTML.replace(/<br\s*\/?>/gi, "");
  const text = noBr.replace(/<[^>]+>/g, "");
  return text.replace(/\s+/g, " ").trim();
}

function extractTime(block: Element): string {
  for (const p of Array.from(block.querySelectorAll("p"))) {
    const m = (p.textContent || "").match(R.timeRegex);
    if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  }
  return "";
}

function extractStartDate(block: Element): string {
  const ep = block.querySelector(R.epSelector);
  const m = ep && (ep.textContent || "").match(R.startDateRegex);
  return m ? m[1] : "";
}

function extractArea(block: Element): string {
  const a = block.querySelector(R.areaSelector);
  return a ? (a.textContent || "").trim() : "";
}

/**
 * Parse a yuc.wiki season page into structured data.
 * Accepts a Document so it works with the browser's DOMParser AND with a
 * Node-side DOM (e.g. linkedom) for offline tests.
 */
export function parseSeasonDocument(doc: Document, yearMonth: string): SeasonData {
  const cells = Array.from(doc.querySelectorAll(R.weekdaySelector));
  const weekdays: WeekdayInfo[] = [];
  const byDay: Record<number, AnimeEntry[]> = {};

  cells.forEach((cell, i) => {
    const day = i + 1; // 1-based by appearance: 周一=1 … 周日=7, then extra categories
    weekdays.push({ day, name: (cell.textContent || "").trim() });

    const entriesDiv = nextDivSibling(cell.closest("div"));
    const entries: AnimeEntry[] = [];
    if (entriesDiv) {
      Array.from(entriesDiv.querySelectorAll(R.coverSelector)).forEach((img, idx) => {
        const block = findEntryBlock(img);
        entries.push({
          day,
          index: idx + 1,
          title: cleanTitle(block.querySelector(R.titleSelector)),
          cover: img.getAttribute("data-src") || img.getAttribute("src") || "",
          time: extractTime(block),
          startDate: extractStartDate(block),
          area: extractArea(block),
        });
      });
    }
    byDay[day] = entries;
  });

  return { yearMonth, weekdays, byDay };
}

/** Browser convenience wrapper. */
export function parseSeasonHTML(html: string, yearMonth: string): SeasonData {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return parseSeasonDocument(doc, yearMonth);
}
