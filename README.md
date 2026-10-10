# Kyriadon

**The official website of the Kyriadon community.**
Registration and tier-testing guides, live Discord stats, announcements and instant search, all in one place.

[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Node](https://img.shields.io/badge/Node-%E2%89%A5%2018.17-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Join the Discord](https://discord.gg/B6czYB7wa7)

</div>

---

## Overview

Kyriadon is a community built around competitive Minecraft PvP and structured **tier testing**. This repository contains its website: a fast, server-rendered [Next.js](https://nextjs.org) app with a dark, cohesive interface and no database to maintain. Content lives in plain JSON files, and every visual value comes from one design-token file.

## Features

- **Home**: hero, quick links, latest announcements and live community statistics.
- **About** (`/about`): a step-by-step registration guide, a testing guide, a live Discord server panel and the boosting perks.
- **Advanced guide**: explains how tier testing works, then opens a searchable information hub covering supported servers, testing procedures, tier assignments, cooldowns, rules, allowed and banned lists, and gate keeping.
- **Role Studio**: lets visitors design a custom role (icon, solid or gradient colors, live preview).
- **Instant search**: press <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>K</kbd> anywhere to search mods and projects.
- **Discord login**: sign in with Discord through NextAuth (`identify` scope only).
- **Design system**: tokens, typography, roles and motion are defined once and enforced by a written [Design Doctrine](Design-Doctrine.md).

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | [Next.js 14](https://nextjs.org) (Pages Router) |
| UI | [React 18](https://react.dev) |
| Auth | [NextAuth.js 4](https://next-auth.js.org) with the Discord provider |
| Styling | Plain CSS driven by design tokens converted to CSS variables |
| Content | JSON files in [`data/`](data), served through API routes |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) **18.17 or newer**
- A [Discord application](https://discord.com/developers/applications) for login (OAuth2 client ID and secret)

### Installation

```bash
git clone https://github.com/<your-username>/Kyriadon.git
cd Kyriadon
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<a long random string>
DISCORD_CLIENT_ID=<your Discord application client ID>
DISCORD_CLIENT_SECRET=<your Discord application client secret>
DISCORD_INVITE_CODE=B6czYB7wa7
```

| Variable | Required | Purpose |
| --- | :---: | --- |
| `NEXTAUTH_URL` | Yes | Public URL of the site (`http://localhost:3000` in development). |
| `NEXTAUTH_SECRET` | Yes | Secret used by NextAuth to sign sessions. Generate one with `openssl rand -base64 32`. |
| `DISCORD_CLIENT_ID` | Yes | OAuth2 client ID for Discord login. |
| `DISCORD_CLIENT_SECRET` | Yes | OAuth2 client secret for Discord login. |
| `DISCORD_INVITE_CODE` | No | Invite code used to read member counts and the server profile. Defaults to the Kyriadon invite. |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CREATOR_ROLE_ID` | No | Reserved for upcoming Discord features. They are not read yet. |

> [!WARNING]
> Never commit `.env`. It is already listed in `.gitignore`. If a secret is ever exposed, rotate it in the Discord Developer Portal.

In your Discord application, add `http://localhost:3000/api/auth/callback/discord` as an OAuth2 redirect URL (use your production URL when deploying).

### Run it

```bash
npm run dev      # development server on http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

## API routes

| Route | Description |
| --- | --- |
| `GET /api/stats` | Discord member and online counts and the server profile (cached for 60 seconds), plus project and announcement totals. Returns `null` for Discord values if Discord cannot be reached. |
| `GET /api/announcements?limit=4` | Newest announcements from `data/announcements.json` (1 to 20, default 4). |
| `GET /api/search?q=text` | Search across every registered source, grouped by type. An empty query returns featured items. Used by the <kbd>Ctrl</kbd> + <kbd>K</kbd> palette. |
| `/api/auth/*` | NextAuth endpoints for Discord login. |

New searchable systems register one source in `pages/api/search.js` and appear in the palette automatically.

## Editing content

| What | Where |
| --- | --- |
| Announcements | [`data/announcements.json`](data/announcements.json) |
| Mods and projects (search results) | [`data/projects.json`](data/projects.json) |
| Guide copy, servers, roles and rules | [`pages/about.js`](pages/about.js) |
| Colors, gradients, fonts, spacing and role colors | [`lib/siteDesign.js`](lib/siteDesign.js) |

## Project structure

```
.
├── components/
│   └── siteShell.js        # Header, footer, search palette, shared icons
├── data/
│   ├── announcements.json  # Announcement feed
│   └── projects.json       # Searchable mods and projects
├── lib/
│   └── siteDesign.js       # Design tokens (the single source of truth)
├── pages/
│   ├── api/                # auth, search, stats, announcements
│   ├── _app.js             # Global shell, tokens and stylesheets
│   ├── index.js            # Home
│   └── about.js            # About: guides, Advanced guide, boosting perks
├── public/                 # Server icon and banner
├── styles/
│   ├── homeStyles.css      # Global primitives (panels, buttons, hero)
│   └── aboutStyles.css     # About page styles
└── Design-Doctrine.md      # Written rules for the visual identity
```

## Design

Every visual decision belongs to one system. Colors, typography, spacing, radii, motion and role treatments are defined in [`lib/siteDesign.js`](lib/siteDesign.js), converted to CSS variables once in `pages/_app.js`, and consumed by the stylesheets. The rules behind them are written down in the [Design Doctrine](Design-Doctrine.md). Please read it before adding or changing UI.

## Deployment

Kyriadon is a standard Next.js app and runs on any Node.js host or on [Vercel](https://vercel.com).

1. Set the environment variables above on your host, with `NEXTAUTH_URL` set to your public URL.
2. Add `<your-url>/api/auth/callback/discord` as a redirect in the Discord Developer Portal.
3. Run `npm run build` and `npm start`.

## Contributing

Issues and pull requests are welcome. Before opening one:

- Follow the [Design Doctrine](Design-Doctrine.md). New UI should reuse existing tokens instead of introducing new values.
- Keep content in the JSON files or the content constants at the top of each page, not inside components.
- Check the page at desktop and phone width.

## License

Released under the [MIT License](LICENSE).
