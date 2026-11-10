import { createFileRoute } from "@tanstack/react-router";

// Registers this server's online-room key (hash only) so Vercel and Lovable hosting share it.
// Takes no input and reveals nothing beyond whether registration worked.
export const Route = createFileRoute("/api/public/room-key-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { syncRoomKey } = await import("@/game/online/room-key.server");
        return Response.json(await syncRoomKey());
      },
    },
  },
});
