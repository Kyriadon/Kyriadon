// ============================================================================
// effectDisplay/[slug].js
// The profile effect showcase. People see it at /api/preview/profile/effects/display/[slug] (a rewrite in
// next.config.js), so it never meets the later store pages. It uses the shared site shell (header,
// footer and background) and shows one card: a caption, then the effect on top of a blank demo profile, with nothing to
// press. An unknown slug is a 404.
// ============================================================================
import Head from 'next/head';
import { SiteShell } from '../../components/siteShell';
import { AnnoMarkup } from '../../components/announcementMarkup';
import { DemoProfile } from '../../components/demoProfile';
import { effects, effectSlugs } from '../../lib/effectRegistry';

// Every effect in the registry gets a page; anything else is a 404
export async function getStaticPaths() {
  return { paths: effectSlugs.map((slug) => ({ params: { slug } })), fallback: false };
}

// Only the slug travels to the page; the effect itself is read from the registry
export async function getStaticProps({ params }) {
  return { props: { slug: params.slug } };
}

export default function EffectDisplayPage({ slug }) {
  const effect = effects[slug];

  return (
    <SiteShell title={`${effect.name} · Profile effect`} description={effect.description}>
      {/* A showcase, not a page to find in a search engine */}
      <Head>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="fxPage">
        <header className="fxCaption">
          <AnnoMarkup text={effect.caption} />
        </header>

        <DemoProfile effectSlug={slug} />
      </div>
    </SiteShell>
  );
}
