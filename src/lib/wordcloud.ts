import WordCloud from "wordcloud";

export const PALETTES: Record<string, { label: string; colors: string[] }> = {
  pastel: { label: "马卡龙", colors: ["#ff9aa2", "#ffb7b2", "#ffdac1", "#b5ead7", "#c7ceea", "#f7c6ff"] },
  candy: { label: "糖果", colors: ["#ff6aa2", "#8a6cff", "#ffd166", "#06d6a0", "#118ab2"] },
  cool: { label: "清凉", colors: ["#4dabf7", "#3bc9db", "#748ffc", "#9775fa", "#5c7cfa"] },
  warm: { label: "暖阳", colors: ["#ff6b6b", "#f06595", "#ff922b", "#fab005", "#e8590c"] },
  ink: { label: "墨灰", colors: ["#343a40", "#495057", "#868e96", "#adb5bd"] },
};

export const SHAPES: { value: string; label: string }[] = [
  { value: "square", label: "铺满" },
  { value: "circle", label: "圆形" },
  { value: "cardioid", label: "心形" },
  { value: "diamond", label: "菱形" },
  { value: "triangle", label: "三角" },
  { value: "pentagon", label: "五边形" },
  { value: "star", label: "星形" },
];

// Font options, grouped for an <optgroup> picker. Bundled Latin fonts (shipped
// with the app, identical on every OS) each carry a CJK fallback so Chinese text
// still renders. System stacks cover CJK directly. Custom uploads append at runtime.
// `group` is an i18n key under `fontGroup.*`; Latin fonts show their family name
// as-is, while system fonts carry a `tkey` so their label is localized.
const CJK_FALLBACK = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif';
const latin = (family: string) => ({ value: `"${family}",${CJK_FALLBACK}`, label: family });

export interface FontOption {
  value: string;
  label: string; // shown as-is (font family name) unless `tkey` is set
  tkey?: string; // i18n key, for system fonts whose label is localized
}

export interface FontGroup {
  group: string; // i18n key under `fontGroup.*`
  fonts: FontOption[];
}

export const FONT_GROUPS: FontGroup[] = [
  {
    group: "script",
    fonts: [
      latin("Pacifico"),
      latin("Dancing Script"),
      latin("Great Vibes"),
      latin("Sacramento"),
      latin("Allura"),
      latin("Satisfy"),
      latin("Caveat"),
      latin("Shadows Into Light"),
      latin("Indie Flower"),
      latin("Kalam"),
      latin("Gloria Hallelujah"),
      latin("Permanent Marker"),
      latin("Courgette"),
    ],
  },
  {
    group: "poster",
    fonts: [
      latin("Bebas Neue"),
      latin("Anton"),
      latin("Oswald"),
      latin("Archivo Black"),
      latin("Abril Fatface"),
      latin("Lobster"),
      latin("Titan One"),
      latin("Righteous"),
    ],
  },
  {
    group: "fun",
    fonts: [
      latin("Bungee"),
      latin("Monoton"),
      latin("Press Start 2P"),
      latin("Bangers"),
      latin("Fredoka"),
      latin("Comfortaa"),
      latin("Amatic SC"),
    ],
  },
  {
    group: "cjk",
    fonts: [
      { value: '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif', label: "System Sans", tkey: "font.heiti" },
      { value: '"Songti SC","STSong","SimSun",serif', label: "System Serif", tkey: "font.songti" },
      { value: '"Kaiti SC","STKaiti","KaiTi",cursive', label: "System Kai", tkey: "font.kaiti" },
    ],
  },
];

// Flat list (used for default selection and any non-grouped consumers).
export const FONTS = FONT_GROUPS.flatMap((g) => g.fonts);

export const ROTATION_MODES: { value: string; label: string }[] = [
  { value: "tilt", label: "轻微倾斜" },
  { value: "h", label: "仅水平" },
  { value: "hv", label: "水平/垂直" },
  { value: "any", label: "任意角度" },
];

