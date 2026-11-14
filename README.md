# Spotify → Plex Sync

A static React + TypeScript application that helps compare a Spotify playlist against a user's Plex music library, identifies missing tracks, and prepares a Plex playlist containing only tracks that are already available locally.

## What this MVP includes

- Import public Spotify playlists from a URL without Spotify login, Premium or the Spotify Web API
- Parse track title, artist, duration and ordering from public playlist text
- Local IndexedDB persistence for imported playlist metadata and tracks
- Matching engine with normalisation, duplicate handling and confidence scoring
- Dashboard, playlists, missing tracks, connections and settings screens
- Empty first-run state; playlists appear only after you import them

## Setup

1. Install dependencies:
   npm install
2. Run the app:
   npm run dev

## Import a public Spotify playlist

1. Paste a public playlist URL into the large homepage input or the always-visible URL field on **Playlists**.
2. Validate the link. The app checks it locally and does not request Spotify APIs.
3. Open the public track listing, copy its text, and paste it into the visible track-list box. A sample format appears above as a preview only; it is not imported. The app parses the title, track names, artists, durations and ordering, then stores the result in IndexedDB.

The browser cannot read Spotify's cross-origin embed page directly. The listing step uses Jina Reader to display the public embed page as readable text. This third-party reader receives the public playlist URL; do not use it for private playlists. Spotify can change or restrict its public pages, so parsing may need updates. No Spotify API, account, or Premium subscription is required for public playlists.

## Connect Plex

1. Open **Plex** in the top navigation and select **Connect Plex**.
2. Sign in and authorize the app in the Plex tab that opens.
3. Return to this page, then choose the Plex Media Server that contains your music. Use **Refresh servers** if it is not listed.

The Plex account token and selected server are stored locally in this browser's IndexedDB. **Preview sync** discovers the server's music libraries, reads track metadata, and compares artist and title together; an exact title with a different artist is never considered a match. If there are multiple music libraries, choose one in the preview dialog. Ambiguous results can be manually confirmed before syncing or from **Missing tracks**; confirmed choices are remembered locally. **Sync now** can create a new audio playlist or add matched tracks to an existing one, skipping tracks already present. Missing and unresolved ambiguous tracks are excluded.

## Add missing albums to Lidarr

1. In **Settings**, enter your Lidarr URL and API key. Both values are stored in this browser's IndexedDB and sent directly to that URL.
2. In **Missing tracks**, choose **Search in Lidarr** and select the correct album, root folder, quality profile, and metadata profile.
3. Confirm **Add and monitor album**. The app does not trigger a Lidarr search or download. Lidarr manages albums rather than individual tracks.

Lidarr must be reachable from the browser and allow cross-origin API access. Keep the API key private.

## Development

- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run e2e`

## GitHub Pages deployment

In the repository's **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. The included workflow builds the app and publishes the generated `dist` directory; deploying the repository root instead serves the unbuilt Vite entry point and will not work.

This app is configured with a relative `base` path so it can be deployed under a GitHub Pages project path without a Node server. After setting the Pages source, rerun the **Deploy static site to GitHub Pages** workflow or push a new commit to `main`.

## Notes on integrations

This playlist importer does not use Spotify APIs or authenticate with Spotify. Preview and sync requests run directly from the browser to the selected Plex server; the server must be reachable and permit browser cross-origin reads and playlist writes. Lidarr requests also run directly from the browser to the URL entered in Settings. Matching and import parsing are covered by unit tests.
