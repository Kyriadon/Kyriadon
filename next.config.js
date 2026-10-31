// ============================================================================
// next.config.js
// /resources/announcements is the address of the announcements page. It is served by the
// page in pages/announcements, so the page and its links keep working as before.
// ============================================================================
module.exports = {
  async rewrites() {
    return [
      // The announcements list
      { source: '/resources/announcements', destination: '/announcements' },
      // One announcement (and any deeper path, e.g. /resources/announcements/changelogs/ui-tweaks)
      { source: '/resources/announcements/:path*', destination: '/announcements/:path*' },
    ];
  },
};
