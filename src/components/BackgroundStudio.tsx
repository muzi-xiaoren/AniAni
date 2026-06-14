import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { bitmapFromBytes, canvasToPngBytes } from "../lib/compose";
import { FONTS, FONT_GROUPS, PALETTES, ROTATION_MODES, SHAPES, renderWordCloud, stopWordCloud } from "../lib/wordcloud";
import { CJK_FONTS, useInstalledCjkFonts } from "../lib/fontStore";
import { loadSettings, downloadWordCloud } from "../lib/settings";
import { FontManager } from "./FontManager";

// `key` resolves to an i18n label under `aspect.*`.
const ASPECTS = [
  { key: "wide", w: 1600, h: 900 },
  { key: "standard", w: 1600, h: 1200 },
  { key: "square", w: 1400, h: 1400 },
  { key: "ultrawide", w: 1680, h: 720 },
];

const BG_COLORS = [
  { key: "white", value: "#ffffff" },
  { key: "cream", value: "#fbf7ef" },
  { key: "gray", value: "#f1f3f5" },
  { key: "transparent", value: "transparent" },
];

// Resolve the chosen aspect to canvas dimensions; "image" follows the mask's own ratio.
function aspectDims(aspect: string, mask: ImageBitmap | null) {
  if (aspect === "image" && mask) {
    const L = 1600;
    return mask.width >= mask.height
      ? { w: L, h: Math.round((L * mask.height) / mask.width) }
      : { h: L, w: Math.round((L * mask.width) / mask.height) };
  }
  const a = ASPECTS[Number(aspect)] ?? ASPECTS[0];
  return { w: a.w, h: a.h };
}

// A labelled slider paired with a manual number input; both edit the same value.
function RangeField({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <label className="field">
      <span>
        {label}
        {hint ? <small> {hint}</small> : null}
      </span>
      <div className="range-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          type="number"
          className="range-num"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v) && e.target.value !== "") onChange(clamp(v));
          }}
        />
      </div>
    </label>
  );
}

interface Props {
  seasonTitles: string[];
  ym: string; // current season, used to name the downloaded word cloud
  onApply: (bytes: Uint8Array) => void;
  onClose: () => void;
}

