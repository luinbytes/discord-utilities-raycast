# Raycast Discord Utilities (Windows)
Local-first, ToS-safe utilities for launching and navigating Discord on Windows via Raycast.

## Features (MVP)
- Pinned Links: user-managed list of `discord://` deep links (servers/channels/DMs). Search by name or tags.
- Profiles: open Stable / PTB / Canary. Copy resolved path when available.
- Actions: open Discord (preferred flavor), open Settings, open Keybinds.
- LocalStorage: pins and preferences stored locally via Raycast. No tokens. No network calls.

## Requirements
- Windows with Discord installed (Stable/PTB/Canary supported)
- Raycast for Windows
- Node.js (for local development)

## Install & Run (local)
```bash
npm install
npm run dev
```

## Usage
- Command: "Discord Utilities" (`src/discord.tsx`).
  - Sections: Pinned Links (first), Profiles, Actions.
  - Profiles section is hidden once a Preferred Flavor is set in Preferences.
  - Pinned item actions: Open, Copy Link, Edit, Remove.
  - Profiles: Open Stable/PTB/Canary, Copy Path.
  - Global actions: Open Discord (preferred), Open Settings, Open Keybinds.
- Secondary command: "Add Discord Pin" (`src/discord-add-pin.tsx`).

## Preferences
- Preferred Flavor: stable (default) | ptb | canary
- Optional overrides: Stable/PTB/Canary paths to `Update.exe` or `Discord*.exe`

## How it works
- Launch routines (Windows):
  - Stable: `%LocalAppData%/Discord/Update.exe --processStart Discord.exe`
  - PTB: `%LocalAppData%/DiscordPTB/Update.exe --processStart DiscordPTB.exe`
  - Canary: `%LocalAppData%/DiscordCanary/Update.exe --processStart DiscordCanary.exe`
  - Fallback: if `Update.exe` is missing, launch `Discord*.exe` directly.
- Deep links: `discord://-/channels/<guild_id>/<channel_id>`; DMs: `discord://-/channels/@me/<channel_id>`.
- Settings links: `discord://-/settings` and `discord://-/settings/keybinds`.

## Constraints & Privacy
- No tokens, no scraping local DBs, no network requests.
- Uses only Raycast APIs and standard Node APIs.

## File Structure
- `src/discord.tsx`: Main list command UI.
- `src/discord-add-pin.tsx`: Secondary command to add a pin.
- `src/utils/discord.ts`: Windows-safe path resolution and launch helpers.
- `src/types.ts` and `src/types/index.ts`: Shared types.
- Asset: `assets/command-icon.png` (referenced in `package.json`).

## Future ideas (non-goals for MVP)
- Auto-discover servers/channels.
- Mute/Deafen via user-configured keybinds and a helper executable.
- Bot or OAuth flows.

## Troubleshooting
- If launching fails, ensure Discord is installed and `discord://` protocol is registered.
- Provide a path override in Preferences if Discord is installed in a non-standard location.

## License
MIT
