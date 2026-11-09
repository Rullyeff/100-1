import { useCallback, useEffect, useState } from "react";

// Browser fullscreen with the WebKit-prefixed fallback (older Safari / iPad).
type WebkitDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type WebkitEl = HTMLElement & { webkitRequestFullscreen?: () => void };

const current = () => {
  const d = document as WebkitDoc;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
};

/** Toggles fullscreen for the whole page; `supported` is false where the browser forbids it (e.g. iPhone Safari). */
export function useFullscreen() {
  const [full, setFull] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const el = document.documentElement as WebkitEl;
    setSupported(!!(el.requestFullscreen || el.webkitRequestFullscreen));
    const on = () => setFull(!!current());
    on();
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      document.removeEventListener("webkitfullscreenchange", on);
    };
  }, []);
  const toggle = useCallback(() => {
    const d = document as WebkitDoc;
    const el = document.documentElement as WebkitEl;
    if (current()) {
      if (d.exitFullscreen) void d.exitFullscreen().catch(() => {});
      else d.webkitExitFullscreen?.();
    } else if (el.requestFullscreen) {
      void el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    } else {
      el.webkitRequestFullscreen?.();
    }
  }, []);
  return { full, supported, toggle };
}
