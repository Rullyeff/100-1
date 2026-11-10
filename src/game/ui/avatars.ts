import avKamu from "@/assets/avatars/kamu.jpg";
import avJoko from "@/assets/avatars/joko.jpg";
import avBudi from "@/assets/avatars/budi.jpg";
import avSari from "@/assets/avatars/sari.jpg";
import avRina from "@/assets/avatars/rina.jpg";
import pa1 from "@/assets/avatars/avatar-1.webp";
import pa2 from "@/assets/avatars/avatar-2.webp";
import pa3 from "@/assets/avatars/avatar-3.webp";
import pa4 from "@/assets/avatars/avatar-4.webp";
import pa5 from "@/assets/avatars/avatar-5.webp";
import pa6 from "@/assets/avatars/avatar-6.webp";
import pa7 from "@/assets/avatars/avatar-7.webp";
import pa8 from "@/assets/avatars/avatar-8.webp";
import pa9 from "@/assets/avatars/avatar-9.webp";
import pa10 from "@/assets/avatars/avatar-10.webp";
import pa11 from "@/assets/avatars/avatar-11.webp";
import pa12 from "@/assets/avatars/avatar-12.webp";
import pa13 from "@/assets/avatars/avatar-13.webp";
import pa14 from "@/assets/avatars/avatar-14.webp";
import pa15 from "@/assets/avatars/avatar-15.webp";
import pa16 from "@/assets/avatars/avatar-16.webp";
import pa17 from "@/assets/avatars/avatar-17.webp";
import pa18 from "@/assets/avatars/avatar-18.webp";

/**
 * Every selectable avatar. Indexes are stored (browser storage and online seats),
 * so only append; the first ten match the original picker order.
 */
export const AVATAR_LIST = [
  avKamu, pa1, pa2, pa3, pa4, pa5, pa6, pa7, pa8, pa9,
  avJoko, avBudi, avSari, avRina,
  pa10, pa11, pa12, pa13, pa14, pa15, pa16, pa17, pa18,
];

/** Default avatar index per seat (Kamu, Joko, Budi, Sari, Rina). */
export const DEFAULT_SEAT_AVATARS = [0, 10, 11, 12, 13];

export const avatarSrc = (index: number | undefined, seat: number) =>
  AVATAR_LIST[index ?? -1] ?? AVATAR_LIST[DEFAULT_SEAT_AVATARS[seat] ?? 0]!;
