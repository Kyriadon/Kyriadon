// ============================================================================
// _app.js
// Global shell: session provider, fonts, design tokens and the global stylesheet.
// ============================================================================
import Head from 'next/head';
import { SessionProvider } from 'next-auth/react';
import { buildCssVariables, fonts } from '../lib/siteDesign';

// Global CSS must be imported here (Next.js pages router rule)
import '../styles/homeStyles.css';

// Design tokens become CSS variables once, at module load
const tokenCss = buildCssVariables();

export default function App({ Component, pageProps: { session, ...pageProps } }) {
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
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
