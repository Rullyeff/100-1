import * as THREE from "three";
import { AREAS, GATE_BASE, GATE_LEN, GROUP_COLORS, type Tile } from "../sim/board";
import { CELL, PENT_R, RING_U, TABLE_HALF, armAxes, gapSpot, tileXform } from "./layout";

import boardBackgroundUrl from "@/assets/board-background.jpg";
const boardBackground = { url: boardBackgroundUrl };
import logoUrl from "@/assets/logo-100-suara.png";
const logoAsset = { url: logoUrl };

const images = new Map<string, Promise<HTMLImageElement>>();
/** Loads a same-origin image once; canvas textures repaint with it when it resolves. */
function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    images.set(url, p);
  }
  return p;
}

export const CANVAS_FONT = '"Lilita One", "Nunito", system-ui, sans-serif';

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function toTex(c: HTMLCanvasElement, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number, count = (w * h) / 50) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}

function setFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number) {
  let s = size;
  ctx.font = `${s}px ${CANVAS_FONT}`;
  while (ctx.measureText(text).width > maxW && s > 12) {
    s -= 2;
    ctx.font = `${s}px ${CANVAS_FONT}`;
  }
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size: number; maxW: number; fill: string; stroke?: string; flip?: boolean; rot?: number },
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((opts.flip ? Math.PI : 0) + (opts.rot ?? 0));
  setFont(ctx, text, opts.maxW, opts.size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (opts.stroke) {
    ctx.lineWidth = opts.size / 6;
    ctx.lineJoin = "round";
    ctx.strokeStyle = opts.stroke;
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = opts.fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Star path centred on (0, 0). */
export function starPath(ctx: CanvasRenderingContext2D, r: number, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Pictogram per tile kind, drawn inside a navy coin like the printed board. Warga tiles stay empty. */
const MEDAL: Record<string, string> = {
  aspirasi: "aspirasi",
  demokrasi: "demokrasi",
  kejutan: "kejutan",
  gerbang: "gerbang",
};

function mix(hex: string, to: string, t: number) {
  const a = new THREE.Color(hex), b = new THREE.Color(to);
  return "#" + a.lerp(b, t).getHexString();
}

/** Simple gold pictograms (no text) so the tiles read like the reference board. */
function pictogram(ctx: CanvasRenderingContext2D, kind: string, r: number, ink: string) {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = r * 0.11;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "demokrasi") {
    // Scales of justice
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55); ctx.lineTo(0, r * 0.45);
    ctx.moveTo(-r * 0.55, -r * 0.35); ctx.lineTo(r * 0.55, -r * 0.35);
    ctx.moveTo(-r * 0.3, r * 0.5); ctx.lineTo(r * 0.3, r * 0.5);
    ctx.stroke();
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * r * 0.55, -r * 0.35);
      ctx.lineTo(sx * r * 0.75, r * 0.08);
      ctx.lineTo(sx * r * 0.35, r * 0.08);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx * r * 0.55, r * 0.08, r * 0.2, 0, Math.PI);
      ctx.fill();
    }
  } else if (kind === "aspirasi") {
    // Ballot box with a folded ballot going into the slot, like the printed board
    ctx.beginPath();
    ctx.roundRect(-r * 0.62, -r * 0.12, r * 1.24, r * 0.75, r * 0.1);
    ctx.fill();
    ctx.fillStyle = "#1d2a5c";
    ctx.fillRect(-r * 0.32, -r * 0.08, r * 0.64, r * 0.1);
    ctx.save();
    ctx.translate(r * 0.02, -r * 0.3);
    ctx.rotate(-0.18);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(-r * 0.26, -r * 0.42, r * 0.52, r * 0.5, r * 0.06);
    ctx.fill();
    ctx.strokeStyle = "#1d2a5c";
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 0.18); ctx.lineTo(-r * 0.02, -r * 0.08); ctx.lineTo(r * 0.14, -r * 0.3);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#1d2a5c";
    ctx.fillRect(-r * 0.5, r * 0.28, r * 1.0, r * 0.07);
  } else if (kind === "kejutan") {
    // Gift box with ribbon and bow
    ctx.fillRect(-r * 0.55, -r * 0.05, r * 1.1, r * 0.65);
    ctx.fillRect(-r * 0.65, -r * 0.3, r * 1.3, r * 0.28);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * r * 0.2, -r * 0.45, r * 0.2, r * 0.13, sx * -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#1d2a5c";
    ctx.fillRect(-r * 0.07, -r * 0.3, r * 0.14, r * 0.9);
    ctx.fillRect(-r * 0.65, -r * 0.05, r * 1.3, r * 0.06);
  } else if (kind === "gerbang" || kind === "gate") {
    // Three raised hands (the people's verdict), middle one tallest
    const hand = (cx: number, cy: number, s: number) => {
      ctx.beginPath();
      ctx.roundRect(cx - s * 0.3, cy - s * 0.05, s * 0.6, s * 0.65, s * 0.18);
      ctx.fill();
      for (const [fx, fh] of [[-0.22, 0.42], [-0.07, 0.55], [0.08, 0.52], [0.22, 0.4]] as const) {
        ctx.beginPath();
        ctx.roundRect(cx + fx * s - s * 0.065, cy - fh * s, s * 0.13, fh * s + s * 0.1, s * 0.065);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(cx - s * 0.3, cy + s * 0.12);
      ctx.rotate(-0.7);
      ctx.beginPath();
      ctx.roundRect(-s * 0.07, -s * 0.28, s * 0.14, s * 0.32, s * 0.07);
      ctx.fill();
      ctx.restore();
    };
    hand(-r * 0.48, r * 0.12, r * 0.62);
    hand(r * 0.48, r * 0.12, r * 0.62);
    hand(0, -r * 0.02, r * 0.78);
  } else if (kind === "plot") {
    // Waving flag on a pole
    ctx.fillRect(-r * 0.5, -r * 0.62, r * 0.12, r * 1.3);
    ctx.beginPath();
    ctx.moveTo(-r * 0.38, -r * 0.6);
    ctx.quadraticCurveTo(r * 0.05, -r * 0.82, r * 0.6, -r * 0.55);
    ctx.lineTo(r * 0.6, r * 0.08);
    ctx.quadraticCurveTo(r * 0.05, -r * 0.18, -r * 0.38, r * 0.05);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

const tileCache = new Map<string, THREE.Texture>();

/**
 * Square tile face in the printed-board style: an area-coloured cell with a thin darker rim.
 * Warga tiles are empty pale cells; event tiles carry a navy coin pictogram; gate cells a white hall.
 */
export function tileTexture(tile: Tile): THREE.Texture {
  // Gerbang lanes alternate a hall cell and a plain cell, like the printed board.
  const plainGate = tile.kind === "gate" && ((tile.id - GATE_BASE) % GATE_LEN) % 2 === 1;
  const key = `${tile.kind}|${tile.area}|${plainGate ? "plain" : ""}|${tile.kind === "warga" ? tile.sub : ""}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const S = 192;
  const [c, ctx] = canvas(S, S);
  const col = GROUP_COLORS[tile.area] ?? "#c9a84c";
  const plot = tile.kind === "plot";
  // Pentagon plots are neutral tan cells with a brown rim, not area-tinted.
  const dark = plot ? "#7a5228" : mix(col, "#000000", 0.35);
  // Cell base + rim
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, S, S);
  // Empty pawn squares: "Terang" glows pale, "Polos" is a plain area-coloured cell.
  const pale = tile.kind === "warga" && tile.sub !== "Polos";
  const plainEmpty = tile.kind === "warga" && tile.sub === "Polos";
  const base = plot
    ? "#f4e4c4"
    : pale
      ? mix(col, "#ffffff", 0.62)
      : tile.kind === "gate" || plainEmpty
        ? col
        : mix(col, "#ffffff", 0.22);
  ctx.fillStyle = base;
  roundRect(ctx, 10, 10, S - 20, S - 20, 14);
  ctx.fill();
  if (pale) {
    // Empty pawn square: soft inner glow, no icon or text.
    const g = ctx.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S / 2);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    roundRect(ctx, 10, 10, S - 20, S - 20, 14);
    ctx.fill();
  }
  speckle(ctx, S, S, 0.03, 400);
  if (tile.kind === "start") {
    ctx.fillStyle = col;
    roundRect(ctx, 10, 10, S - 20, S - 20, 14);
    ctx.fill();
    label(ctx, "START", S / 2, S / 2, { size: 50, maxW: S - 34, fill: "#ffffff", stroke: "rgba(0,0,0,0.35)" });
  } else if (MEDAL[tile.kind]) {
    const r = 58;
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#1d2a5c";
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#e6b84a";
    ctx.stroke();
    pictogram(ctx, MEDAL[tile.kind]!, r * 0.78, "#f0c85a");
    ctx.restore();
  } else if (tile.kind === "gate" && !plainGate) {
    ctx.save();
    ctx.translate(S / 2, S / 2);
    pictogram(ctx, "gate", 84, "rgba(255,255,255,0.95)");
    ctx.restore();
  } else if (plot) {
    ctx.save();
    ctx.translate(S / 2, S / 2);
    pictogram(ctx, "plot", 64, "#a8743c");
    ctx.restore();
  }
  const t = toTex(c);
  tileCache.set(key, t);
  return t;
}

/** Round Gerbang Aman disc for an area's pentagon corner: navy medallion with the area emblem, like the printed board. */
export function cornerTexture(area: number, _name: string): THREE.Texture {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  const col = GROUP_COLORS[area] ?? "#c9a84c";
  const key = AREAS[area]?.key ?? "";
  // Tan pentagon surface around the medallion
  ctx.fillStyle = "#e9cf9e";
  ctx.fillRect(0, 0, S, S);
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2);
  ctx.fillStyle = "#7a5228";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 18, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 34, 0, Math.PI * 2);
  ctx.fillStyle = "#1d2a5c";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#f4f1ea";
  ctx.stroke();
  ctx.save();
  ctx.translate(S / 2, S / 2);
  // Cylinder cap UVs turn the image a quarter turn; pre-rotate so the emblem sits upright.
  ctx.rotate(-Math.PI / 2);
  coinIcon(ctx, key, S * 0.2, "#f4f1ea");
  ctx.restore();
  return toTex(c);
}

export function feltTexture(title: string): THREE.Texture {
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, "#1f6b55");
  g.addColorStop(0.6, "#124535");
  g.addColorStop(1, "#0a2a20");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, 0.035, 60000);
  // Gold inlay: double frame + rings around the globe
  ctx.strokeStyle = "#d8b25a";
  ctx.lineWidth = 6;
  ctx.strokeRect(26, 26, S - 52, S - 52);
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, S - 88, S - 88);
  ctx.globalAlpha = 0.55;
  for (const [r, w] of [[250, 3], [272, 1.5], [420, 2]] as const) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Compass ticks
  ctx.save();
  ctx.translate(S / 2, S / 2);
  for (let i = 0; i < 32; i++) {
    ctx.rotate(Math.PI / 16);
    ctx.lineWidth = i % 4 === 3 ? 4 : 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -272);
    ctx.lineTo(0, i % 4 === 3 ? -310 : -290);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(-Math.PI / 4);
  label(ctx, title, 0, 360, { size: 110, maxW: 760, fill: "#e9c873", stroke: "rgba(40,25,5,0.45)" });
  ctx.restore();
  return toTex(c);
}

/** Polished black marble with white and gold veins. */
export function marbleTexture(): THREE.Texture {
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "#1b1a1d");
  g.addColorStop(0.5, "#121114");
  g.addColorStop(1, "#1d1b1f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, 0.03, 30000);
  const vein = (color: string, width: number, alpha: number, blur: number) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    let x = Math.random() * S;
    let y = -20;
    let a = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < S + 20 && x > -40 && x < S + 40) {
      a += (Math.random() - 0.5) * 0.5;
      a = Math.PI / 2 + Math.max(-0.9, Math.min(0.9, a - Math.PI / 2));
      x += Math.cos(a) * 14;
      y += Math.sin(a) * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  };
  for (let i = 0; i < 14; i++) vein("#d9d4cc", 1 + Math.random() * 2.5, 0.12 + Math.random() * 0.2, 6);
  for (let i = 0; i < 6; i++) vein("#d6aa4f", 1 + Math.random() * 2, 0.35 + Math.random() * 0.3, 10);
  return toTex(c, 2);
}

// --- Globe ---------------------------------------------------------------
function hash3(x: number, y: number, z: number) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = (t: number) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const n = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(n(0, 0, 0), n(1, 0, 0), u), l(n(0, 1, 0), n(1, 1, 0), u), v),
    l(l(n(0, 0, 1), n(1, 0, 1), u), l(n(0, 1, 1), n(1, 1, 1), u), v),
    w,
  );
}
function fbm(x: number, y: number, z: number) {
  let a = 0.5, s = 0;
  for (let o = 0; o < 5; o++) {
    s += a * vnoise(x, y, z);
    x *= 2.03; y *= 2.03; z *= 2.03;
    a *= 0.5;
  }
  return s;
}

/** Stylised earth (equirectangular): deep ocean, emerald land, gold coastlines. Seamless via 3D noise. */
export function globeTexture(): { map: THREE.Texture; glow: THREE.Texture } {
  const W = 512;
  const H = 256;
  const [c, ctx] = canvas(W, H);
  const [c2, ctx2] = canvas(W, H);
  const img = ctx.createImageData(W, H);
  const glow = ctx2.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = (y / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2;
      const px = Math.sin(lat) * Math.cos(lon), py = Math.cos(lat), pz = Math.sin(lat) * Math.sin(lon);
      const n = fbm(px * 2.2 + 7, py * 2.2 + 3, pz * 2.2 + 11);
      const i = (y * W + x) * 4;
      const polar = Math.abs(py) > 0.9;
      let r: number, g: number, b: number;
      if (polar) [r, g, b] = [230, 238, 245];
      else if (n > 0.52) {
        const k = Math.min(1, (n - 0.52) * 5);
        r = 40 + k * 120; g = 130 + k * 60; b = 70 - k * 20;
        if (n < 0.535) [r, g, b] = [230, 190, 90];
      } else {
        const k = n / 0.52;
        r = 10 + k * 30; g = 50 + k * 70; b = 110 + k * 90;
      }
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      // City lights glow on land
      const lit = n > 0.56 && hash3(x, y, 9) > 0.93 ? 255 : n > 0.52 && n < 0.535 ? 120 : 0;
      glow.data[i] = lit; glow.data[i + 1] = lit * 0.78; glow.data[i + 2] = lit * 0.35; glow.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx2.putImageData(glow, 0, 0);
  // Gold graticule
  ctx.strokeStyle = "rgba(255, 214, 120, 0.35)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(0, (i / 6) * H); ctx.lineTo(W, (i / 6) * H); ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    ctx.beginPath(); ctx.moveTo((i / 12) * W, 0); ctx.lineTo((i / 12) * W, H); ctx.stroke();
  }
  return { map: toTex(c), glow: toTex(c2) };
}

export function woodTexture(base = "#7a4a26", grain = "#5e3618"): THREE.Texture {
  const W = 512;
  const [c, ctx] = canvas(W, W);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, W);
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = grain;
    ctx.globalAlpha = 0.15 + Math.random() * 0.25;
    ctx.lineWidth = 1 + Math.random() * 4;
    const y = Math.random() * W;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  speckle(ctx, W, W, 0.04);
  return toTex(c, 3);
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

export function diceFace(n: number): THREE.Texture {
  const S = 128;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = "#c9a55a";
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S * 0.4, S * 0.35, 10, S / 2, S / 2, S * 0.7);
  g.addColorStop(0, "#fffdf6");
  g.addColorStop(1, "#ece3cf");
  ctx.fillStyle = g;
  roundRect(ctx, 5, 5, S - 10, S - 10, 24);
  ctx.fill();
  for (const [x, y] of PIPS[n]!) {
    ctx.beginPath();
    ctx.arc(x * S, y * S, n === 1 ? 19 : 12, 0, Math.PI * 2);
    ctx.fillStyle = n === 1 ? "#c8102e" : "#1d1a18";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x * S - 2, y * S - 3, n === 1 ? 7 : 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fill();
  }
  return toTex(c);
}

export function billTexture(): THREE.Texture {
  const W = 256;
  const H = 128;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = "#8fc79a";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#3f7d4c";
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, 34, 34, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#6aa979";
  ctx.fill();
  label(ctx, "100K", W / 2, H / 2, { size: 30, maxW: 80, fill: "#2b5e37" });
  return toTex(c);
}

// --- Surface detail (normal maps & soft shadows) -------------------------
/** Tileable tangent-space normal map: "weave" for felt cloth, "paper" for printed card. */
export function surfaceNormal(kind: "weave" | "paper", repeat: number): THREE.Texture {
  const S = 256;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let v: number;
      if (kind === "weave") {
        const cell = (Math.floor(x / 8) + Math.floor(y / 8)) & 1;
        const u = ((x % 8) / 8) * Math.PI, w = ((y % 8) / 8) * Math.PI;
        v = cell ? Math.sin(u) * 0.8 + Math.sin(w) * 0.2 : Math.sin(w) * 0.8 + Math.sin(u) * 0.2;
        v += (hash3(x, y, 1) - 0.5) * 0.35;
      } else {
        v = fbm((x / S) * 24, (y / S) * 24, 3) + (hash3(x, y, 2) - 0.5) * 0.25;
      }
      h[y * S + x] = v;
    }
  const [c, ctx] = canvas(S, S);
  const img = ctx.createImageData(S, S);
  const at = (x: number, y: number) => h[((y + S) % S) * S + ((x + S) % S)]!;
  const k = kind === "weave" ? 2.2 : 3;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const nx = (at(x - 1, y) - at(x + 1, y)) * k;
      const ny = (at(x, y - 1) - at(x, y + 1)) * k;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * S + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

let brushed: THREE.Texture | null = null;
/** Roughness map with fine circumferential streaks (lathe UV v runs up the piece), for brushed metal. */
export function brushedRoughness(): THREE.Texture {
  if (brushed) return brushed;
  const S = 256;
  const [c, ctx] = canvas(S, S);
  for (let y = 0; y < S; y++) {
    const v = 150 + (hash3(0, y, 5) - 0.5) * 90 + (hash3(1, y >> 2, 6) - 0.5) * 40;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, S, 1);
  }
  // Occasional finer scratches across the grain
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = hash3(i, 2, 7) > 0.5 ? "#fff" : "#000";
    ctx.fillRect(hash3(i, 3, 7) * S, hash3(i, 4, 7) * S, 20 + hash3(i, 5, 7) * 60, 1);
  }
  brushed = new THREE.CanvasTexture(c);
  brushed.colorSpace = THREE.NoColorSpace;
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  brushed.repeat.set(1, 3);
  return brushed;
}

let blob: THREE.Texture | null = null;
/** Shared soft contact-shadow disc; cheap grounding that works on every quality tier. */
export function shadowBlob(): THREE.Texture {
  if (blob) return blob;
  const S = 128;
  const [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(0,0,0,0.75)");
  g.addColorStop(0.45, "rgba(0,0,0,0.45)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  blob = new THREE.CanvasTexture(c);
  return blob;
}


/**
 * Printed board art for the whole table top (like the paper board): pastel sky, a soft glow and a
 * coloured track bed under each arm, area name ribbons and the pentagon plaza.
 */
export function boardArtTexture(): THREE.Texture {
  const S = 2048;
  const [c, ctx] = canvas(S, S);
  paintBoardArt(ctx, S, null, null);
  const tex = toTex(c);
  // Repaint over the printed background and the official logo once both arrive.
  Promise.all([loadImage(boardBackground.url), loadImage(logoAsset.url)])
    .then(([bg, logo]) => {
      ctx.clearRect(0, 0, S, S);
      paintBoardArt(ctx, S, bg, logo);
      tex.needsUpdate = true;
    })
    .catch(() => {});
  return tex;
}

function paintBoardArt(ctx: CanvasRenderingContext2D, S: number, bg: HTMLImageElement | null, logo: HTMLImageElement | null) {
  // The printed sheet sits inside the frame's gold rim (0.16 world units each side).
  const H = TABLE_HALF - 0.16;
  const px = (v: number) => (v / (2 * H)) * S;
  const X = (x: number) => ((x + H) / (2 * H)) * S;
  const Z = (z: number) => ((z + H) / (2 * H)) * S;
  if (bg) ctx.drawImage(bg, 0, 0, S, S);
  else paintProceduralBackground(ctx, S, px, X, Z);
  paintBoardOverlay(ctx, S, px, X, Z, !bg, logo);
}

/** Fallback sheet (pastel zones, rays, waves, frame) shown until the printed background loads. */
function paintProceduralBackground(ctx: CanvasRenderingContext2D, S: number, px: (v: number) => number, X: (x: number) => number, Z: (z: number) => number) {
  ctx.fillStyle = "#fbfbfd";
  ctx.fillRect(0, 0, S, S);
  // Pastel zone per area: each wedge fades from white at the centre to its colour at the edge.
  AREAS.forEach((area, k) => {
    const a = (area.angle * Math.PI) / 180;
    const half = (36 * Math.PI) / 180;
    const R = S;
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, -a - half, -a + half);
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, px(4), 0, 0, S * 0.72);
    g.addColorStop(0, mix(area.color, "#ffffff", 0.97));
    g.addColorStop(0.45, mix(area.color, "#ffffff", 0.68));
    g.addColorStop(1, mix(area.color, "#ffffff", 0.36));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    void k;
  });
  // Blur the wedge seams into soft blends.
  {
    const [b, bctx] = canvas(S, S);
    bctx.filter = "blur(70px)";
    bctx.drawImage(ctx.canvas, 0, 0);
    ctx.drawImage(b, 0, 0);
  }
  // Sunburst rays from the top centre.
  ctx.save();
  ctx.translate(S / 2, -S * 0.08);
  for (let i = 0; i < 28; i++) {
    const a = Math.PI * 0.12 + (i / 27) * Math.PI * 0.76;
    const w = 0.012 + (i % 3) * 0.006;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - w) * S * 1.1, Math.sin(a - w) * S * 1.1);
    ctx.lineTo(Math.cos(a + w) * S * 1.1, Math.sin(a + w) * S * 1.1);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, S * 0.75);
    g.addColorStop(0, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
  // Flowing white waves sweeping across each zone, like rolling hills.
  AREAS.forEach((area, k) => {
    const { out, perp } = armAxes(k);
    for (const [u, amp, wdt, alpha] of [[RING_U + 4.2, 1.1, 0.5, 0.75], [RING_U + 5.6, 0.8, 0.28, 0.6], [RING_U - 1.2, 0.9, 0.22, 0.45]] as const) {
      ctx.beginPath();
      for (let t = 0; t <= 24; t++) {
        const v = -9 + (t / 24) * 18;
        const uu = u + Math.sin(v * 0.42 + k) * amp;
        const x = out.x * uu + perp.x * v, z = -(out.y * uu + perp.y * v);
        if (t === 0) ctx.moveTo(X(x), Z(z));
        else ctx.lineTo(X(x), Z(z));
      }
      ctx.lineWidth = px(wdt);
      ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.stroke();
    }
    void area;
  });
  speckle(ctx, S, S, 0.015, 30000);
  // Navy border with gold pinstripes and gold corner ornaments.
  const B = 46;
  ctx.fillStyle = "#1b2552";
  ctx.fillRect(0, 0, S, B);
  ctx.fillRect(0, S - B, S, B);
  ctx.fillRect(0, 0, B, S);
  ctx.fillRect(S - B, 0, B, S);
  ctx.strokeStyle = "#d9b25a";
  ctx.lineWidth = 6;
  ctx.strokeRect(B + 3, B + 3, S - 2 * B - 6, S - 2 * B - 6);
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, S - 28, S - 28);
  for (const [cx, cy, rot] of [[B, B, 0], [S - B, B, Math.PI / 2], [S - B, S - B, Math.PI], [B, S - B, -Math.PI / 2]] as const) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = "#e3bd62";
    for (const a of [0, Math.PI / 2]) {
      ctx.save();
      ctx.rotate(a - Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, -50, 16, 50, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(90, 0); ctx.lineTo(0, 90);
    ctx.closePath();
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // Gold laurel at the bottom centre.
  ctx.save();
  ctx.translate(S / 2, S - B - 90);
  ctx.fillStyle = "#e1b866";
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.scale(sx, 1);
      ctx.translate(18 + i * 16, -i * 13);
      ctx.rotate(-0.9 + i * 0.08);
      ctx.beginPath();
      ctx.ellipse(0, -14, 8, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Trays, pentagon plaza, ribbons and logo drawn over either background. */
function paintBoardOverlay(ctx: CanvasRenderingContext2D, S: number, px: (v: number) => number, X: (x: number) => number, Z: (z: number) => number, emblems: boolean, logo: HTMLImageElement | null) {
  // Track bed: coloured rounded slabs under the loop, the gate lane and the pentagon band.
  const slab = (x: number, z: number, rot: number, w: number, d: number, fill: string) => {
    ctx.save();
    ctx.translate(X(x), Z(z));
    ctx.rotate(-rot);
    ctx.fillStyle = fill;
    roundRect(ctx, -px(w) / 2, -px(d) / 2, px(w), px(d), px(0.22));
    ctx.fill();
    ctx.restore();
  };
  for (let i = 105; i < 125; i++) {
    const t = tileXform(i);
    if (!t.corner) slab(t.x, t.z, t.rotY, CELL * 1.08, CELL * 1.12, "#7a5a32");
  }
  // One continuous coloured tray per arm: the loop with a white slot in its hollow, plus the gate stem.
  AREAS.forEach((area, k) => {
    const { out, perp } = armAxes(k);
    ctx.save();
    // Draw in arm cells: u along the arm, v across it.
    ctx.transform(px(out.x), px(-out.y), px(perp.x), px(-perp.y), X(0), Z(0));
    const dark = mix(area.color, "#000000", 0.4);
    const u0 = RING_U - 0.58, u1 = RING_U + 2.58;
    ctx.fillStyle = area.color;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.roundRect(PENT_R + 0.3, -0.58, RING_U - PENT_R, 1.16, 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(u0, -3.58, u1 - u0, 7.16, 0.22);
    ctx.fill();
    ctx.stroke();
    // Cover the stem/loop seam so the tray reads as one shape.
    ctx.fillRect(u0 - 0.06, -0.53, 0.2, 1.06);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#c9c4bb";
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.roundRect(RING_U + 0.6, -2.42, 0.8, 4.84, 0.1);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
  // Pentagon plaza and outline.
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const t = tileXform(105 + k * 4);
    if (k === 0) ctx.moveTo(X(t.x), Z(t.z));
    else ctx.lineTo(X(t.x), Z(t.z));
  }
  ctx.closePath();
  ctx.lineWidth = px(1.25);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#7a5a32";
  ctx.stroke();
  ctx.fillStyle = "#f3e2bd";
  ctx.fill();
  const cx = X(0), cy = Z(0);
  const plaza = ctx.createRadialGradient(cx, cy, 0, cx, cy, px(2.6));
  plaza.addColorStop(0, "#fff3cf");
  plaza.addColorStop(1, "#e8cf96");
  ctx.fillStyle = plaza;
  ctx.beginPath();
  ctx.arc(cx, cy, px(2.2), 0, Math.PI * 2);
  ctx.fill();
  // Area name ribbons beyond each loop.
  AREAS.forEach((area, k) => {
    const { out } = armAxes(k);
    const r = RING_U + 3.6;
    const x = out.x * r, z = -out.y * r;
    ctx.save();
    ctx.translate(X(x), Z(z));
    const ang = Math.atan2(-out.y, out.x) + Math.PI / 2;
    let rot = ang;
    while (rot > Math.PI / 2) rot -= Math.PI;
    while (rot < -Math.PI / 2) rot += Math.PI;
    ctx.rotate(rot);
    ctx.fillStyle = area.color;
    roundRect(ctx, -px(2.4), -px(0.42), px(4.8), px(0.84), px(0.42));
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#e9c873";
    ctx.stroke();
    label(ctx, area.name.toUpperCase(), 0, 4, { size: px(0.52), maxW: px(4.4), fill: "#ffffff", stroke: "rgba(0,0,0,0.25)" });
    ctx.restore();
  });
  // Faint area emblems in the background, beside each arm like the printed board.
  if (emblems) AREAS.forEach((area, k) => {
    const { out, perp } = armAxes(k);
    const u = RING_U + 2.6, v = 5.2;
    const x = out.x * u + perp.x * v, z = -(out.y * u + perp.y * v);
    ctx.save();
    ctx.translate(X(x), Z(z));
    ctx.globalAlpha = 0.85;
    areaEmblem(ctx, area.key, px(0.9), "#ffffff");
    ctx.restore();
  });
  // 100 SUARA logo in the open wedge nearest the players.
  const [lx, lz] = gapSpot(4, 5.9);
  ctx.save();
  ctx.translate(X(lx), Z(lz));
  if (logo) {
    const w = px(4.2), h = (w * logo.height) / logo.width;
    ctx.drawImage(logo, -w / 2, -h / 2, w, h);
  } else drawLogo(ctx, px(1));
  ctx.restore();
  void S;
}

function areaEmblem(ctx: CanvasRenderingContext2D, key: string, r: number, ink: string | CanvasGradient) {
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = "round";
  if (key === "pendidikan") {
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(0, -r * 0.45); ctx.lineTo(r, 0); ctx.lineTo(0, r * 0.45);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-r * 0.5, r * 0.1, r, r * 0.5);
    ctx.beginPath(); ctx.moveTo(r * 0.8, 0); ctx.lineTo(r * 0.8, r * 0.7); ctx.stroke();
  } else if (key === "inklusivitas") {
    for (const [dx, sc] of [[-0.62, 0.75], [0.62, 0.75], [0, 1]] as const) {
      ctx.beginPath(); ctx.arc(dx * r, -r * 0.35 * sc, r * 0.26 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(dx * r, r * 0.45, r * 0.42 * sc, r * 0.4 * sc, 0, Math.PI, 0); ctx.fill();
    }
  } else if (key === "lingkungan") {
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, r * 0.7);
    ctx.quadraticCurveTo(-r * 0.8, -r * 0.8, r * 0.8, -r * 0.8);
    ctx.quadraticCurveTo(r * 0.7, r * 0.6, -r * 0.7, r * 0.7);
    ctx.fill();
  } else if (key === "layanan") {
    ctx.beginPath(); ctx.moveTo(-r, -r * 0.3); ctx.lineTo(0, -r * 0.85); ctx.lineTo(r, -r * 0.3); ctx.closePath(); ctx.fill();
    for (const dx of [-0.7, -0.24, 0.24, 0.7]) ctx.fillRect(dx * r - r * 0.1, -r * 0.2, r * 0.2, r * 0.8);
    ctx.fillRect(-r, r * 0.65, r * 2, r * 0.18);
  } else {
    [-0.7, -0.25, 0.2, 0.65].forEach((dx, i) => ctx.fillRect(dx * r, r * (0.7 - 0.35 * (i + 1)), r * 0.3, r * 0.35 * (i + 1)));
    ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.1); ctx.lineTo(r * 0.1, -r * 0.5); ctx.lineTo(r * 0.85, -r * 0.95); ctx.stroke();
  }
}

/** "100 SUARA · Bangun Bangsa" wordmark (unit = one board cell in canvas px). */
function drawLogo(ctx: CanvasRenderingContext2D, u: number) {
  const navy = "#1d2a5c";
  label(ctx, "100", 0, -u * 0.55, { size: u * 1.05, maxW: u * 2.2, fill: navy, stroke: "#ffffff" });
  // People in the zeros' place: a small trio above the word, in national red.
  ctx.fillStyle = "#c8282e";
  for (const dx of [-0.22, 0, 0.22]) {
    ctx.beginPath(); ctx.arc(u * (0.42 + dx), -u * 0.62, u * 0.07, 0, Math.PI * 2); ctx.fill();
  }
  label(ctx, "SUARA", 0, u * 0.32, { size: u * 0.7, maxW: u * 2.4, fill: navy, stroke: "#ffffff" });
  ctx.fillStyle = "#d6a640";
  roundRect(ctx, -u * 1.1, u * 0.72, u * 2.2, u * 0.32, u * 0.16);
  ctx.fill();
  label(ctx, "BANGUN BANGSA", 0, u * 0.89, { size: u * 0.22, maxW: u * 2, fill: navy });
}

const deckCache = new Map<string, THREE.Texture>();
/** Top card of a deck: cream face, thick coloured frame, two-card pictogram. */
export function deckTexture(color: string): THREE.Texture {
  const hit = deckCache.get(color);
  if (hit) return hit;
  const W = 256, H = 368;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = "#f2c94c";
  roundRect(ctx, 0, 0, W, H, 30);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, 8, 8, W - 16, H - 16, 26);
  ctx.fill();
  ctx.fillStyle = "#f7d9a6";
  roundRect(ctx, 34, 34, W - 68, H - 68, 16);
  ctx.fill();
  for (const [dx, rot] of [[-16, -0.2], [16, 0.16]] as const) {
    ctx.save();
    ctx.translate(W / 2 + dx, H / 2);
    ctx.rotate(rot);
    ctx.fillStyle = "#f4f6fa";
    ctx.strokeStyle = mix(color, "#000000", 0.2);
    ctx.lineWidth = 5;
    roundRect(ctx, -34, -48, 68, 96, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  const t = toTex(c);
  deckCache.set(color, t);
  return t;
}

/** Vote-coin enamel colour per area (deeper than the board pastels, like the printed coins). */
export const COIN_COLORS: Record<string, string> = {
  pendidikan: "#1f4fb8",
  lingkungan: "#1d7a3c",
  ekonomi: "#6a2fb0",
  layanan: "#b8222a",
  inklusivitas: "#d99a16",
};

function coinBase(ctx: CanvasRenderingContext2D, S: number, color: string) {
  const r = S / 2;
  const g = ctx.createRadialGradient(r * 0.8, r * 0.7, r * 0.1, r, r, r);
  g.addColorStop(0, mix(color, "#ffffff", 0.22));
  g.addColorStop(1, mix(color, "#000000", 0.25));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // Raised gold rim with a thin inner bevel line.
  const gold = ctx.createLinearGradient(0, 0, S, S);
  gold.addColorStop(0, "#fff0b0");
  gold.addColorStop(0.45, "#d9a53a");
  gold.addColorStop(1, "#8a5a14");
  ctx.strokeStyle = gold;
  ctx.lineWidth = S * 0.085;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = S * 0.012;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.76, 0, Math.PI * 2);
  ctx.stroke();
}

function coinIcon(ctx: CanvasRenderingContext2D, key: string, r: number, ink: string | CanvasGradient) {
  if (key === "pendidikan") {
    // Open book.
    ctx.fillStyle = ink;
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.scale(sx, 1);
      ctx.beginPath();
      ctx.moveTo(r * 0.06, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.75, r * 0.95, -r * 0.6);
      ctx.lineTo(r * 0.95, r * 0.55);
      ctx.quadraticCurveTo(r * 0.5, r * 0.4, r * 0.06, r * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    return;
  }
  if (key === "lingkungan") {
    // Sprout: two leaves on a short stem.
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = r * 0.12;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, r * 0.85); ctx.quadraticCurveTo(0, r * 0.1, -r * 0.05, -r * 0.1); ctx.stroke();
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.scale(sx, 1);
      ctx.beginPath();
      ctx.moveTo(r * 0.05, r * 0.25);
      ctx.quadraticCurveTo(r * 0.05, -r * 0.75, r * 0.9, -r * 0.85);
      ctx.quadraticCurveTo(r * 0.85, r * 0.2, r * 0.05, r * 0.25);
      ctx.fill();
      ctx.restore();
    }
    return;
  }
  if (key === "ekonomi") {
    // Rising bars with an arrow.
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    [-0.8, -0.32, 0.16].forEach((dx, i) => ctx.fillRect(dx * r, r * (0.8 - 0.42 * (i + 1)), r * 0.36, r * 0.42 * (i + 1)));
    ctx.lineWidth = r * 0.13;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-r * 0.85, r * 0.05); ctx.quadraticCurveTo(r * 0.1, -r * 0.2, r * 0.62, -r * 0.62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.92, -r * 0.92); ctx.lineTo(r * 0.38, -r * 0.8); ctx.lineTo(r * 0.8, -r * 0.38); ctx.closePath(); ctx.fill();
    return;
  }
  areaEmblem(ctx, key, r, ink);
}

const coinCache = new Map<string, { face: THREE.Texture; back: THREE.Texture }>();
/** Front (area icon) and back (100 SUARA logo) faces of an area's vote coin. */
export function voteCoinTextures(key: string): { face: THREE.Texture; back: THREE.Texture } {
  const hit = coinCache.get(key);
  if (hit) return hit;
  const S = 256;
  const color = COIN_COLORS[key] ?? "#d99a16";
  const [fc, fctx] = canvas(S, S);
  coinBase(fctx, S, color);
  const gold = fctx.createLinearGradient(0, S * 0.25, 0, S * 0.75);
  gold.addColorStop(0, key === "inklusivitas" ? "#fff6d8" : "#ffe7a0");
  gold.addColorStop(1, key === "inklusivitas" ? "#f5d68a" : "#d39a2c");
  fctx.save();
  fctx.translate(S / 2, S / 2);
  fctx.shadowColor = "rgba(0,0,0,0.35)";
  fctx.shadowBlur = 6;
  fctx.shadowOffsetY = 3;
  coinIcon(fctx, key, S * 0.27, gold);
  fctx.restore();
  const [bc, bctx] = canvas(S, S);
  coinBase(bctx, S, color);
  const face = toTex(fc);
  const back = toTex(bc);
  loadImage(logoAsset.url)
    .then((logo) => {
      const w = S * 0.6, h = (w * logo.height) / logo.width;
      bctx.drawImage(logo, (S - w) / 2, (S - h) / 2, w, h);
      back.needsUpdate = true;
    })
    .catch(() => {});
  const out = { face, back };
  coinCache.set(key, out);
  return out;
}
