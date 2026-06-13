import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { fetchSeasonHTML, toYearMonth } from "./lib/fetch";
import { parseSeasonHTML } from "./lib/parse";
import { normalizeSeason } from "./lib/schedule";
import { bitmapFromBytes, canvasToPngBytes, renderToCanvas } from "./lib/compose";
import {
  deleteSeason,
  getCoverBytes,
  listCachedSeasons,
  loadBackground,
  loadCachedSeason,
  loadProject,
  removeBackground,
  saveBackground,
  saveProject,
  saveSeason,
} from "./lib/store";
import { initCjkFonts } from "./lib/fontStore";
import type { AnimeEntry, SeasonData } from "./lib/types";
import { Cover } from "./components/Cover";
import { PreviewModal } from "./components/PreviewModal";
import { BackgroundStudio } from "./components/BackgroundStudio";
import { LANGS, setLang } from "./i18n";
import "./App.css";

// `key` resolves to an i18n label under `season.*`.
const SEASONS = [
  { m: 1, key: "winter" },
  { m: 4, key: "spring" },
  { m: 7, key: "summer" },
  { m: 10, key: "autumn" },
];

const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const YEARS = Array.from({ length: CUR_YEAR - 2017 + 1 }, (_, i) => 2018 + i).reverse();
const DEFAULT_MONTH = [10, 7, 4, 1].find((m) => m <= NOW.getMonth() + 1) ?? 1;

const keyOf = (e: AnimeEntry) => `${e.day}.${e.index}`;