function rotationParams(mode: string) {
  switch (mode) {
    case "h":
      return { minRotation: 0, maxRotation: 0, rotationSteps: 1 };
    case "hv":
      return { minRotation: -Math.PI / 2, maxRotation: Math.PI / 2, rotationSteps: 2 };
    case "any":
      return { minRotation: -Math.PI / 2, maxRotation: Math.PI / 2, rotationSteps: 7 };
    default:
      return { minRotation: -Math.PI / 4, maxRotation: Math.PI / 4, rotationSteps: 2 };
  }
}

export interface MaskConfig {
  image: ImageBitmap;
  invert: boolean; // flip which region counts as the shape
  colorFromImage: boolean; // sample word colors from the uploaded image
  threshold: number; // 0..1 luminance cutoff: pixels darker than this become "shape"
  edges: number; // 0..20 edge-detection strength (0 = off, higher = trace more outlines)
}

export interface WordCloudConfig {
  text: string; // words, separated by spaces / commas
  shape: string;
  palette: string;
  bgColor: string; // "transparent" for none
  width: number;
  height: number;
  rotate: number; // rotateRatio 0..1: fraction of words rotated
  fontFamily: string; // CSS font stack (or an uploaded font family)
  density: number; // wordcloud2 gridSize — smaller = denser
  sizeScale: number; // multiplier on word size (weightFactor)
  rotationMode: string; // 'tilt' | 'h' | 'hv' | 'any'
  mask?: MaskConfig | null;
}

const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Noto Sans CJK SC",sans-serif';

function buildList(text: string, density = 1): [string, number][] {
  const words = text
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (words.length === 0) return [];
  const out: [string, number][] = [];
  const target = Math.max(60, words.length * 6) * density;
  for (let i = 0; i < target; i++) {
    out.push([words[i % words.length], 2 + Math.random() * 9]);
  }
  return out;
}

/** Draw an image "contain"-fitted into a w×h canvas; return its ImageData. */
function fitImageData(image: ImageBitmap, w: number, h: number): ImageData {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const s = Math.min(w / image.width, h / image.height);
  const dw = image.width * s;
  const dh = image.height * s;
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Build a white-on-transparent alpha mask: opaque where words may land.
 *
 * Two controls shape the region (matching wordart.com's "Threshold" + "Edges"):
 *  - `threshold` (0..1): pixels darker than this luminance become solid "fill".
 *    Lower it to keep words in only the darker parts of a photo; raise it to fill more.
 *  - `edges` (0..20): when > 0, a Sobel edge detector marks high-contrast outlines
 *    as shape too, so words trace the image's contours. Higher = more/finer edges.
 */
function buildMaskAlpha(src: ImageData, cfg: MaskConfig): HTMLCanvasElement {
  const { width: w, height: h, data } = src;
  const n = w * h;
  const lum = new Float32Array(n);
  const alpha = new Uint8ClampedArray(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    lum[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    alpha[p] = data[i + 3];
  }

  const cut = Math.max(0, Math.min(1, cfg.threshold)) * 255;
  const shape = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (alpha[p] <= 40) continue; // transparent pixels never count
    const dark = lum[p] < cut;
    if (cfg.invert ? !dark : dark) shape[p] = 1;
  }

  // Edge pass: union detected outlines into the shape. Higher `edges` → lower
  // gradient cutoff → more pixels qualify as an edge.
  if (cfg.edges > 0) {
    const edgeCut = 24 + (20 - Math.min(20, cfg.edges)) * 22;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (alpha[p] <= 40) continue;
        const tl = lum[p - w - 1], t = lum[p - w], tr = lum[p - w + 1];
        const l = lum[p - 1], r = lum[p + 1];
        const bl = lum[p + w - 1], b = lum[p + w], br = lum[p + w + 1];
        const gx = -tl - 2 * l - bl + tr + 2 * r + br;
        const gy = -tl - 2 * t - tr + bl + 2 * b + br;
        if (gx * gx + gy * gy > edgeCut * edgeCut) shape[p] = 1;
      }
    }
  }

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const out = ctx.createImageData(w, h);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    out.data[i] = 255;
    out.data[i + 1] = 255;
    out.data[i + 2] = 255;
    out.data[i + 3] = shape[p] ? 255 : 0;
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

function colorFn(palette: string[]) {
  return () => palette[Math.floor(Math.random() * palette.length)];
}

/** Color callback that samples the fitted source image at each word's position. */
function imageColorFn(src: ImageData, palette: string[]) {
  const { width: w, height: h, data } = src;
  const cx = w / 2;
  const cy = h / 2;
  return (_word: string, _weight: number, _fs: number, distance: number, theta: number) => {
    const x = Math.round(cx + distance * Math.cos(theta));
    const y = Math.round(cy - distance * Math.sin(theta));
    if (x >= 0 && x < w && y >= 0 && y < h) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] > 40) return `rgb(${data[idx]},${data[idx + 1]},${data[idx + 2]})`;
    }
    return palette[Math.floor(Math.random() * palette.length)];
  };
}

