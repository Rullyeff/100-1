import { createFileRoute } from "@tanstack/react-router";
import GameApp from "@/kaya-raya/GameApp";

export const Route = createFileRoute("/kaya-raya")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kaya Raya — Monopoli 3D Lawan Bot" },
      { name: "description", content: "Lempar dadu, beli kota, bangun hotel dan landmark, lalu bikin 3 bot bangkrut." },
      { property: "og:title", content: "Kaya Raya — Monopoli 3D Lawan Bot" },
      { property: "og:description", content: "Lempar dadu, beli kota, bangun hotel dan landmark, lalu bikin 3 bot bangkrut." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameApp,
});
