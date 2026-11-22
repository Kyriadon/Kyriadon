// ============================================================================
// effectDisplay/index.js
// The profile showcase. People see it at /api/preview/profile/effects/display (a rewrite in
// next.config.js), so it never meets the later store pages. It uses the shared site shell (header,
// footer and background) and shows one blank demo profile, with nothing to press.
// ============================================================================
import Head from 'next/head';
import { SiteShell } from '../../components/siteShell';
import { DemoProfile } from '../../components/demoProfile';

export default function ProfileShowcasePage() {
  return (
    <SiteShell title="Profile showcase" description="A blank demo profile.">
      {/* A showcase, not a page to find in a search engine */}
      <Head>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="fxPage">
        <DemoProfile />
      </div>
    </SiteShell>
  );
}
