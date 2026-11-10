import * as THREE from "three";
import { GROUP_COLORS, SALARY, type Tile } from "../sim/board";
import { fmt } from "../sim/format";

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

const SPECIAL: Record<string, { bg: string; ink: string; title: string; symbol: string }> = {
  chance: { bg: "#d9ecf7", ink: "#2c6a94", title: "KESEMPATAN", symbol: "?" },
  tax: { bg: "#e4e0da", ink: "#5f5246", title: "PAJAK", symbol: "%" },
  bonus: { bg: "#fbe7a8", ink: "#9a6a00", title: "BONUS", symbol: "$" },
};

export function tileTexture(tile: Tile, flip: boolean): THREE.Texture {
  const W = 256;
  const H = 410;
  const [c, ctx] = canvas(W, H);

  if (tile.kind === "city") {
    const col = GROUP_COLORS[tile.group]!;
    ctx.fillStyle = "#f7f0df";
    ctx.fillRect(0, 0, W, H);
    speckle(ctx, W, H, 0.04);
    // building lot
    ctx.fillStyle = "rgba(120, 90, 50, 0.08)";
    roundRect(ctx, 14, 14, W - 28, 170, 16);
    ctx.fill();
    // colour band at the outer edge
    ctx.fillStyle = col;
    roundRect(ctx, 8, 290, W - 16, 112, 14);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(8, 290, W - 16, 18);
    label(ctx, tile.name.toUpperCase(), W / 2, 346, { size: 44, maxW: W - 36, fill: "#ffffff", stroke: "rgba(0,0,0,0.35)", flip });
    label(ctx, fmt(tile.price), W / 2, 236, { size: 46, maxW: W - 40, fill: "#4a3a2a", flip });
  } else {
    const st = SPECIAL[tile.kind]!;
    ctx.fillStyle = st.bg;
    ctx.fillRect(0, 0, W, H);
    speckle(ctx, W, H, 0.05);
    ctx.strokeStyle = st.ink;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 6;
    roundRect(ctx, 14, 14, W - 28, H - 28, 18);
    ctx.stroke();
    ctx.globalAlpha = 1;
    label(ctx, st.symbol, W / 2, 175, { size: 170, maxW: W, fill: st.ink, flip });
    label(ctx, st.title, W / 2, 340, { size: 40, maxW: W - 36, fill: st.ink, flip });
  }
  return toTex(c);
}

const CORNER_STYLE: Record<string, { bg: string; ink: string; lines: string[]; sub?: string }> = {
  start: { bg: "#bfe6b0", ink: "#1f6a34", lines: ["START"], sub: `Gaji +${fmt(SALARY)}` },
  island: { bg: "#f4e2b4", ink: "#8a5a12", lines: ["PULAU", "TERPENCIL"], sub: "Tunggu 3 giliran" },
  worldcup: { bg: "#ffe08a", ink: "#9a5b00", lines: ["PIALA", "DUNIA"], sub: "Sewa x2" },
  travel: { bg: "#bfe0f7", ink: "#1d5b8f", lines: ["KELILING", "DUNIA"], sub: "Terbang bebas" },
};

export function cornerTexture(kind: string): THREE.Texture {
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const st = CORNER_STYLE[kind]!;
  ctx.fillStyle = st.bg;
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, 0.05);
  ctx.strokeStyle = st.ink;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 10;
  roundRect(ctx, 18, 18, S - 36, S - 36, 30);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Text runs along the screen diagonal (camera looks from the +x+z corner).
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(-Math.PI / 4);
  const n = st.lines.length;
  st.lines.forEach((line, i) => {
    label(ctx, line, 0, (i - (n - 1) / 2) * 78 + 40, { size: 84, maxW: 400, fill: "#ffffff", stroke: st.ink });
  });
  if (st.sub) label(ctx, st.sub, 0, 40 + (n / 2) * 78 + 30, { size: 38, maxW: 360, fill: st.ink });
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