interface Preview {
  url: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [year, setYear] = useState(CUR_YEAR);
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [cachedSeasons, setCachedSeasons] = useState<string[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Record<string, string>>({});
  const [addName, setAddName] = useState(true);
  const [addTime, setAddTime] = useState(true);
  const [border, setBorder] = useState(true);
  const [opacity, setOpacity] = useState(0.9);
  const [bg, setBg] = useState<{ bytes: Uint8Array; name: string } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [showStudio, setShowStudio] = useState(false);

  // Autosave is paused until the loaded season's project has been hydrated,
  // so restoring state doesn't immediately re-save (or clobber) it.
  const hydratedYm = useRef<string | null>(null);

  useEffect(() => {
    initCjkFonts();
    listCachedSeasons().then(setCachedSeasons);
  }, []);

  useEffect(() => {
    document.title = t("app.brand");
  }, [t, i18n.language]);

  /** Open a season: local cache first unless `force`, fetching + caching on miss. */
  async function openSeason(ym: string, force = false) {
    setLoading(true);
    setError("");
    try {
      let data: SeasonData | null = null;
      let cached = false;
      if (!force) {
        data = await loadCachedSeason(ym);
        cached = !!data;
      }
      if (!data) {
        const html = await fetchSeasonHTML(ym);
        data = normalizeSeason(parseSeasonHTML(html, ym));
        await saveSeason(ym, html, data);
        setCachedSeasons(await listCachedSeasons());
      }

      hydratedYm.current = null;
      const proj = await loadProject(ym);
      setSelected(proj?.selected ?? {});
      setScores(proj?.scores ?? {});
      setAddName(proj?.addName ?? true);
      setAddTime(proj?.addTime ?? true);
      setBorder(proj?.border ?? true);
      setOpacity(proj?.opacity ?? 0.9);
      const bgBytes = await loadBackground(ym);
      setBg(bgBytes ? { bytes: bgBytes, name: proj?.bgName || t("app.savedBgName") } : null);

      setSeason(data);
      setFromCache(cached);
      setYear(Number(ym.slice(0, 4)));
      setMonth(Number(ym.slice(4)));
      hydratedYm.current = ym;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // Persist selections / scores / options (debounced) once hydrated.
  useEffect(() => {
    if (!season || hydratedYm.current !== season.yearMonth) return;
    const ym = season.yearMonth;
    const t = setTimeout(() => {
      saveProject(ym, {
        selected,
        scores,
        addName,
        addTime,
        border,
        opacity,
        bgName: bg?.name ?? "",
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [selected, scores, addName, addTime, border, opacity, bg, season]);

  async function confirmDeleteSeason(ym: string) {
    const yes = await ask(t("app.deleteConfirm", { ym }), {
      title: t("app.deleteTitle"),
      kind: "warning",
    });
    if (!yes) return;
    try {
      await deleteSeason(ym);
      setCachedSeasons(await listCachedSeasons());
      if (season?.yearMonth === ym) {
        hydratedYm.current = null;
        setSeason(null);
        setSelected({});
        setScores({});
        setBg(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const selectedEntries = useMemo(() => {
    if (!season) return [];
    const out: AnimeEntry[] = [];
    for (const wd of season.weekdays) {
      for (const e of season.byDay[wd.day] || []) {
        if (selected[keyOf(e)]) out.push(e);
      }
    }
    return out;
  }, [season, selected]);

  const seasonTitles = useMemo(
    () => (season ? Object.values(season.byDay).flat().map((e) => e.title) : []),
    [season]
  );

  const wdName = (day: number) => season?.weekdays.find((w) => w.day === day)?.name ?? "";

  function toggle(e: AnimeEntry) {
    const k = keyOf(e);
    setSelected((s) => ({ ...s, [k]: !s[k] }));
  }

  async function applyBackground(bytes: Uint8Array, name: string) {
    setBg({ bytes, name });
    if (season) await saveBackground(season.yearMonth, bytes).catch(() => {});
  }

  async function pickBackground() {
    try {
      const path = await open({
        filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (!path || Array.isArray(path)) return;
      const bytes = await readFile(path);
      await applyBackground(bytes, path.split(/[/\\]/).pop() || t("app.bgImageName"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function clearBackground() {
    setBg(null);
    if (season) await removeBackground(season.yearMonth).catch(() => {});
  }

  async function generate() {
    if (!season || selectedEntries.length === 0) return;
    setGenerating(true);
    setError("");
    try {
      const ym = season.yearMonth;
      const covers = await Promise.all(
        selectedEntries.map((e) => getCoverBytes(ym, keyOf(e), e.cover).then(bitmapFromBytes))
      );
      const background = bg ? await bitmapFromBytes(bg.bytes) : null;
      const items = selectedEntries.map((e, i) => ({
        title: e.title,
        subtitle: `${wdName(e.day)} ${e.time}`.trim(),
        score: scores[keyOf(e)]?.trim() ?? "",
        cover: covers[i],
      }));

      const canvas = document.createElement("canvas");
      renderToCanvas(canvas, { items, background, addName, addTime, border, opacity });
      const bytes = await canvasToPngBytes(canvas);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/png" }));
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ url, bytes, width: canvas.width, height: canvas.height });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function savePng() {
    if (!preview || !season) return;
    setSaving(true);
    try {
      const path = await save({
        defaultPath: `${season.yearMonth}_tietie.png`,
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (path) await writeFile(path, preview.bytes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const total = season ? Object.values(season.byDay).reduce((n, l) => n + l.length, 0) : 0;
  const selCount = selectedEntries.length;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">{t("app.brand")}</h1>
        <div className="controls">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {t("app.yearUnit", { y })}
              </option>
            ))}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {SEASONS.map((s) => (
              <option key={s.m} value={s.m}>
                {t(`season.${s.key}`)}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => openSeason(toYearMonth(year, month))} disabled={loading}>
            {loading ? t("app.loading") : t("app.open")}
          </button>
          {season && (
            <span className="meta">
              {t("app.seasonMeta", { ym: season.yearMonth, total })}
              {fromCache ? ` · ${t("app.localCache")}` : ""}
            </span>
          )}
          {season && fromCache && (
            <button className="chip" onClick={() => openSeason(season.yearMonth, true)} disabled={loading}>
              {t("app.refetch")}
            </button>
          )}
        </div>
        <div className="spacer" />
        <select
          className="lang-select"
          value={i18n.resolvedLanguage}
          onChange={(e) => setLang(e.target.value)}
          aria-label="Language"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </header>

      {cachedSeasons.length > 0 && (
        <div className="seasons-bar">
          <span className="seasons-label">{t("app.cachedLabel")}</span>
          {cachedSeasons.map((ym) => (
            <span key={ym} className={`season-chip${season?.yearMonth === ym ? " season-chip--on" : ""}`}>
              <button className="season-chip-open" onClick={() => openSeason(ym)} disabled={loading}>
                {ym.slice(0, 4)}-{ym.slice(4)}
              </button>
              <button className="season-chip-del" title={t("app.delSeasonTitle")} onClick={() => confirmDeleteSeason(ym)}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {season && (
        <div className="toolbar">
          <button className="chip" onClick={() => setShowStudio(true)}>
            {t("app.wordCloudBg")}
          </button>
          <button className="chip" onClick={pickBackground}>
            {bg ? t("app.bgPrefix", { name: bg.name }) : t("app.pickBg")}
          </button>
          {bg && (
            <button className="chip chip--x" onClick={clearBackground}>
              {t("app.clearBg")}
            </button>
          )}
          <label className="opt">
            <input type="checkbox" checked={addName} onChange={(e) => setAddName(e.target.checked)} />
            {t("app.optName")}
          </label>
          <label className="opt">
            <input type="checkbox" checked={addTime} onChange={(e) => setAddTime(e.target.checked)} />
            {t("app.optTime")}
          </label>
          <label className="opt">
            <input type="checkbox" checked={border} onChange={(e) => setBorder(e.target.checked)} />
            {t("app.optBorder")}
          </label>
          <label className="opt opt--slider">
            {t("app.opacity")}
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
            <input
              type="number"
              className="range-num"
              min={30}
              max={100}
              step={5}
              value={Math.round(opacity * 100)}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v) && e.target.value !== "") setOpacity(Math.min(100, Math.max(30, v)) / 100);
              }}
            />
          </label>
          <div className="spacer" />
          <span className="meta">{t("app.selectedCount", { n: selCount })}</span>
          <button className="btn-primary" onClick={generate} disabled={selCount === 0 || generating}>
            {generating ? t("app.generating") : t("app.generate")}
          </button>
        </div>
      )}

      {error && <div className="banner banner--error">{error}</div>}

      {!season && !error && (
        <div className="empty">
          {t("app.emptyMain")}
          {cachedSeasons.length > 0 && <div className="empty-sub">{t("app.emptySub")}</div>}
        </div>
      )}

      {season && (
        <main className="board">
          {season.weekdays.map((wd) => {
            const entries = season.byDay[wd.day] || [];
            return (
              <section className="col" key={wd.day}>
                <h2 className="col-head">
                  {wd.name} <span className="col-count">{entries.length}</span>
                </h2>
                <ul className="cards">
                  {entries.map((e) => {
                    const k = keyOf(e);
                    const on = !!selected[k];
                    return (
                      <li className={`card${on ? " card--on" : ""}`} key={k} onClick={() => toggle(e)}>
                        <div className="card-check">{on ? "✓" : ""}</div>
                        <Cover url={e.cover} alt={e.title} ym={season.yearMonth} cacheKey={k} />
                        <div className="card-body">
                          <div className="card-title" title={e.title}>
                            {e.title}
                          </div>
                          <div className="card-sub">
                            {e.time || "—"}
                            {e.area ? ` · ${e.area}` : ""}
                          </div>
                          {on && (
                            <input
                              className="score-input"
                              placeholder={t("app.scorePlaceholder")}
                              value={scores[k] ?? ""}
                              onClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) => setScores((s) => ({ ...s, [k]: ev.target.value }))}
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </main>
      )}

      {showStudio && (
        <BackgroundStudio
          seasonTitles={seasonTitles}
          onApply={(bytes) => {
            applyBackground(bytes, t("app.wordCloudBgName"));
            setShowStudio(false);
          }}
          onClose={() => setShowStudio(false)}
        />
      )}

      {preview && (
        <PreviewModal
          url={preview.url}
          width={preview.width}
          height={preview.height}
          saving={saving}
          onSave={savePng}
          onClose={() => {
            URL.revokeObjectURL(preview.url);
            setPreview(null);
          }}
        />
      )}
    </div>
  );
}
