// ============================================================================
// _app.js
// Global shell: session provider, fonts, design tokens and the global stylesheet.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SessionProvider } from 'next-auth/react';
import { buildCssVariables, fonts } from '../lib/siteDesign';
import { AccountProvider } from '../lib/accountClient';

// Global CSS must be imported here (Next.js pages router rule)
import '../styles/homeStyles.css';

// About page styles (guides, server panel, mention chips)
import '../styles/aboutStyles.css';

// Debug logs page styles (/debug-logs)
import '../styles/debugStyles.css';

// Rules page styles (/rules)
import '../styles/rulesStyles.css';

// Punishments page styles (/rules/punishments)
import '../styles/punishmentsStyles.css';

// Account modal and staff login review styles
import '../styles/accountStyles.css';

// Announcements page, cards, manager and custom markup styles
import '../styles/announcementStyles.css';

// Resources page styles (/resources)
import '../styles/resourcesStyles.css';

// Command panel of the debug logs (developers)
import '../styles/commandStyles.css';

// Staff notes board of the debug logs (sticky notes)
import '../styles/notesStyles.css';

// Design tokens become CSS variables once, at module load
const tokenCss = buildCssVariables();

// ----------------------------------------------------------------------------
// Page transitions: when you go to another page the old one fades out with a slight blur, and
// the new one fades in from a slight blur. The motion is in the CSS below. Going to a hash on the
// same page (or changing only the query) does not animate, and people who asked their device for
// less motion get no animation at all.
// ----------------------------------------------------------------------------
const transitionCss = `
@keyframes kyriadonPageIn {
  from { opacity: 0; filter: blur(5px); transform: translateY(6px); }
  to { opacity: 1; filter: blur(0); transform: translateY(0); }
}
.pageTransition {
  min-height: 100dvh;
  animation: kyriadonPageIn 420ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
.pageTransition[data-leaving='true'] {
  opacity: 0;
  filter: blur(5px);
  transform: translateY(-4px);
  pointer-events: none;
  transition: opacity 180ms ease-in, filter 180ms ease-in, transform 180ms ease-in;
}
@media (prefers-reduced-motion: reduce) {
  .pageTransition,
  .pageTransition[data-leaving='true'] {
    animation: none;
    transition: none;
    filter: none;
    transform: none;
  }
}
`;

// The path of an address without its query and hash
const pathOf = (url) => String(url).split(/[?#]/)[0];

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const currentPath = useRef(pathOf(router.asPath));
  currentPath.current = pathOf(router.asPath);

  // The old page fades out while the next one loads, and the fade ends when the new page is there
  useEffect(() => {
    const start = (url, { shallow } = {}) => {
      if (!shallow && pathOf(url) !== currentPath.current) setLeaving(true);
    };
    const end = () => setLeaving(false);
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', end);
    router.events.on('routeChangeError', end);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', end);
      router.events.off('routeChangeError', end);
    };
  }, [router.events]);

  return (
    // Makes the Discord session available to every page
    <SessionProvider session={session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#040507" />
        {/* Fonts come from the central font definition in siteDesign.js */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fonts.googleUrl} />
        {/* Design tokens as :root variables */}
        <style id="siteTokens" dangerouslySetInnerHTML={{ __html: tokenCss }} />
        {/* The page transition (fade and slight blur) */}
        <style id="pageTransitions" dangerouslySetInnerHTML={{ __html: transitionCss }} />
      </Head>
      {/* Profile, roles and staff login state of the signed-in user */}
      <AccountProvider>
        {/* Keyed by the page, so each page starts its fade in fresh */}
        <div key={pathOf(router.asPath)} className="pageTransition" data-leaving={leaving ? 'true' : undefined}>
          <Component {...pageProps} />
        </div>
      </AccountProvider>
    </SessionProvider>
  );
}
