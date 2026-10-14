# Spotify Performance Interface

A browser-based performance tool that searches Spotify tracks, ranks possible matches, and coordinates a selected track through Firebase Realtime Database. It includes a mobile camera-style interface and a simpler song-search page.

## Run locally

1. Copy `tricks/config.example.js` to `tricks/config.local.js` and provide your own Spotify client secret. The client ID and Firebase client identifiers remain in the source; configure your own project for independent use.
2. From the repository root, run `python3 -m http.server 8000`.
3. Open `http://localhost:8000/tricks/spotifyapp.html` (mobile interface) or `/tricks/spotify.html` (basic search).

Camera access requires a secure context, such as localhost or HTTPS.

## Structure

- `tricks/spotifyapp.js`: camera initialization, input parsing, track ranking, Firebase integration, and reveal navigation.
- `tricks/spotify.js`: basic track search and Firebase updates.
- `tricks/spotifyappstyle.css`: mobile interface styles.
- `tricks/service-worker.js` and `spotifyappmanifest.json`: installable app support.
- `tricks/config.example.js`: credential configuration template.

## Credential boundary

The original prototype uses Spotify client credentials in the browser. Separating the value into an ignored local file prevents committing it, but does **not** hide it from visitors to a deployed site. A production deployment should move token exchange to an authenticated server. This snapshot preserves the prototype architecture; no live deployment or credential rotation was performed.

## Verification

Source parsing, local asset links, and offline mocked track-selection/Firebase flows are checked. Live Spotify authentication, camera access, and Firebase writes require separately configured services.

## Development notes

This is an organized source snapshot prepared in October 2026. Existing production deployments are independent of this repository. Keep local credentials and runtime data out of Git.

## AI-use acknowledgment

See [AI_USE.md](AI_USE.md) for development assistance, runtime AI use, and verification scope.
