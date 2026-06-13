/**
 * Canvas port of the original pic_produce.py compositing.
 * Lays selected covers onto a background in a grid whose aspect ratio best
 * matches the background, draws a white photo border, then the title (+score)
 * and weekday/time under each cover.
 */

// Layout constants (same proportions as the original).
const COVER_W = 600;
const COVER_H = 750;
const BORDER = 15;
const TEXT_H = 100;
const CELL_W = COVER_W + 2 * BORDER; // 630
const CELL_H = COVER_H + 2 * BORDER + TEXT_H; // 880
// Minimum spacing between cells AND around the whole grid, so covers never
// touch the canvas edges (in cover-space px).
const GAP = 100;

export interface RenderItem {
  title: string;
  subtitle: string; // e.g. "周一 (月) 21:00"
  score: string; // "" when not scored
  cover: ImageBitmap;
}

export interface RenderConfig {
  items: RenderItem[];
  background: ImageBitmap | null;
  addName: boolean;
  addTime: boolean;
  border: boolean; // draw the white "sticker" frame around each cover
  opacity: number; // 0..1, applied to covers + text (background stays opaque)
}

/** Choose (cols, rows) whose ratio is closest to the background aspect ratio. */
export function bestGrid(n: number, aspect: number): { cols: number; rows: number } {
  let best = { cols: 1, rows: n };
  let min = Infinity;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const diff = Math.abs(cols / rows - aspect);
    if (diff < min) {
      min = diff;
      best = { cols, rows };
    }
  }
  return best;
}

/** Spread n items across `rows` rows; earlier rows take the remainder. */
export function rowSizes(n: number, rows: number): number[] {
  const base = Math.floor(n / rows);
  const rem = n % rows;
  return Array.from({ length: rows }, (_, i) => (i < rem ? base + 1 : base));
}

const FONT_STACK = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Noto Sans CJK SC",sans-serif';

/** Draw text centered at cx, shrinking the font until it fits maxWidth. */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  top: number,
  maxWidth: number,
  startSize: number
) {
  let size = startSize;
  for (; size > 16; size--) {
    ctx.font = `bold ${size}px ${FONT_STACK}`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  ctx.fillText(text, cx, top);
  return size;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawItem(ctx: CanvasRenderingContext2D, item: RenderItem, x: number, y: number, cfg: RenderConfig) {
  ctx.save();
  ctx.globalAlpha = cfg.opacity;

  const coverX = x + BORDER;
  const coverY = y + BORDER;

  if (cfg.border) {
    // White sticker frame with a soft drop shadow.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#ffffff";
    roundRectPath(ctx, x, y, CELL_W, COVER_H + 2 * BORDER, 16);
    ctx.fill();
    ctx.restore();
    // Cover, clipped with slightly rounded corners.
    ctx.save();
    roundRectPath(ctx, coverX, coverY, COVER_W, COVER_H, 8);
    ctx.clip();
    ctx.drawImage(item.cover, coverX, coverY, COVER_W, COVER_H);
    ctx.restore();
  } else {
    // No frame: rounded cover with a shadow so it still lifts off the bg.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.32)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#000";
    roundRectPath(ctx, coverX, coverY, COVER_W, COVER_H, 12);
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRectPath(ctx, coverX, coverY, COVER_W, COVER_H, 12);
    ctx.clip();
    ctx.drawImage(item.cover, coverX, coverY, COVER_W, COVER_H);
    ctx.restore();
  }

  // Text under the cover, with a soft halo so it reads on any background.
  ctx.fillStyle = "#1a1a1a";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(255,255,255,0.92)";
  ctx.shadowBlur = 8;
  const cx = x + CELL_W / 2;
  let ty = y + COVER_H + 2 * BORDER + 8;
  if (cfg.addName) {
    const name = item.score ? `${item.title} ${item.score}/10` : item.title;
    drawFitted(ctx, name, cx, ty, CELL_W - 24, 30);
    ty += 44;
  }
  if (cfg.addTime && item.subtitle) {
    drawFitted(ctx, item.subtitle, cx, ty, CELL_W - 24, 26);
  }

  ctx.restore();
}

/** Render the whole composite into `canvas`. */
export function renderToCanvas(canvas: HTMLCanvasElement, cfg: RenderConfig) {
  const n = cfg.items.length;
  if (n === 0) throw new Error("没有选中的番剧");

  const aspect = cfg.background ? cfg.background.width / cfg.background.height : 1.6;
  const { cols, rows } = bestGrid(n, aspect);
  const sizes = rowSizes(n, rows);

  // Required canvas size = grid + uniform GAP between cells and around edges.
  // Scaling to this (not the bare grid) guarantees a margin on all four sides.
  const reqW = cols * CELL_W + (cols + 1) * GAP;
  const reqH = rows * CELL_H + (rows + 1) * GAP;
  const bgW = cfg.background ? cfg.background.width : reqW;
  const bgH = cfg.background ? cfg.background.height : reqH;
  const scale = Math.max(reqW / bgW, reqH / bgH);
  const W = Math.round(bgW * scale);
  const H = Math.round(bgH * scale);

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 canvas 上下文");

  if (cfg.background) {
    ctx.drawImage(cfg.background, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  }

  const vMargin = (H - rows * CELL_H) / (rows + 1);
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    const inRow = sizes[r];
    const hSpace = (W - inRow * CELL_W) / (inRow + 1);
    for (let c = 0; c < inRow && idx < n; c++) {
      const x = hSpace * (c + 1) + CELL_W * c;
      const y = vMargin * (r + 1) + CELL_H * r;
      drawItem(ctx, cfg.items[idx++], x, y, cfg);
    }
  }
}

/** Decode raw image bytes into an ImageBitmap. */
export async function bitmapFromBytes(bytes: Uint8Array): Promise<ImageBitmap> {
  return await createImageBitmap(new Blob([bytes as BlobPart]));
}

/** Export a canvas as PNG bytes. */
export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("PNG 导出失败"));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}
