// ============================================================================
// /api/stats
// Returns community numbers for the statistics panel:
//   - Discord member and online counts (public invite endpoint, cached 60s)
//   - Discord server profile: id, name, description, banner (same invite response)
//   - Number of mods/projects and announcements (from /data)
// If Discord cannot be reached, those values are null and the UI shows a dash.
// ============================================================================
import fs from 'fs';
import path from 'path';

// Discord invite code (override with DISCORD_INVITE_CODE in .env)
const INVITE_CODE = process.env.DISCORD_INVITE_CODE || 'B6czYB7wa7';

// How long a Discord reading stays fresh, and the retry delay after a failure
const CACHE_TTL_MS = 60 * 1000;
const RETRY_AFTER_MS = 10 * 1000;

// In-memory cache shared by requests on this server instance
let discordCache = { fetchedAt: 0, value: null };

// ----------------------------------------------------------------------------
// Fetches Discord counts with a timeout, keeping the last good value on failure
// ----------------------------------------------------------------------------
async function getDiscordCounts() {
  if (Date.now() - discordCache.fetchedAt < CACHE_TTL_MS) return discordCache.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Discord responded with ${response.status}`);
    const data = await response.json();
    const guild = data.guild || {};
    discordCache = {
      fetchedAt: Date.now(),
      value: {
        members: data.approximate_member_count ?? null,
        online: data.approximate_presence_count ?? null,
        // Server profile for the About page (null when Discord does not provide it)
        guildId: guild.id ?? null,
        name: guild.name ?? null,
        description: guild.description ?? null,
        banner: guild.id && guild.banner ? `https://cdn.discordapp.com/banners/${guild.id}/${guild.banner}.webp?size=1024` : null,
      },
    };
  } catch (error) {
    // Keep the stale value and retry soon
    discordCache = { fetchedAt: Date.now() - CACHE_TTL_MS + RETRY_AFTER_MS, value: discordCache.value };
  } finally {
    clearTimeout(timer);
  }

  return discordCache.value;
}

// ----------------------------------------------------------------------------
// Counts entries in a JSON array file, or returns null if it cannot be read
// ----------------------------------------------------------------------------
async function countEntries(fileName) {
  try {
    const raw = JSON.parse(await fs.promises.readFile(path.join(process.cwd(), 'data', fileName), 'utf8'));
    return Array.isArray(raw) ? raw.length : null;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  // Read-only endpoint
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const [discord, projects, announcements] = await Promise.all([
    getDiscordCounts(),
    countEntries('projects.json'),
    countEntries('announcements.json'),
  ]);

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
  return res.status(200).json({ discord, projects, announcements, updatedAt: new Date().toISOString() });
}
