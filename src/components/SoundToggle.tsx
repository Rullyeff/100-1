import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, play, setMuted, subscribeMuted, unlockAudio } from "@/lib/sfx";
import { cn } from "@/lib/utils";

/** Small speaker button to turn game sounds on or off; the choice is remembered on this device. */
export function SoundToggle({ className }: { className?: string }) {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  const label = muted ? "Nyalakan suara" : "Matikan suara";
  return (
    <button
      type="button"
      data-sfx="off"
      aria-pressed={!muted}
      aria-label={label}
      title={label}
      className={cn("sound-toggle", muted && "sound-toggle-off", className)}
      onClick={() => {
        unlockAudio();
        setMuted(!muted);
        if (muted) window.setTimeout(() => play("click"), 30);
      }}
    >
      {muted ? <VolumeX /> : <Volume2 />}
    </button>
  );
}
