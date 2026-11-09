// Public board topology; shared by the authoritative engine and its projection.
export const OUTER_PER_AREA = 15;
export const OUTER_TOTAL = 75;
export const GATE_LEN = 5;
export const PENT_TOTAL = 20;
export const PENT_PER_AREA = 4;
export type OuterType = "A1" | "A2" | "A3" | "D" | "K" | "E";
export type DemokrasiSub = "cekfakta" | "dilema" | "refleksi";
export type KejutanSub = "peristiwa" | "kesempatan";
/**
 * Isi tiap area mengikuti gambar Board Utama (searah jarum jam dari START):
 * 5 Aspirasi (kotak suara 2 = Mudah ×2, 5 = Sedang ×2, 10 = Sulit ×1), 3 Demokrasi
 * (timbangan: Cek Fakta, Dilema, Refleksi), 2 Kejutan (hadiah: pertama Peristiwa,
 * kedua Kesempatan), dan 5 petak kosong (E) tanpa kartu.
 */
export const OUTER_PATTERN: OuterType[] = [
  "E", "D", "A2", "E", "K", "A3", "E", "D", "A1", "E",
  "K", "A2", "E", "D", "A1",
];
const DEMOKRASI_AT: Record<number, DemokrasiSub> = { 1: "cekfakta", 7: "dilema", 13: "refleksi" };
const KEJUTAN_AT: Record<number, KejutanSub> = { 4: "peristiwa", 10: "kesempatan" };
export const outerType = (i: number) => OUTER_PATTERN[i % OUTER_PER_AREA];
export const outerArea = (i: number) => Math.floor(i / OUTER_PER_AREA);
/** Jenis kartu Demokrasi yang dibuka di petak D tertentu. */
export const outerDemokrasiSub = (i: number): DemokrasiSub => DEMOKRASI_AT[i % OUTER_PER_AREA] ?? "cekfakta";
export const isSafeGate = (space: number) => space % PENT_PER_AREA === 0;
export const safeGateOf = (area: number) => area * PENT_PER_AREA;
/** Area pemilik asal Gerbang Aman pada petak Pentagon `space`. */
export const safeGateArea = (space: number) => Math.floor(space / PENT_PER_AREA);
/** Jenis kartu Kejutan yang dibuka di petak K tertentu. */
export const outerKejutanSub = (i: number): KejutanSub => KEJUTAN_AT[i % OUTER_PER_AREA] ?? "peristiwa";
