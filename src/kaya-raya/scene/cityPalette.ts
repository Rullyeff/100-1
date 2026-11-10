/** Read semantic CSS tokens only after mounting the browser-only scene. */
export function cityColor(role: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--city-${role}`).trim();
}