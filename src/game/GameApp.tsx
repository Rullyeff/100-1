import { Component, useEffect, type ReactNode } from "react";
import GameScene from "./scene/GameScene";
import { Hud } from "./ui/Hud";
import { startIfIdle, useGame } from "./store";
import { recordFinishedGame } from "./leaderboard";

class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  override render() {
    if (this.state.error)
      return (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-muted-foreground">
          Papan 3D gagal dimuat: {this.state.error}
        </div>
      );
    return this.props.children;
  }
}

export default function GameApp({ online = false }: { online?: boolean }) {
  useEffect(() => {
    if (!online) startIfIdle();
  }, [online]);
  const game = useGame((st) => st.game);
  const winnerId = game.winnerId;
  useEffect(() => {
    if (winnerId !== null) recordFinishedGame(game, (game as { startedAt?: number }).startedAt ?? Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerId]);
  return (
    <main className="fixed inset-0 overflow-hidden bg-background">
      <h1 className="sr-only">100 SUARA — permainan edukasi demokrasi 3D</h1>
      <SceneBoundary>
        <GameScene />
      </SceneBoundary>
      <Hud />
    </main>
  );
}