export function BackgroundStudio({ seasonTitles, ym, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Tracks whether a press *started* on the backdrop, so dragging a slider past
  // its end and releasing on the backdrop doesn't get treated as a close click.
  const downOnBackdrop = useRef(false);
  const [text, setText] = useState("renyeren");
  const [shape, setShape] = useState("square");
  const [palette, setPalette] = useState("pastel");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [aspect, setAspect] = useState("0");
  const [rotate, setRotate] = useState(0.4);
  const [rotationMode, setRotationMode] = useState("any");
  const [fontFamily, setFontFamily] = useState(FONTS[0].value);
  const [density, setDensity] = useState(8); // gridSize
  const [sizeScale, setSizeScale] = useState(1);
  const [textOpacity, setTextOpacity] = useState(1); // 0..1 alpha of the words
  const [dling, setDling] = useState(false);
  const [dlMsg, setDlMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [customFont, setCustomFont] = useState<{ family: string; name: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [showFontManager, setShowFontManager] = useState(false);

  // Downloaded CJK fonts appear in the dropdown alongside the bundled ones.
  const installedIds = useInstalledCjkFonts();
  const cjkOptions = CJK_FONTS.filter((f) => installedIds.includes(f.id)).map((f) => ({
    value: `"${f.family}",sans-serif`,
    label: t("studio.downloadedSuffix", { label: f.label }),
  }));

  // Shape-from-image (mask) state.
  const [mask, setMask] = useState<ImageBitmap | null>(null);
  const [maskName, setMaskName] = useState("");
  const [invert, setInvert] = useState(false);
  const [colorFromImage, setColorFromImage] = useState(false);
  const [threshold, setThreshold] = useState(0.6); // luminance cutoff for the fill region
  const [edges, setEdges] = useState(0); // 0 = off; >0 traces image outlines

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = aspectDims(aspect, mask);
    setRendering(true);
    renderWordCloud(canvas, {
      text,
      shape,
      palette,
      bgColor,
      width: w,
      height: h,
      rotate,
      rotationMode,
      fontFamily,
      density,
      sizeScale,
      textOpacity,
      mask: mask ? { image: mask, invert, colorFromImage, threshold, edges } : null,
    }).then(() => setRendering(false));
    return () => stopWordCloud();
    // text is read fresh whenever another control or 重新生成 triggers a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, palette, bgColor, aspect, rotate, rotationMode, fontFamily, density, sizeScale, textOpacity, nonce, mask, invert, colorFromImage, threshold, edges]);

  async function uploadFont() {
    try {
      const path = await open({ filters: [{ name: "字体", extensions: ["ttf", "otf", "woff", "woff2"] }] });
      if (!path || Array.isArray(path)) return;
      const bytes = await readFile(path);
      const family = "WCUserFont";
      const face = new FontFace(family, bytes);
      await face.load();
      document.fonts.add(face);
      setCustomFont({ family, name: path.split(/[/\\]/).pop() || "自定义字体" });
      setFontFamily(`"${family}",sans-serif`);
    } catch {
      /* cancelled or unsupported font */
    }
  }

  async function pickMask() {
    try {
      const path = await open({ filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }] });
      if (!path || Array.isArray(path)) return;
      const bytes = await readFile(path);
      setMask(await bitmapFromBytes(bytes));
      setMaskName(path.split(/[/\\]/).pop() || "形状图");
      setAspect("image"); // follow the uploaded image's own ratio by default
    } catch {
      /* user cancelled or decode failed */
    }
  }

  function apply() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvasToPngBytes(canvas).then(onApply);
  }

  // Save the current word cloud straight to <outputDir>/wordcloud/<ym>_wordcloud.png.
  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDling(true);
    setDlMsg(null);
    try {
      const bytes = await canvasToPngBytes(canvas);
      const s = await loadSettings();
      const path = await downloadWordCloud(s.outputDir, ym, bytes);
      setDlMsg({ ok: true, text: t("app.savedTo", { path }) });
    } catch (e) {
      setDlMsg({ ok: false, text: t("app.saveFailed", { err: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setDling(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose();
      }}
    >
      <div className="modal studio" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{t("studio.title")}</span>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>

        <div className="studio-body">
          <div className="studio-preview">
            <canvas ref={canvasRef} />
            {rendering && <div className="studio-rendering">{t("studio.rendering")}</div>}
          </div>

          <div className="studio-controls">
            <label className="field">
              <span>{t("studio.textLabel")}</span>
              <textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("studio.textPlaceholder")}
              />
            </label>
            <button className="chip" onClick={() => setText(seasonTitles.join(" "))} disabled={!seasonTitles.length}>
              {t("studio.fillSeason")}
            </button>

            <label className="field">
              <span>{t("studio.font")}</span>
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                {cjkOptions.length > 0 && (
                  <optgroup label={t("studio.downloadedGroup")}>
                    {cjkOptions.map((f) => (
                      <option key={f.label} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {FONT_GROUPS.map((g) => (
                  <optgroup key={g.group} label={t(`fontGroup.${g.group}`)}>
                    {g.fonts.map((f) => (
                      <option key={f.label} value={f.value}>
                        {f.tkey ? t(f.tkey) : f.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {customFont && (
                  <optgroup label={t("studio.customGroup")}>
                    <option value={`"${customFont.family}",sans-serif`}>{customFont.name}</option>
                  </optgroup>
                )}
              </select>
            </label>
            <button className="chip" onClick={() => setShowFontManager(true)}>
              {t("studio.downloadCjk")}
            </button>
            <button className="chip" onClick={uploadFont}>
              {customFont ? t("studio.fontUploaded", { name: customFont.name }) : t("studio.uploadFont")}
            </button>

            {/* shape-from-image */}
            <div className="field-group">
              <div className="field-group-head">{t("studio.shapeImage")}</div>
              <button className="chip" onClick={pickMask}>
                {mask ? t("studio.uploaded", { name: maskName }) : t("studio.uploadShape")}
              </button>
              {mask && (
                <>
                  <button
                    className="chip chip--x"
                    onClick={() => {
                      setMask(null);
                      setAspect("0");
                    }}
                  >
                    {t("studio.clearShape")}
                  </button>
                  <label className="opt">
                    <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
                    {t("studio.invert")}
                  </label>
                  <label className="opt">
                    <input
                      type="checkbox"
                      checked={colorFromImage}
                      onChange={(e) => setColorFromImage(e.target.checked)}
                    />
                    {t("studio.colorFromImage")}
                  </label>
                  <RangeField
                    label={t("studio.threshold")}
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(threshold * 100)}
                    onChange={(v) => setThreshold(v / 100)}
                  />
                  <RangeField
                    label={t("studio.edges")}
                    hint={t("studio.edgesHint")}
                    min={0}
                    max={20}
                    step={1}
                    value={edges}
                    onChange={setEdges}
                  />
                </>
              )}
            </div>

            <label className="field">
              <span>
                {t("studio.shape")}
                {mask ? t("studio.shapeOverridden") : ""}
              </span>
              <select value={shape} onChange={(e) => setShape(e.target.value)} disabled={!!mask}>
                {SHAPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(`shape.${s.value}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>
                {t("studio.palette")}
                {mask && colorFromImage ? t("studio.paletteIgnored") : ""}
              </span>
              <select value={palette} onChange={(e) => setPalette(e.target.value)}>
                {Object.keys(PALETTES).map((k) => (
                  <option key={k} value={k}>
                    {t(`palette.${k}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{t("studio.bgColor")}</span>
              <select value={bgColor} onChange={(e) => setBgColor(e.target.value)}>
                {BG_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {t(`bgColor.${c.key}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{t("studio.aspect")}</span>
              <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                {ASPECTS.map((a, i) => (
                  <option key={a.key} value={String(i)}>
                    {t(`aspect.${a.key}`)}
                  </option>
                ))}
                <option value="image" disabled={!mask}>
                  {t("studio.imageAspect")}
                  {mask ? "" : t("studio.needShapeFirst")}
                </option>
              </select>
            </label>

            <label className="field">
              <span>{t("studio.layout")}</span>
              <select value={rotationMode} onChange={(e) => setRotationMode(e.target.value)}>
                {ROTATION_MODES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(`rotation.${r.value}`)}
                  </option>
                ))}
              </select>
            </label>

            <RangeField
              label={t("studio.rotateRatio")}
              min={0}
              max={100}
              step={1}
              value={Math.round(rotate * 100)}
              onChange={(v) => setRotate(v / 100)}
            />

            {/* smaller gridSize = denser; invert so a bigger number = denser */}
            <RangeField
              label={t("studio.density")}
              min={4}
              max={22}
              step={1}
              value={26 - density}
              onChange={(v) => setDensity(26 - v)}
            />

            <RangeField
              label={t("studio.fontSize")}
              min={0.5}
              max={2}
              step={0.1}
              value={sizeScale}
              onChange={setSizeScale}
            />

            <RangeField
              label={t("studio.textOpacity")}
              min={0}
              max={100}
              step={1}
              value={Math.round(textOpacity * 100)}
              onChange={(v) => setTextOpacity(v / 100)}
            />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={() => setNonce((n) => n + 1)} disabled={rendering}>
            {t("studio.regenerate")}
          </button>
          <button className="btn-ghost" onClick={download} disabled={rendering || dling}>
            {dling ? t("app.saving") : t("studio.download")}
          </button>
          {dlMsg && (
            <span className={`save-msg ${dlMsg.ok ? "save-msg--ok" : "save-msg--err"}`} title={dlMsg.text}>
              {dlMsg.text}
            </span>
          )}
          <div className="spacer" />
          <button className="btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn-primary" onClick={apply} disabled={rendering}>
            {t("studio.useAsBg")}
          </button>
        </div>

        {showFontManager && <FontManager onClose={() => setShowFontManager(false)} />}
      </div>
    </div>
  );
}