/**
 * Render a word cloud into `canvas`. Resolves when wordcloud2 finishes
 * (it draws progressively), with a timeout fallback.
 */
export async function renderWordCloud(canvas: HTMLCanvasElement, cfg: WordCloudConfig): Promise<void> {
  canvas.width = cfg.width;
  canvas.height = cfg.height;
  const ctx = canvas.getContext("2d")!;

  // Make sure the chosen font (and the glyphs we need) is loaded before drawing,
  // otherwise the canvas silently falls back to a default font.
  const family = cfg.fontFamily.match(/"([^"]+)"/)?.[1] ?? cfg.fontFamily.split(",")[0].trim();
  try {
    await document.fonts.load(`bold 40px "${family}"`, cfg.text || "国");
  } catch {
    /* font may already be present or unavailable; fall back gracefully */
  }

  const transparent = !cfg.bgColor || cfg.bgColor === "transparent";
  const palette = (PALETTES[cfg.palette] ?? PALETTES.pastel).colors;
  const hasMask = !!cfg.mask;
  const list = buildList(cfg.text, hasMask ? 2 : 1);

  if (list.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      ctx.fillStyle = cfg.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return Promise.resolve();
  }

  // For masks: fit the image, build the shape alpha + (optional) color sampling.
  const srcData = hasMask ? fitImageData(cfg.mask!.image, cfg.width, cfg.height) : null;
  const maskAlpha = hasMask && srcData ? buildMaskAlpha(srcData, cfg.mask!) : null;
  const color =
    hasMask && cfg.mask!.colorFromImage && srcData ? imageColorFn(srcData, palette) : colorFn(palette);

  // Masking by PLACEMENT, not clipping: wordcloud2 with clearCanvas:false treats a
  // grid cell as fillable only when all its pixels equal the background. So we leave
  // the shape area at the background and paint everything else with an opaque block
  // colour — words then land *whole* inside the shape and never get sliced mid-glyph.
  if (hasMask && maskAlpha) {
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height); // shape stays transparent == bgPixel
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height); // block everywhere…
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(maskAlpha, 0, 0); // …then carve the shape back to transparent
    ctx.globalCompositeOperation = "source-over";
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      canvas.removeEventListener("wordcloudstop", finish);
      if (hasMask && maskAlpha) {
        // Drop the black blocking area (no words were placed there), keeping the
        // shape's words; then paint the requested background behind them.
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(maskAlpha, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        if (!transparent) {
          ctx.globalCompositeOperation = "destination-over";
          ctx.fillStyle = cfg.bgColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      resolve();
    };
    canvas.addEventListener("wordcloudstop", finish);

    WordCloud(canvas, {
      list,
      fontFamily: cfg.fontFamily || FONT,
      fontWeight: "700",
      gridSize: cfg.density,
      weightFactor: (cfg.width / 120) * cfg.sizeScale,
      color,
      // Masked: keep the pre-painted canvas (clearCanvas:false) and treat the shape
      // (transparent) as empty. Unmasked: normal clear + chosen background.
      backgroundColor: hasMask || transparent ? "rgba(0,0,0,0)" : cfg.bgColor,
      rotateRatio: cfg.rotate,
      ...rotationParams(cfg.rotationMode),
      shape: hasMask ? "square" : cfg.shape,
      ellipticity: cfg.height / cfg.width,
      drawOutOfBound: false, // never let a word spill past the canvas / shape edge
      shrinkToFit: true,
      clearCanvas: !hasMask,
    });

    setTimeout(finish, 9000);
  });
}

/** Abort an in-progress render (config changed / modal closed). */
export function stopWordCloud() {
  WordCloud.stop();
}
