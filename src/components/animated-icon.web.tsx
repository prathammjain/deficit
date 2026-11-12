/**
 * The splash overlay is native only. On the web the page shell is the
 * splash, and the animation library it would need is a quarter of the
 * bundle, so the web gets nothing to import.
 */
export function AnimatedSplashOverlay() {
  return null;
}
