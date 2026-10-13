// Firebase v9 modular imports by URL (no compat)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getDatabase,
  ref,
  get,
  child,
  update,
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

// --- Your secrets (note: exposing client_secret in frontend is not safe) ---
const client_id = '6723092b646a43249656366daa557f67';
const client_secret = window.PERFORMANCE_CONFIG.spotifyClientSecret;

let redirectOnNextTap = false;

// --- Firebase config & init (modular) ---
const firebaseConfig = {
  apiKey: 'AIzaSyBt6OExTJiiPZpvclAf6Tr2V19AgYGFCK8',
  authDomain: 'magicdatabasekvk.firebaseapp.com',
  databaseURL: 'https://magicdatabasekvk-default-rtdb.firebaseio.com',
  projectId: 'magicdatabasekvk',
  storageBucket: 'magicdatabasekvk.appspot.com',
  messagingSenderId: '246191287618',
  appId: '1:246191287618:web:4afbaff012490215066cdb',
  measurementId: 'G-433NELMKLG',
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// --- DOM Ready ---
document.addEventListener('DOMContentLoaded', async () => {
  const video = document.getElementById('background-video');
  const inputBox = document.getElementById('input-box');

  // Camera init
  async function initCamera() {
    try {
      const constraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: { ideal: 'environment' },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play();

      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() || {};
      if ('zoom' in capabilities) {
        const { min, max } = capabilities.zoom;
        const target = 0.5;
        if (target >= min && target <= max) {
          await track.applyConstraints({ advanced: [{ zoom: target }] });
        }
      }
    } catch {
      // Fail silently on camera issues
    }
  }
  await initCamera();

  // Spotify auth: Client Credentials (unsafe for production on frontend)
  const authString = btoa(`${client_id}:${client_secret}`);
  async function getAccessToken() {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const data = await res.json();
    return data.access_token;
  }

  // --- Automatic match scoring helpers (no user input required) ---

  // Normalize strings so "Bohemian Rhapsody (Remastered 2011)" ~ "bohemian rhapsody"
  function normalize(str) {
    return (str || '')
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, '') // strip (remastered), [live], etc.
      .replace(/feat\.?.*$/i, '') // strip "feat. X" / "ft. X"
      .replace(/[^a-z0-9 ]/g, '') // strip punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Simple token overlap score between two normalized strings (0..1)
  function tokenOverlap(a, b) {
    const aTokens = new Set(a.split(' ').filter(Boolean));
    const bTokens = new Set(b.split(' ').filter(Boolean));
    if (!aTokens.size || !bTokens.size) return 0;
    let shared = 0;
    for (const t of aTokens) if (bTokens.has(t)) shared++;
    return shared / Math.max(aTokens.size, bTokens.size);
  }

  // Score a candidate track against the raw user input automatically.
  // Handles both "Title, Artist" and a single freeform "Title Artist" string.
  function scoreTrack(track, titlePart, artistPart, rawInput) {
    const trackName = normalize(track.name);
    const artistNames = track.artists.map((a) => normalize(a.name));
    const rawNorm = normalize(rawInput);

    let score = 0;

    // Case 1: user gave "Title, Artist" explicitly (comma present)
    if (artistPart) {
      const qTitle = normalize(titlePart);
      const qArtist = normalize(artistPart);

      if (trackName === qTitle) score += 50;
      else score += 40 * tokenOverlap(trackName, qTitle);

      if (artistNames.some((a) => a === qArtist)) score += 35;
      else
        score +=
          25 * Math.max(...artistNames.map((a) => tokenOverlap(a, qArtist)));
    } else {
      // Case 2: single freeform string, e.g. "Bohemian Rhapsody Queen"
      // Compare against "trackname + artistname" combined, both orders.
      const combined1 = normalize(
        `${track.name} ${track.artists[0]?.name || ''}`,
      );
      const combined2 = normalize(
        `${track.artists[0]?.name || ''} ${track.name}`,
      );
      score +=
        50 *
        Math.max(
          tokenOverlap(combined1, rawNorm),
          tokenOverlap(combined2, rawNorm),
        );

      // Bonus if the raw input contains the exact track name
      if (rawNorm.includes(trackName) && trackName.length > 0) score += 20;
    }

    // Popularity used only as a tiebreaker, not the primary signal
    score += (track.popularity || 0) / 200;

    return score;
  }

  // Search song from a single input field. Automatically parses,
  // queries, scores, and selects the best match — no user interaction.
  async function searchSong() {
    inputBox.readOnly = true;

    const raw = (inputBox.value || '').trim();
    if (!raw) return;

    // If a comma is present, treat as "Title, Artist"; otherwise freeform.
    const hasComma = raw.includes(',');
    const [songTitle, artistName] = hasComma
      ? raw.split(',').map((s) => (s || '').trim())
      : [raw, ''];

    const token = await getAccessToken();

    // Build the Spotify query. Field-qualify when we have both parts,
    // otherwise send the raw string and let scoring do the disambiguation.
    const spotifyQuery = artistName
      ? `track:${songTitle} artist:${artistName}`
      : raw;

    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        spotifyQuery,
      )}&type=track&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const data = await res.json();
    const items = data?.tracks?.items || [];

    if (!items.length) {
      // Fallback: retry with a plain (non field-qualified) query in case
      // the strict track:/artist: filter was too aggressive.
      if (artistName) {
        const fallbackRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(
            raw,
          )}&type=track&limit=5`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const fallbackData = await fallbackRes.json();
        const fallbackItems = fallbackData?.tracks?.items || [];
        if (!fallbackItems.length) {
          console.log('Song not found.');
          return;
        }
        return pickAndSubmit(fallbackItems, songTitle, artistName, raw);
      }
      console.log('Song not found.');
      return;
    }

    await pickAndSubmit(items, songTitle, artistName, raw);
  }

  // Rank candidates automatically and push the top match to Firebase.
  async function pickAndSubmit(items, songTitle, artistName, raw) {
    const ranked = items
      .map((track) => ({
        track,
        score: scoreTrack(track, songTitle, artistName, raw),
      }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0].track;
    const spotifyLink = best.external_urls.spotify;

    console.log(
      `Auto-selected: "${best.name}" by ${best.artists
        .map((a) => a.name)
        .join(', ')} (score: ${ranked[0].score.toFixed(2)})`,
    );

    await updateSpotifyLinkInFirebase(spotifyLink);
    redirectOnNextTap = true;
  }

  // Input change triggers search
  inputBox.addEventListener('change', async () => {
    await searchSong();
    inputBox.value = 'Select from photos';
    inputBox.setAttribute('readonly', true);
  });

  // Write to Firebase (equivalent to your PATCH)
  async function updateSpotifyLinkInFirebase(spotifyLink) {
    try {
      await update(ref(database, 'spotify'), { link: spotifyLink });
      console.log('Data sent to Firebase successfully.');
    } catch (e) {
      console.error('Firebase update error:', e);
    }
  }

  // Touch to redirect (reads latest link from DB)
  document.addEventListener('touchend', async () => {
    if (!redirectOnNextTap) return;

    try {
      const snap = await get(child(ref(database), 'spotify/link'));
      const spotifyLink = snap.val();

      if (spotifyLink) {
        const spotifyUri = spotifyLink
          .replace('https://open.spotify.com/', 'spotify:')
          .replace(/\//g, ':');

        // Try app first
        window.location.href = spotifyUri;

        // Fallback to web after a short delay
        setTimeout(() => {
          window.location.href = spotifyLink;
        }, 1000);
      } else {
        alert('No link found.');
      }
    } catch (err) {
      console.error('Error fetching Firebase link:', err);
    } finally {
      redirectOnNextTap = false;
    }
  });

  // Simple swipe detection to enable redirect-on-next-tap
  let tSX = 0,
    tSY = 0,
    tEX = 0,
    tEY = 0;
  const minSwipe = 30;

  document.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    tSX = t.screenX;
    tSY = t.screenY;
  });

  document.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    tEX = t.screenX;
    tEY = t.screenY;
    const dX = Math.abs(tEX - tSX);
    const dY = Math.abs(tEY - tSY);
    if (dX > minSwipe || dY > minSwipe) {
      setTimeout(() => {
        redirectOnNextTap = true;
      }, 500);
    }
  });
});

// Mask hole updater (fixes class vs id)
function updateMaskHole() {
  const scanWindow = document.querySelector('.scan-window');
  const maskLayer = document.getElementById('mask-layer');
  if (!scanWindow || !maskLayer) return;

  const rect = scanWindow.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const top = rect.top;
  const bottom = vh - rect.bottom;
  const left = rect.left;
  const right = vw - rect.right;
  const borderRadius =
    window.getComputedStyle(scanWindow).borderRadius || '10px';

  maskLayer.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${borderRadius})`;
}

window.addEventListener('DOMContentLoaded', updateMaskHole);
window.addEventListener('resize', updateMaskHole);
