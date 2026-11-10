import { createFileRoute } from "@tanstack/react-router";
import GameApp from "@/game/GameApp";
import type { LobbyMode } from "@/game/ui/Lobby";

export const Route = createFileRoute("/main")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { mode?: LobbyMode } =>
    search.mode === "bersama" || search.mode === "bot" ? { mode: search.mode } : {},
  head: () => ({
    meta: [
      { title: "Main 3D — 100 SUARA Bangun Bangsa" },
      {
        name: "description",
        content:
          "100 SUARA V4.0: lima Token Area, voting Putusan Rakyat, dua putaran Pentagon dan penghitungan suara sah akhir.",
      },
      { property: "og:title", content: "100 SUARA — Bangun Bangsa" },
      {
        property: "og:description",
        content:
          "100 SUARA V4.0: lima Token Area, voting Putusan Rakyat, dua putaran Pentagon dan penghitungan suara sah akhir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameApp,
});
