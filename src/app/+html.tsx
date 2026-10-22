import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const TITLE = 'Grain: food tracking for people who care about every gram';
const DESCRIPTION =
  'Log meals in plain language, like “2 roti, mom’s dal, 1 katori rice”, and ' +
  'get calories and macros you can trust. AI grounded on real food data, ' +
  'built for Indian food.';
const URL = 'https://app.getgrain.fit';

/**
 * +html.tsx — the static HTML shell for web export. This is the only place the
 * exported site gets its <head>: title, description, social (OG/Twitter) cards,
 * PWA manifest, and icons. Without it the deployed page has an empty <title>
 * and shared links render as blank cards.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* The <title> itself is set via expo-router Head in _layout.tsx so it
            lands in the router-managed slot instead of duplicating it. */}
        <meta name="description" content={DESCRIPTION} />

        {/* Social cards */}
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={URL} />
        <meta property="og:image" content={`${URL}/og.png`} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={`${URL}/og.png`} />

        {/* PWA: installable, named, iconed */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#EDEAE4" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Grain" />

        <ScrollViewStyleReset />

        {/* Capture the install prompt before the bundle parses.
            Chrome fires `beforeinstallprompt` once, early, and never replays
            it, so a listener that only exists while some screen is mounted
            misses it for good — which is exactly how the Add to Home Screen
            button came to be permanently dead. Inline rather than in the
            bundle because the bundle is ~2.3MB and Chrome can fire first.
            src/lib/install-prompt.ts is the React-side view of this. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var w=window;w.__deficitInstall={prompt:null,installed:false};
function n(){w.dispatchEvent(new Event('deficit:installchange'))}
w.addEventListener('beforeinstallprompt',function(e){e.preventDefault();w.__deficitInstall.prompt=e;n()});
w.addEventListener('appinstalled',function(){w.__deficitInstall.prompt=null;w.__deficitInstall.installed=true;n()});})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
