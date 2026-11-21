// ============================================================================
// next.config.js
// /resources/announcements is the address of the announcements page. It is served by the
// page in pages/announcements, so the page and its links keep working as before.
// /api/preview/profile/effects/display/[slug] is the address of the profile effect showcase.
// ============================================================================
module.exports = {
  async rewrites() {
    return [
      // The announcements list
      { source: '/resources/announcements', destination: '/announcements' },
      // One announcement (and any deeper path, e.g. /resources/announcements/changelogs/ui-tweaks)
      { source: '/resources/announcements/:path*', destination: '/announcements/:path*' },
      // The profile effect showcase: a long address under /api/preview, so it can never meet the later
      // store pages (/store/profile/effects/[slug]). It is served by the page in pages/effectDisplay.
      { source: '/api/preview/profile/effects/display/:slug', destination: '/effectDisplay/:slug' },
    ];
  },
};
