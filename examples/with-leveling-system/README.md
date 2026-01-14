# Leveling Bot

Leveling Bot is a Discord bot for managing user levels and experience points (XP) in a Discord server. This bot is built with [discord.js](https://discord.js.org), using [CommandKit](https://commandkit.dev) framework.

## Features

- User leveling system based on messages
- Rank card & Leaderboard card powered by [canvacord](https://canvacord.neplex.dev)
- Redis powered caching with on-demand cache invalidation
- Rate limiting to prevent spam
- Hybrid commands (use interactions or message commands)
- Customizable prefix for message commands
- Multi-language support
- Components v2
- Analytics with [Umami](https://umami.is)

## Tech Stack

- Node.js
- Discord.js
- CommandKit
- Redis
- Prisma
- TypeScript

## Getting Started

Ensure you have Node.js and npm installed. Clone the repository and install the dependencies:

```bash
git clone https://github.com/neplextech/leveling-bot
cd leveling-bot
npm install
```

### Environment Variables

Create a `.env` file in the root directory and add the following variables:

```env
# The discord bot token
DISCORD_TOKEN="xxx"

# Redis url
REDIS_URL="redis://localhost:6379"

# Database url
DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"
```

### Running the Bot

```bash
npm run dev
```

### Building the Bot

```bash
npm run build
```

### Running in Production

```bash
npm run start
```
