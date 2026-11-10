/** Read semantic CSS tokens only after mounting the browser-only scene.
 * Tokens come from the Kaya Raya wrapper so its own seat colours apply. */
export function cityColor(role: string) {
  const scope = document.querySelector(".kaya-raya-theme") ?? document.documentElement;
  return getComputedStyle(scope).getPropertyValue(`--city-${role}`).trim();
}
