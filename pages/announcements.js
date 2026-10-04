// ============================================================================
// /api/announcements
// Returns the newest announcements from data/announcements.json.
// Query: ?limit=4 (1 to 20, default 4)
// ============================================================================
import fs from 'fs';
import path from 'path';

// Location of the announcement data
const DATA_FILE = path.join(process.cwd(), 'data', 'announcements.json');

export default async function handler(req, res) {
  // Read-only endpoint
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const raw = JSON.parse(await fs.promises.readFile(DATA_FILE, 'utf8'));

    // Clamp the requested limit to a safe range
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 20);

    // Keep valid entries only, newest first
    const announcements = raw
      .filter((item) => item && item.id && item.title && item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ announcements });
  } catch (error) {
    return res.status(500).json({ error: 'Announcements are unavailable' });
  }
}
