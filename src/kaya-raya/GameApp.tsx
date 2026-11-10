import { Component, useEffect, type ReactNode } from "react";
import GameScene from "./scene/GameScene";
import { Hud } from "./ui/Hud";
import { startIfIdle } from "./store";

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

export default function GameApp() {
  useEffect(() => {
    startIfIdle();
  }, []);
  return (
    <main className="fixed inset-0 overflow-hidden bg-background">
      <h1 className="sr-only">Kaya Raya — game monopoli 3D</h1>
      <SceneBoundary>
        <GameScene />
      </SceneBoundary>
      <Hud />
    </main>
  );
}
