import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Database,
  ExternalLink,
  Disc3,
  Music4,
  ServerCog,
  Settings,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { HashRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { initialAppState } from './lib/initialState';
import {
  addPlexTracksToPlaylist,
  createPlexPlaylist,
  createPlexPin,
  discoverPlexServers,
  discoverPlexMusicLibraries,
  getPlexAudioPlaylists,
  getPlexMusicLibraryTracks,
  getPlexAuthorizationUrl,
  pollPlexAuth,
  type PlexAudioPlaylist,
  type PlexMusicLibrary,
  type PlexPinResponse,
  type PlexServer,
} from './lib/plex';
import { matchSpotifyToPlex } from './lib/matching';
import {
  addLidarrAlbum,
  getLidarrSetupOptions,
  searchLidarrAlbums,
  type LidarrAlbumLookup,
  type LidarrOption,
} from './lib/lidarr';
import {
  createImportedPlaylist,
  extractSpotifyPlaylistId,
  parsePublicPlaylistTitle,
  parsePublicPlaylistText,
  type PublicPlaylistMetadata,
} from './lib/spotifyPublicPlaylist';
import { loadAppState, resetAppState, saveAppState } from './lib/storage';
import type { AppState, MatchingSummary, PlexTrack, PlaylistMeta, SpotifyTrack, SyncRecord } from './lib/types';

function formatDate(isoDate: string | undefined): string {
  if (!isoDate) {
    return 'Not synced yet';
  }

  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function DashboardView({
  state,
  playlistUrl,
  onPlaylistUrlChange,
}: {
  state: AppState;
  playlistUrl: string;
  onPlaylistUrlChange: (value: string) => void;
}) {
  const navigate = useNavigate();
  const importedTrackCount = Object.values(state.spotifyTracks)
    .reduce((total, tracks) => total + tracks.length, 0);
  const startImport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate('/playlists');
  };

  return (
    <div className="landing-page">
      <section className="hero-stage">
        <svg className="hero-signal" viewBox="0 0 1400 300" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-40 166 H130 L166 155 L187 181 L210 122 L230 206 L250 89 L273 225 L298 144 L322 166 H432 L459 153 L476 172 L497 105 L520 218 L543 70 L565 236 L588 149 L610 166 H731 L751 156 L770 181 L791 117 L811 211 L835 92 L856 220 L879 150 L904 166 H1018 L1040 151 L1059 181 L1080 111 L1102 222 L1126 78 L1148 220 L1170 146 L1194 166 H1440" />
          <path d="M-40 178 H133 L167 168 L187 189 L210 140 L230 211 L250 108 L273 225 L298 157 L323 178 H434 L459 166 L476 183 L497 124 L520 218 L543 91 L565 237 L588 160 L611 178 H733 L752 169 L770 190 L791 135 L811 212 L835 111 L856 222 L879 162 L905 178 H1020 L1040 166 L1059 188 L1080 128 L1102 224 L1126 99 L1148 222 L1170 158 L1195 178 H1440" />
        </svg>
        <div className="hero-copy">
          <p className="hero-index">A LITTLE TOOL FOR YOUR MUSIC LIBRARY <span>— 01</span></p>
          <h1>Keep the<br />playlist.<br /><span>Lose<br />nothing.</span></h1>
          <p className="hero-description">
            See what you already own, find what’s missing, and make a Plex playlist from the tracks in your library.
          </p>
          <form className="hero-actions" onSubmit={startImport}>
            <label className="hero-url-label" htmlFor="homepage-playlist-url">Start by pasting a public Spotify playlist link</label>
            <div className="hero-url-control">
              <input
                id="homepage-playlist-url"
                aria-label="Spotify playlist URL"
                value={playlistUrl}
                onChange={(event) => onPlaylistUrlChange(event.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
              />
              <button type="submit" disabled={!playlistUrl.trim()} aria-label="Continue with playlist">
                Continue <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
            <span className="hero-action-note">PUBLIC PLAYLISTS · NO SPOTIFY LOGIN</span>
          </form>
        </div>

        <div className="hero-art" aria-label="Illustration of a vinyl record and music notes">
          <div className="record-shadow" />
          <div className="vinyl-record">
            <div className="vinyl-groove groove-one" />
            <div className="vinyl-groove groove-two" />
            <div className="vinyl-groove groove-three" />
            <div className="vinyl-label"><Music4 className="h-8 w-8" /></div>
            <div className="vinyl-hole" />
          </div>
          <div className="record-sheen" />
          <span className="art-note art-note-top">SIDE A <span>33⅓ RPM</span></span>
          <span className="art-note art-note-left">A match<br />made at home.</span>
          <span className="art-note art-note-right">All the tracks<br />in their place.</span>
          <span className="art-note art-note-bottom">SPOTIFY IN / PLEX OUT</span>
          <span className="art-star" aria-hidden="true">✳</span>
        </div>
        <div className="hero-edition">LIBRARY NOTES <span>VOL. 01 / HOME AUDIO</span></div>
      </section>

      <section className="dashboard-strip" aria-label="Library status">
        <div className="strip-heading"><span>YOUR SETUP</span><span className="strip-rule" /></div>
        <div className="strip-stat"><span className="strip-label">PLAYLIST SOURCE</span><strong>Public links</strong><small>NO LOGIN REQUIRED</small></div>
        <div className="strip-stat"><span className="strip-label">PLEX SERVER</span><strong>{state.plexConnected ? state.selectedServer?.name ?? 'Connected' : 'Not connected'}</strong><small>{state.selectedLibrary?.name ?? 'SELECT A MUSIC LIBRARY'}</small></div>
        <div className="strip-stat"><span className="strip-label">IMPORTED TRACKS</span><strong>{importedTrackCount}</strong><small>{state.importedPlaylists.length} PLAYLISTS ADDED</small></div>
        <NavLink to="/playlists" className="strip-link">Explore playlists <ArrowRight className="h-4 w-4" /></NavLink>
      </section>

      <section className="recent-section">
        <div className="recent-heading"><p>RECENTLY IN ROTATION</p><span>YOUR SYNC HISTORY</span></div>
        {state.syncHistory.length > 0 ? state.syncHistory.map((entry, index) => (
          <article key={entry.id} className="recent-item">
            <span className="recent-number">0{index + 1}</span>
            <div className="recent-title"><h2>{entry.spotifyName}</h2><p>{entry.plexName ?? 'Plex playlist'}</p></div>
            <div className="recent-counts"><strong>{entry.matchedCount} <span>matched</span></strong><strong>{entry.missingCount} <span>missing</span></strong></div>
            <span className="recent-date">{formatDate(entry.lastSyncedAt)}</span>
          </article>
        )) : (
          <p className="recent-empty">Your synced playlists will show up here.</p>
        )}
      </section>
    </div>
  );
}

function PlaylistImportPanel({
  existingPlaylists,
  playlistUrl,
  onPlaylistUrlChange,
  onImport,
}: {
  existingPlaylists: AppState['importedPlaylists'];
  playlistUrl: string;
  onPlaylistUrlChange: (value: string) => void;
  onImport: (metadata: PublicPlaylistMetadata, tracks: SpotifyTrack[]) => void;
}) {
  const [playlistUrlInput, setPlaylistUrlInput] = useState(playlistUrl);
  const [metadata, setMetadata] = useState<PublicPlaylistMetadata | null>(null);
  const [trackText, setTrackText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const parsedTitle = parsePublicPlaylistTitle(trackText);
  const importMetadata = metadata
    ? { ...metadata, name: parsedTitle ?? metadata.name }
    : null;
  const parsedTracks = useMemo(
    () => metadata ? parsePublicPlaylistText(trackText, metadata.id) : [],
    [metadata, trackText],
  );
  const activeStep = parsedTracks.length > 0 ? 3 : metadata ? 2 : 1;

  const loadPlaylist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setMetadata(null);
    setTrackText('');

    const playlistId = extractSpotifyPlaylistId(playlistUrlInput);
    if (!playlistId) {
      setError('Enter a public Spotify playlist URL, embed URL, or spotify:playlist URI.');
      return;
    }

    setMetadata({
      id: playlistId,
      name: `Spotify playlist ${playlistId.slice(0, 6)}…`,
    });
    setNotice('Link validated. Open the public track listing, then paste its contents below.');
  };

  const handleImport = () => {
    if (!importMetadata || parsedTracks.length === 0) {
      setError('No readable tracks found. Copy the full track listing from the public track-list page and try again.');
      return;
    }

    const existing = existingPlaylists.find((playlist) => playlist.id === importMetadata.id);
    onImport(importMetadata, parsedTracks);
    setTrackText('');
    setNotice(`${parsedTracks.length} tracks imported from “${importMetadata.name}”.`);
    setError('');
    if (existing) {
      setNotice(`Updated “${importMetadata.name}” with ${parsedTracks.length} tracks.`);
    }
  };

  const readerUrl = metadata
    ? `https://r.jina.ai/https://open.spotify.com/embed/playlist/${encodeURIComponent(metadata.id)}`
    : '';

  return (
    <section className="playlist-import-panel" aria-labelledby="playlist-import-title">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Public playlist import</p>
            <h2 id="playlist-import-title" className="mt-2 text-xl font-semibold text-white">Paste a playlist to get started</h2>
          </div>
        </div>

        <p className="playlist-import-description mb-5 text-sm">
          Enter your public Spotify playlist link, then paste its track listing in the box below. No Spotify login, API, or Premium required.
        </p>

        <ol className="import-steps" aria-label="Playlist import steps">
          {[
            { number: 1, title: 'Add link' },
            { number: 2, title: 'Open listing' },
            { number: 3, title: 'Import tracks' },
          ].map((step) => (
            <li
              key={step.number}
              className={`import-step ${activeStep === step.number ? 'is-active' : ''} ${activeStep > step.number ? 'is-complete' : ''}`}
              aria-current={activeStep === step.number ? 'step' : undefined}
            >
              <span className="step-number">{activeStep > step.number ? <Check className="h-3.5 w-3.5" /> : `0${step.number}`}</span>
              <span>{step.title}</span>
            </li>
          ))}
        </ol>

        <form onSubmit={loadPlaylist} className={`import-stage playlist-url-form ${metadata ? 'is-complete' : 'is-active'}`}>
          <label className="min-w-0 flex-1">
            <span className="mb-2 block text-sm font-semibold text-white">1. Spotify playlist URL</span>
            <input
              value={playlistUrlInput}
              onChange={(event) => {
                setPlaylistUrlInput(event.target.value);
                onPlaylistUrlChange(event.target.value);
                setMetadata(null);
                setTrackText('');
              }}
              placeholder="https://open.spotify.com/playlist/..."
              aria-label="Spotify playlist URL"
              className="playlist-url-input"
            />
          </label>
          <button type="submit" className="playlist-import-submit mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold">
            <Music4 className="h-4 w-4" />
            Validate link
          </button>
        </form>

        {metadata && (
          <div key={metadata.id} className="import-stage playlist-reader-card mt-5 space-y-4 rounded-xl p-4 is-active">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-800"><Music4 className="h-6 w-6 text-emerald-300" /></div>
              <div>
                <h3 className="font-semibold text-white">{importMetadata?.name}</h3>
                <p className="text-xs text-zinc-300">Public Spotify playlist · no account or API access</p>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
              <p className="text-sm font-medium text-white">Get the track list</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-300">
                <li>Open the public page-reader result below.</li>
                <li>Select and copy its track listing.</li>
                <li>Paste the copied text below.</li>
              </ol>
              <a href={readerUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-zinc-800">
                Open playlist text to copy <ExternalLink className="h-4 w-4" />
              </a>
              <p className="mt-2 text-xs text-zinc-300">A page reader opens the public listing as text. Use only public playlists.</p>
            </div>
          </div>
        )}

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-semibold text-white">2. Paste the track listing</span>
          <div className="playlist-format-preview">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide">Format preview · example only</p>
            <pre aria-label="Track listing format example">{'1. ### Track title\n#### Artist name\n03:45'}</pre>
          </div>
          <textarea
            value={trackText}
            onChange={(event) => { setTrackText(event.target.value); setError(''); }}
            rows={7}
            placeholder="Paste the copied playlist text here"
            className="playlist-track-input"
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-zinc-200" aria-live="polite">
            {parsedTracks.length > 0 ? `${parsedTracks.length} readable tracks detected` : 'Paste the listing here; the sample above is not imported.'}
          </span>
          <button type="button" onClick={handleImport} disabled={parsedTracks.length === 0} className="playlist-import-submit inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60">
            <Check className="h-4 w-4" /> Import {parsedTracks.length || ''} tracks
          </button>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300">{notice}</p>}
    </section>
  );
}

function PlaylistView({
  state,
  playlistUrl,
  onPlaylistUrlChange,
  onImport,
  onConfirmMatch,
  onSyncCompleted,
}: {
  state: AppState;
  playlistUrl: string;
  onPlaylistUrlChange: (value: string) => void;
  onImport: (metadata: PublicPlaylistMetadata, tracks: SpotifyTrack[]) => void;
  onConfirmMatch: (spotifyTrackId: string, match: PlexTrack) => void;
  onSyncCompleted: (
    playlist: PlaylistMeta,
    plexPlaylistId: string,
    plexPlaylistName: string,
    summary: MatchingSummary,
    library: PlexMusicLibrary,
    confirmedMatches: Record<string, PlexTrack>,
  ) => void;
}) {
  const [requestedAction, setRequestedAction] = useState<{
    action: 'Preview sync' | 'Sync now' | 'Missing tracks';
    playlist: PlaylistMeta;
    loading: boolean;
    libraries?: PlexMusicLibrary[];
    audioPlaylists?: PlexAudioPlaylist[];
    libraryKey?: string;
    playlistMode?: 'new' | 'existing';
    targetPlaylistId?: string;
    summary?: MatchingSummary;
    confirmedMatches?: Record<string, PlexTrack>;
    reviewSelections?: Record<string, string>;
    error?: string;
    completed?: { plexPlaylistId: string; name: string; addedCount: number; alreadyPresentCount: number };
  } | null>(null);
  const plexReady = state.plexConnected && Boolean(state.selectedServer);

  const loadPreview = async (playlist: PlaylistMeta, action: 'Preview sync' | 'Sync now' | 'Missing tracks') => {
    setRequestedAction({ action, playlist, loading: true });
    const server = state.selectedServer;
    const token = server?.accessToken || state.plexToken;
    const tracks = state.spotifyTracks[playlist.id] ?? [];
    if (!server || !token) {
      setRequestedAction({ action, playlist, loading: false, error: 'Plex credentials are missing. Reconnect Plex and select your server again.' });
      return;
    }
    if (tracks.length === 0) {
      setRequestedAction({ action, playlist, loading: false, error: 'This playlist has no imported track data. Re-import the public playlist listing before previewing it.' });
      return;
    }
    try {
      const [libraries, audioPlaylists] = await Promise.all([
        discoverPlexMusicLibraries(server.url, token),
        action === 'Sync now' ? getPlexAudioPlaylists(server.url, token) : Promise.resolve([]),
      ]);
      if (libraries.length === 0) {
        setRequestedAction({ action, playlist, loading: false, error: 'No Plex music libraries were found on the selected server.' });
        return;
      }
      const preferredLibrary = libraries.find((library) => library.key === state.selectedLibrary?.key);
      if (preferredLibrary || libraries.length === 1) {
        const library = preferredLibrary ?? libraries[0];
        const plexTracks = await getPlexMusicLibraryTracks(server.url, token, library.key);
        setRequestedAction({
          action,
          playlist,
          loading: false,
          libraries,
          audioPlaylists,
          libraryKey: library.key,
          playlistMode: 'new',
          targetPlaylistId: audioPlaylists[0]?.id,
          summary: matchSpotifyToPlex(tracks, plexTracks, state.confirmedMatches),
          confirmedMatches: {},
          reviewSelections: {},
        });
        return;
      }
      setRequestedAction({
        action,
        playlist,
        loading: false,
        libraries,
        audioPlaylists,
        libraryKey: libraries[0].key,
        playlistMode: 'new',
        targetPlaylistId: audioPlaylists[0]?.id,
      });
    } catch (error) {
      setRequestedAction({
        action,
        playlist,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not load music from the selected Plex server.',
      });
    }
  };

  const loadSelectedLibrary = async () => {
    if (!requestedAction?.libraries || !requestedAction.libraryKey || !state.selectedServer) {
      return;
    }
    const token = state.selectedServer.accessToken || state.plexToken;
    if (!token) {
      setRequestedAction({ ...requestedAction, error: 'Plex credentials are missing. Reconnect Plex and select your server again.' });
      return;
    }
    setRequestedAction({ ...requestedAction, loading: true, error: undefined });
    try {
      const [plexTracks, audioPlaylists] = await Promise.all([
        getPlexMusicLibraryTracks(
          state.selectedServer.url,
          token,
          requestedAction.libraryKey,
        ),
        requestedAction.action === 'Sync now'
          ? getPlexAudioPlaylists(state.selectedServer.url, token)
          : Promise.resolve(requestedAction.audioPlaylists ?? []),
      ]);
      setRequestedAction({
        ...requestedAction,
        loading: false,
        audioPlaylists,
        playlistMode: requestedAction.playlistMode ?? 'new',
        targetPlaylistId: requestedAction.targetPlaylistId ?? audioPlaylists[0]?.id,
        summary: matchSpotifyToPlex(
          state.spotifyTracks[requestedAction.playlist.id] ?? [],
          plexTracks,
          state.confirmedMatches,
        ),
        confirmedMatches: requestedAction.confirmedMatches ?? {},
        reviewSelections: requestedAction.reviewSelections ?? {},
      });
    } catch (error) {
      setRequestedAction({
        ...requestedAction,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not load tracks from the selected Plex library.',
      });
    }
  };

  const syncMatchedTracks = async () => {
    if (!requestedAction?.summary || !requestedAction.libraryKey || !state.selectedServer) {
      return;
    }
    if (requestedAction.summary.matched.length === 0) {
      setRequestedAction({ ...requestedAction, error: 'There are no confident matches to add to Plex.' });
      return;
    }
    const token = state.selectedServer.accessToken || state.plexToken;
    if (!token) {
      setRequestedAction({ ...requestedAction, error: 'Plex credentials are missing. Reconnect Plex and select your server again.' });
      return;
    }
    const library = requestedAction.libraries?.find(({ key }) => key === requestedAction.libraryKey);
    if (!library) {
      setRequestedAction({ ...requestedAction, error: 'The selected Plex music library is no longer available. Reload the preview.' });
      return;
    }
    setRequestedAction({ ...requestedAction, loading: true, error: undefined });
    try {
      const matchedPlexTracks = requestedAction.summary.matched.map(({ plex }) => plex);
      let plexPlaylistId: string;
      let plexPlaylistName: string;
      let addedCount: number;
      let alreadyPresentCount: number;
      if (requestedAction.playlistMode === 'existing' && requestedAction.targetPlaylistId) {
        const selectedPlaylist = requestedAction.audioPlaylists?.find(({ id }) => id === requestedAction.targetPlaylistId);
        if (!selectedPlaylist) {
          throw new Error('The selected Plex playlist is no longer available. Reload the preview.');
        }
        const update = await addPlexTracksToPlaylist(
          state.selectedServer.url,
          token,
          state.selectedServer.serverId,
          selectedPlaylist.id,
          matchedPlexTracks,
        );
        plexPlaylistId = selectedPlaylist.id;
        plexPlaylistName = selectedPlaylist.name;
        addedCount = update.addedCount;
        alreadyPresentCount = update.alreadyPresentCount;
      } else {
        const plexPlaylist = await createPlexPlaylist(
          state.selectedServer.url,
          token,
          state.selectedServer.serverId,
          requestedAction.playlist.name,
          matchedPlexTracks,
        );
        plexPlaylistId = plexPlaylist.id;
        plexPlaylistName = plexPlaylist.name;
        addedCount = matchedPlexTracks.length;
        alreadyPresentCount = 0;
      }
      onSyncCompleted(
        requestedAction.playlist,
        plexPlaylistId,
        plexPlaylistName,
        requestedAction.summary,
        library,
        requestedAction.confirmedMatches ?? {},
      );
      setRequestedAction({
        ...requestedAction,
        loading: false,
        completed: { plexPlaylistId, name: plexPlaylistName, addedCount, alreadyPresentCount },
      });
    } catch (error) {
      setRequestedAction({
        ...requestedAction,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not sync tracks to the Plex playlist.',
      });
    }
  };

  const confirmReviewCandidate = (spotifyTrackId: string, plexTrackId: string) => {
    if (!requestedAction?.summary) {
      return;
    }
    const review = requestedAction.summary.ambiguous.find(({ spotify }) => spotify.id === spotifyTrackId);
    const plexTrack = review?.candidates.find(({ id }) => id === plexTrackId);
    if (!review || !plexTrack) {
      return;
    }
    onConfirmMatch(spotifyTrackId, plexTrack);
    setRequestedAction({
      ...requestedAction,
      summary: {
        ...requestedAction.summary,
        ambiguous: requestedAction.summary.ambiguous.filter(({ spotify }) => spotify.id !== spotifyTrackId),
        matched: [
          ...requestedAction.summary.matched,
          {
            spotify: review.spotify,
            plex: plexTrack,
            confidence: 'high',
            explanation: 'Manually confirmed by the user.',
          },
        ],
      },
      confirmedMatches: {
        ...requestedAction.confirmedMatches,
        [spotifyTrackId]: plexTrack,
      },
    });
  };

  return (
    <div className="playlist-page space-y-6">
      <div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Playlists</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Imported playlist library</h1>
        </div>
      </div>

      <PlaylistImportPanel
        existingPlaylists={state.importedPlaylists}
        playlistUrl={playlistUrl}
        onPlaylistUrlChange={onPlaylistUrlChange}
        onImport={onImport}
      />

      <div className="playlist-library">
        {state.importedPlaylists.map((playlist) => {
          const importedTracks = state.spotifyTracks[playlist.id] ?? [];
          const trackCount = importedTracks.length || playlist.trackCount;
          return (
            <article key={playlist.id} className="playlist-card rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-orange-500/20 text-xl font-semibold text-emerald-100">
                  {playlist.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{playlist.name}</h2>
                      <p className="text-sm text-zinc-400">by {playlist.owner}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] uppercase ${playlist.isSynced ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border border-zinc-700 bg-zinc-900 text-zinc-300'}`}>
                      {playlist.isSynced ? 'Synced' : 'Ready'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                    <span>{trackCount} tracks</span>
                    <span>{importedTracks.length > 0 ? 'Track data imported' : 'No track data imported'}</span>
                  </div>
                </div>
              </div>
              {importedTracks.length > 0 && (
                <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60">
                  <summary className="cursor-pointer px-3 py-2 text-sm text-emerald-300">
                    Show imported tracks ({importedTracks.length})
                  </summary>
                  <div className="max-h-64 overflow-y-auto border-t border-zinc-800">
                    {importedTracks.map((track) => (
                      <div key={track.id} className="flex items-center justify-between gap-3 border-b border-zinc-800/70 px-3 py-2 last:border-b-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">{track.name}</p>
                          <p className="truncate text-xs text-zinc-500">{track.artists.join(', ')}</p>
                        </div>
                        <span className="shrink-0 text-xs text-zinc-500">{track.position}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {(['Preview sync', 'Sync now', 'Missing tracks'] as const).map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => {
                      if (plexReady) {
                        void loadPreview(playlist, action);
                      } else {
                        setRequestedAction({ action, playlist, loading: false });
                      }
                    }}
                    className="playlist-action-button rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {requestedAction && (
        <div className="playlist-action-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setRequestedAction(null);
          }
        }}>
          <section
            className={`playlist-action-dialog ${requestedAction.action === 'Sync now' ? 'playlist-sync-dialog' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="playlist-action-title"
          >
            <p className="playlist-action-eyebrow">{requestedAction.completed ? 'PLEX PLAYLIST CREATED' : requestedAction.summary ? 'MATCH PREVIEW' : plexReady ? 'PLEX' : 'PLEX SETUP'}</p>
            <h2 id="playlist-action-title">
              {requestedAction.completed
                ? 'Sync complete'
                : requestedAction.summary
                ? `${requestedAction.action} results`
                : !plexReady
                  ? 'Connect Plex to continue'
                  : requestedAction.loading
                    ? 'Loading your Plex library…'
                    : requestedAction.error
                      ? 'Could not load the preview'
                      : requestedAction.libraries
                        ? 'Choose a music library'
                        : 'Playlist preview'}
            </h2>
            {requestedAction.loading && <p>{requestedAction.summary ? 'Updating the Plex playlist with matched tracks…' : 'Reading music libraries and matching tracks. This may take a moment for a large library.'}</p>}
            {requestedAction.error && <p role="alert">{requestedAction.error}</p>}
            {requestedAction.completed && (
              <p role="status">
                {requestedAction.playlistMode === 'existing' ? 'Updated' : 'Created'} “{requestedAction.completed.name}” in Plex: {requestedAction.completed.addedCount} added
                {requestedAction.completed.alreadyPresentCount > 0 ? `, ${requestedAction.completed.alreadyPresentCount} already present` : ''}.
              </p>
            )}
            {!plexReady && (
              <p>To {requestedAction.action.toLowerCase()}, first connect your Plex account and choose the server that contains your music. Your playlist will stay saved.</p>
            )}
            {plexReady && requestedAction.action === 'Sync now' && requestedAction.summary && !requestedAction.completed && (
              <p className="playlist-sync-warning">
                {requestedAction.playlistMode === 'existing'
                  ? 'Only confident matches are added to the selected playlist. Tracks already there are skipped; missing and “needs review” tracks are excluded.'
                  : 'A new Plex playlist is created with confident matches only. Missing and “needs review” tracks are excluded.'}
              </p>
            )}
            {requestedAction.libraries && !requestedAction.summary && !requestedAction.loading && (
              <div className="mt-4">
                <label htmlFor="preview-library" className="mb-2 block text-sm font-semibold">Plex music library</label>
                <select
                  id="preview-library"
                  value={requestedAction.libraryKey ?? ''}
                  onChange={(event) => setRequestedAction({ ...requestedAction, libraryKey: event.target.value })}
                  className="w-full rounded-lg border border-zinc-600 bg-white px-3 py-2 text-zinc-950"
                >
                  {requestedAction.libraries.map((library) => (
                    <option key={library.key} value={library.key}>{library.name}</option>
                  ))}
                </select>
                <button type="button" className="mt-3 rounded-full bg-yellow-300 px-4 py-2 font-bold text-black" onClick={() => void loadSelectedLibrary()}>
                  Load preview
                </button>
              </div>
            )}
            {requestedAction.summary && (
              <div className="mt-4 space-y-4">
                <p>{requestedAction.summary.matched.length} matched · {requestedAction.summary.missingSpotify.length} missing · {requestedAction.summary.ambiguous.length} need review</p>
                {requestedAction.action === 'Sync now' && !requestedAction.completed && (
                  <div className="space-y-3 rounded-lg border border-zinc-700 p-3">
                    <fieldset className="playlist-destination">
                      <legend className="mb-2 font-bold">Playlist destination</legend>
                      <label className="playlist-destination-option">
                        <input
                          type="radio"
                          name="playlist-mode"
                          className="playlist-destination-radio"
                          checked={requestedAction.playlistMode !== 'existing'}
                          onChange={() => setRequestedAction({ ...requestedAction, playlistMode: 'new' })}
                        />
                        Create a new playlist
                      </label>
                      <label className={`playlist-destination-option ${requestedAction.audioPlaylists?.length ? '' : 'is-disabled'}`}>
                        <input
                          type="radio"
                          name="playlist-mode"
                          className="playlist-destination-radio"
                          checked={requestedAction.playlistMode === 'existing'}
                          disabled={!requestedAction.audioPlaylists?.length}
                          onChange={() => setRequestedAction({
                            ...requestedAction,
                            playlistMode: 'existing',
                            targetPlaylistId: requestedAction.targetPlaylistId ?? requestedAction.audioPlaylists?.[0]?.id,
                          })}
                        />
                        Add to an existing playlist
                      </label>
                      {!requestedAction.audioPlaylists?.length && (
                        <p className="playlist-destination-empty">No existing Plex audio playlists were found. Create one in Plex, then reload Sync now.</p>
                      )}
                    </fieldset>
                    {requestedAction.playlistMode === 'existing' && requestedAction.audioPlaylists && (
                      <label htmlFor="target-plex-playlist" className="block text-sm font-semibold">
                        Existing playlist
                        <select
                          id="target-plex-playlist"
                          value={requestedAction.targetPlaylistId ?? ''}
                          onChange={(event) => setRequestedAction({ ...requestedAction, targetPlaylistId: event.target.value })}
                          className="mt-2 w-full rounded-lg border border-zinc-600 bg-white px-3 py-2 text-zinc-950"
                        >
                          {requestedAction.audioPlaylists.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
                {requestedAction.summary.matched.length > 0 && (
                  <div>
                    <h3 className="font-bold">Matched in Plex</h3>
                    <ul className="playlist-match-list mt-1 max-h-36 overflow-y-auto text-sm">
                      {requestedAction.summary.matched.map(({ spotify, plex }) => (
                        <li key={spotify.id}>{spotify.name} — {spotify.artists.join(', ')} <span>→ {plex.title} — {plex.artist}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {requestedAction.summary.missingSpotify.length > 0 && (
                  <div>
                    <h3 className="font-bold">Missing from Plex</h3>
                    <ul className="playlist-match-list mt-1 max-h-36 overflow-y-auto text-sm">
                      {requestedAction.summary.missingSpotify.map((track) => <li key={track.id}>{track.name} — {track.artists.join(', ')}</li>)}
                    </ul>
                  </div>
                )}
                {requestedAction.summary.ambiguous.length > 0 && (
                  <div>
                    <h3 className="font-bold">Needs review</h3>
                    <ul className="playlist-match-list mt-1 max-h-36 overflow-y-auto text-sm">
                      {requestedAction.summary.ambiguous.map(({ spotify, candidates }) => (
                        <li key={spotify.id} className="py-2">
                          <p>{spotify.name} — {spotify.artists.join(', ')}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <select
                              aria-label={`Plex match for ${spotify.name}`}
                              value={requestedAction.reviewSelections?.[spotify.id] ?? ''}
                              onChange={(event) => setRequestedAction({
                                ...requestedAction,
                                reviewSelections: {
                                  ...requestedAction.reviewSelections,
                                  [spotify.id]: event.target.value,
                                },
                              })}
                              className="min-w-0 flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-white"
                            >
                              <option value="">Choose a Plex match</option>
                              {candidates.map((candidate) => (
                                <option
                                  key={candidate.id}
                                  value={candidate.id}
                                  disabled={requestedAction.summary?.matched.some(({ plex }) => plex.id === candidate.id)}
                                >
                                  {candidate.title} — {candidate.artist}{candidate.album ? ` · ${candidate.album}` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!requestedAction.reviewSelections?.[spotify.id]}
                              onClick={() => {
                                const candidateId = requestedAction.reviewSelections?.[spotify.id];
                                if (candidateId) {
                                  confirmReviewCandidate(spotify.id, candidateId);
                                }
                              }}
                              className="rounded border border-yellow-300 px-2 py-1 text-xs font-bold text-yellow-300 disabled:opacity-50"
                            >
                              Confirm match
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="playlist-action-buttons">
              {!plexReady && (
                <NavLink to="/connections" onClick={() => setRequestedAction(null)}>
                  {state.plexConnected ? 'Finish Plex setup' : 'Go to Plex setup'}
                  <ArrowRight className="h-4 w-4" />
                </NavLink>
              )}
              {plexReady && requestedAction.action === 'Sync now' && (
                requestedAction.summary && !requestedAction.completed ? (
                  <button
                    type="button"
                    disabled={
                      requestedAction.loading ||
                      requestedAction.summary.matched.length === 0 ||
                      (requestedAction.playlistMode === 'existing' && !requestedAction.targetPlaylistId)
                    }
                    onClick={() => void syncMatchedTracks()}
                  >
                    {requestedAction.loading
                      ? 'Syncing…'
                      : requestedAction.playlistMode === 'existing'
                        ? `Add ${requestedAction.summary.matched.length} tracks to playlist`
                        : `Create Plex playlist (${requestedAction.summary.matched.length})`}
                  </button>
                ) : null
              )}
              <button type="button" onClick={() => setRequestedAction(null)}>
                {plexReady ? 'Close' : 'Not now'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MissingTracksView({
  state,
  onConfirm,
  onLidarrAdded,
}: {
  state: AppState;
  onConfirm: (spotifyTrackId: string, match: PlexTrack) => void;
  onLidarrAdded: (spotifyTrackId: string, albumId: number) => void;
}) {
  const [selectedMatches, setSelectedMatches] = useState<Record<string, string>>({});
  const lidarrAddInProgress = useRef(false);
  const [lidarrDialog, setLidarrDialog] = useState<{
    track: AppState['missingTracks'][number];
    loading: boolean;
    albums?: LidarrAlbumLookup[];
    options?: { rootFolders: LidarrOption[]; qualityProfiles: LidarrOption[]; metadataProfiles: LidarrOption[] };
    selectedAlbumId?: string;
    rootFolderPath?: string;
    qualityProfileId?: number;
    metadataProfileId?: number;
    error?: string;
    result?: { albumTitle: string; artistName: string; alreadyAdded: boolean; monitored: boolean };
  } | null>(null);

  const openLidarrAdd = async (track: AppState['missingTracks'][number]) => {
    setLidarrDialog({ track, loading: true });
    if (!state.lidarr?.url || !state.lidarr.apiKey) {
      setLidarrDialog({ track, loading: false, error: 'Set your Lidarr URL and API key in Settings to search and add albums.' });
      return;
    }
    try {
      const [albums, options] = await Promise.all([
        searchLidarrAlbums(state.lidarr, track.artist, track.album || track.title),
        getLidarrSetupOptions(state.lidarr),
      ]);
      const missingOptions: string[] = [];
      if (options.rootFolders.length === 0) {
        missingOptions.push('root folder');
      }
      if (options.qualityProfiles.length === 0) {
        missingOptions.push('quality profile');
      }
      if (options.metadataProfiles.length === 0) {
        missingOptions.push('metadata profile');
      }
      setLidarrDialog({
        track,
        loading: false,
        albums,
        options,
        selectedAlbumId: albums[0]?.foreignAlbumId,
        rootFolderPath: options.rootFolders[0]?.name,
        qualityProfileId: options.qualityProfiles[0]?.id,
        metadataProfileId: options.metadataProfiles[0]?.id,
        ...(albums.length === 0
          ? { error: 'Lidarr found no album results for this track. Search for the album manually in Lidarr.' }
          : missingOptions.length > 0
            ? { error: `Configure a ${missingOptions.join(', ')} in Lidarr before adding an album.` }
            : {}),
      });
    } catch (error) {
      setLidarrDialog({
        track,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not search Lidarr.',
      });
    }
  };

  const addSelectedLidarrAlbum = async (monitored: boolean) => {
    if (
      lidarrAddInProgress.current ||
      !lidarrDialog?.albums ||
      !state.lidarr ||
      !lidarrDialog.selectedAlbumId ||
      !lidarrDialog.rootFolderPath ||
      !lidarrDialog.qualityProfileId ||
      !lidarrDialog.metadataProfileId
    ) {
      return;
    }
    const album = lidarrDialog.albums.find(({ foreignAlbumId }) => foreignAlbumId === lidarrDialog.selectedAlbumId);
    if (!album) {
      setLidarrDialog({ ...lidarrDialog, error: 'Choose a valid Lidarr album result.' });
      return;
    }
    lidarrAddInProgress.current = true;
    setLidarrDialog({ ...lidarrDialog, loading: true, error: undefined });
    try {
      const result = await addLidarrAlbum(state.lidarr, album, {
        rootFolderPath: lidarrDialog.rootFolderPath,
        qualityProfileId: lidarrDialog.qualityProfileId,
        metadataProfileId: lidarrDialog.metadataProfileId,
        monitored,
      });
      onLidarrAdded(lidarrDialog.track.spotifyTrackId, result.albumId);
      setLidarrDialog({
        ...lidarrDialog,
        loading: false,
        result: {
          albumTitle: result.albumTitle,
          artistName: result.artistName,
          alreadyAdded: result.alreadyAdded,
          monitored: result.monitored,
        },
      });
    } catch (error) {
      setLidarrDialog({
        ...lidarrDialog,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not add the album to Lidarr.',
      });
    } finally {
      lidarrAddInProgress.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">Missing tracks</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Tracks missing from your Plex library</h1>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70">
        <table className="min-w-full text-left text-sm text-zinc-300">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase tracking-[0.2em] text-zinc-500">
            <tr>
              <th className="px-4 py-3">Track</th>
              <th className="px-4 py-3">Artist</th>
              <th className="px-4 py-3">Album</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {state.missingTracks.map((track) => (
              <tr key={`${track.title}-${track.playlistPosition}`} className="border-b border-zinc-800 last:border-b-0">
                <td className="px-4 py-3 text-white">
                  {track.title}
                </td>
                <td className="px-4 py-3">{track.artist}</td>
                <td className="px-4 py-3">{track.album}</td>
                <td className="px-4 py-3">{`${Math.floor(track.durationMs / 60_000)}:${String(Math.floor(track.durationMs / 1000) % 60).padStart(2, '0')}`}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${track.status === 'missing' ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border border-orange-500/30 bg-orange-500/10 text-orange-300'}`}>
                    {track.status === 'missing' ? 'Missing from Plex' : 'Review needed'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {track.status === 'review' && track.candidatePlexTracks?.length ? (
                    <div className="flex min-w-56 gap-2">
                      <select
                        aria-label={`Plex match for ${track.title}`}
                        value={selectedMatches[track.spotifyTrackId] ?? ''}
                        onChange={(event) => setSelectedMatches({
                          ...selectedMatches,
                          [track.spotifyTrackId]: event.target.value,
                        })}
                        className="min-w-0 flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-white"
                      >
                        <option value="">Choose a match</option>
                        {track.candidatePlexTracks.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.title} — {candidate.artist}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selectedMatches[track.spotifyTrackId]}
                        onClick={() => {
                          const candidate = track.candidatePlexTracks?.find(
                            ({ id }) => id === selectedMatches[track.spotifyTrackId],
                          );
                          if (candidate) {
                            onConfirm(track.spotifyTrackId, candidate);
                          }
                        }}
                        className="rounded border border-yellow-300 px-2 py-1 text-xs font-bold text-yellow-300 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                    </div>
                  ) : track.lidarrAlbumId ? (
                    <span className="font-semibold text-yellow-300">Added to Lidarr</span>
                  ) : state.lidarr?.url && state.lidarr.apiKey ? (
                    <button
                      type="button"
                      onClick={() => void openLidarrAdd(track)}
                      className="rounded border border-yellow-300 px-2 py-1 text-xs font-bold text-yellow-300"
                    >
                      Search in Lidarr
                    </button>
                  ) : (
                    <NavLink to="/settings" className="text-yellow-300 underline underline-offset-2">
                      Set up Lidarr
                    </NavLink>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.missingTracks.length === 0 && (
        <p className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-400">
          No missing tracks to show yet. Import a playlist to get started.
        </p>
      )}
      {lidarrDialog && (
        createPortal(<div className="playlist-action-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !lidarrDialog.loading) {
            setLidarrDialog(null);
          }
        }}>
          <section className="playlist-action-dialog" role="dialog" aria-modal="true" aria-labelledby="lidarr-dialog-title">
            <p className="playlist-action-eyebrow">LIDARR ALBUM SEARCH</p>
            <h2 id="lidarr-dialog-title">
              {lidarrDialog.result ? 'Album added to Lidarr' : lidarrDialog.loading ? 'Searching Lidarr…' : 'Choose the album to add'}
            </h2>
            <p>{lidarrDialog.track.title} — {lidarrDialog.track.artist}</p>
            {lidarrDialog.error && <p role="alert">{lidarrDialog.error}</p>}
            {lidarrDialog.loading && <p>Searching your Lidarr catalog. This won’t start a download search.</p>}
            {lidarrDialog.result && (
              <p role="status">
                {lidarrDialog.result.alreadyAdded
                  ? 'Already in Lidarr'
                  : lidarrDialog.result.monitored
                    ? 'Added and monitored'
                    : 'Added without monitoring'} “{lidarrDialog.result.albumTitle}” by {lidarrDialog.result.artistName}. Lidarr was not asked to search or download.
              </p>
            )}
            {lidarrDialog.albums && lidarrDialog.albums.length > 0 && !lidarrDialog.result && !lidarrDialog.loading && (
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-semibold">
                  Album result
                  <select
                    value={lidarrDialog.selectedAlbumId ?? ''}
                    onChange={(event) => setLidarrDialog({ ...lidarrDialog, selectedAlbumId: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-zinc-600 bg-white px-3 py-2 text-zinc-950"
                  >
                    {lidarrDialog.albums.map((album) => (
                      <option key={album.foreignAlbumId} value={album.foreignAlbumId}>
                        {album.title} — {album.artist?.artistName ?? album.artist?.name ?? album.artistName ?? 'Unknown artist'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  Root folder
                  <select
                    value={lidarrDialog.rootFolderPath ?? ''}
                    onChange={(event) => setLidarrDialog({ ...lidarrDialog, rootFolderPath: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-zinc-600 bg-white px-3 py-2 text-zinc-950"
                  >
                    {lidarrDialog.options?.rootFolders.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  Quality profile
                  <select
                    value={lidarrDialog.qualityProfileId ?? ''}
                    onChange={(event) => setLidarrDialog({ ...lidarrDialog, qualityProfileId: Number(event.target.value) })}
                    className="mt-2 w-full rounded-lg border border-zinc-600 bg-white px-3 py-2 text-zinc-950"
                  >
                    {lidarrDialog.options?.qualityProfiles.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  Metadata profile
                  <select
                    value={lidarrDialog.metadataProfileId ?? ''}
                    onChange={(event) => setLidarrDialog({ ...lidarrDialog, metadataProfileId: Number(event.target.value) })}
                    className="mt-2 w-full rounded-lg border border-zinc-600 bg-white px-3 py-2 text-zinc-950"
                  >
                    {lidarrDialog.options?.metadataProfiles.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </label>
              </div>
            )}
            <div className="playlist-action-buttons">
              {!lidarrDialog.result && lidarrDialog.albums?.length ? (
                <button
                  type="button"
                  disabled={
                    lidarrDialog.loading ||
                    !lidarrDialog.rootFolderPath ||
                    !lidarrDialog.qualityProfileId ||
                    !lidarrDialog.metadataProfileId
                  }
                  onClick={() => void addSelectedLidarrAlbum(true)}
                >
                  Add and monitor album
                </button>
              ) : null}
              {!lidarrDialog.result && lidarrDialog.albums?.length ? (
                <button
                  type="button"
                  disabled={
                    lidarrDialog.loading ||
                    !lidarrDialog.rootFolderPath ||
                    !lidarrDialog.qualityProfileId ||
                    !lidarrDialog.metadataProfileId
                  }
                  onClick={() => void addSelectedLidarrAlbum(false)}
                >
                  Just Add
                </button>
              ) : null}
              <button type="button" onClick={() => setLidarrDialog(null)} disabled={lidarrDialog.loading}>
                {lidarrDialog.result ? 'Done' : 'Close'}
              </button>
            </div>
          </section>
        </div>, document.body)
      )}
    </div>
  );
}

function ConnectionsView({
  state,
  onConnected,
  onServerSelect,
}: {
  state: AppState;
  onConnected: (user: string, token: string) => void;
  onServerSelect: (server: NonNullable<AppState['selectedServer']>) => void;
}) {
  const serverSummary = state.selectedServer ? `${state.selectedServer.name} · ${state.selectedServer.url}` : 'No server selected';
  const [pin, setPin] = useState<PlexPinResponse | null>(null);
  const [servers, setServers] = useState<PlexServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadServers = useCallback(async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const availableServers = await discoverPlexServers(token);
      setServers(availableServers);
      if (availableServers.length === 0) {
        setNotice('Plex authorized this app, but no available Plex Media Servers were found for this account.');
      } else {
        setNotice(`${availableServers.length} Plex server${availableServers.length === 1 ? '' : 's'} found. Choose one below.`);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load Plex servers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pin) {
      return;
    }

    let active = true;
    let polling = false;
    let attempts = 0;
    const timer = window.setInterval(() => {
      if (polling || !active) {
        return;
      }
      if (attempts >= 150) {
        setError('Plex authorization timed out. Start again to request a new code.');
        setPin(null);
        return;
      }

      attempts += 1;
      polling = true;
      void pollPlexAuth(pin).then(async (result) => {
        if (!active || !result.authToken) {
          return;
        }
        setPin(null);
        onConnected(result.user, result.authToken);
        await loadServers(result.authToken);
      }).catch((pollError: unknown) => {
        if (active) {
          setError(pollError instanceof Error ? pollError.message : 'Could not check Plex authorization.');
          setPin(null);
        }
      }).finally(() => {
        polling = false;
      });
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loadServers, onConnected, pin]);

  const startPlexAuthorization = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const createdPin = await createPlexPin();
      if (!createdPin.id || !createdPin.code) {
        throw new Error('Plex did not return an authorization code. Please try again.');
      }
      setPin(createdPin);
      setNotice('Authorize this app in the Plex tab. This page will finish connecting automatically.');
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Could not start Plex authorization.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="connections-view space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">Connections</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Account and server connectivity</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="connection-card rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300"><Music4 className="h-5 w-5" /></div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Spotify</p>
                <h2 className="text-xl font-semibold text-white">Public playlist import</h2>
              </div>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">No login needed</span>
          </div>
          <p className="text-sm text-zinc-400">Public links only. This import uses no Spotify API, account login, or Premium subscription.</p>
        </div>

        <div className="connection-card rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-orange-500/10 p-2 text-orange-300"><ServerCog className="h-5 w-5" /></div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Plex</p>
                <h2 className="text-xl font-semibold text-white">{state.plexConnected ? state.plexUserName : 'Connect your Plex account'}</h2>
              </div>
            </div>
            <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-300">
              {state.plexConnected ? 'Authenticated' : 'Not connected'}
            </span>
          </div>
          <p className="text-sm text-zinc-400">{serverSummary}</p>
          {!state.plexConnected && !pin && (
            <button type="button" onClick={() => { void startPlexAuthorization(); }} disabled={loading} className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 disabled:opacity-60">
              <ServerCog className="h-4 w-4" /> {loading ? 'Connecting…' : 'Connect Plex'}
            </button>
          )}
          {pin && (
            <div className="plex-pin-panel mt-5">
              <p className="text-sm font-semibold text-white">Authorize this app with Plex</p>
              <p className="mt-2 text-sm text-zinc-300">Open Plex, sign in, and approve the connection. Keep this page open while it checks authorization.</p>
              <a className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-black" href={getPlexAuthorizationUrl(pin)} target="_blank" rel="noreferrer">
                Open Plex to authorize <ExternalLink className="h-4 w-4" />
              </a>
              <button type="button" onClick={() => setPin(null)} className="ml-3 mt-4 px-3 py-3 text-sm font-semibold text-zinc-200">Cancel</button>
            </div>
          )}
          {state.plexConnected && (
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <label className="min-w-[220px] flex-1 text-sm font-semibold text-white">
                Plex server
                <select
                  className="mt-2 min-h-11 w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 text-sm text-white"
                  value={state.selectedServer?.serverId ?? ''}
                  onChange={(event) => {
                    const server = servers.find((item) => (item.machineIdentifier ?? item.url) === event.target.value);
                    if (server) {
                      onServerSelect({
                        name: server.name,
                        url: server.url,
                        serverId: server.machineIdentifier ?? server.url,
                        ...(server.accessToken ? { accessToken: server.accessToken } : {}),
                      });
                    }
                  }}
                  aria-label="Plex server"
                >
                  <option value="">Choose a server</option>
                  {servers.map((server) => (
                    <option key={server.machineIdentifier ?? server.url} value={server.machineIdentifier ?? server.url}>
                      {server.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => { if (state.plexToken) void loadServers(state.plexToken); }} disabled={loading} className="min-h-11 rounded-lg border border-zinc-600 bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60">
                {loading ? 'Loading…' : 'Refresh servers'}
              </button>
            </div>
          )}
          {!state.plexConnected && (
            <ol className="plex-connect-steps mt-5">
              <li>Choose <strong>Connect Plex</strong> and authorize in Plex.</li>
              <li>Return here; your available servers will load.</li>
              <li>Choose the server that contains your music.</li>
            </ol>
          )}
          {state.plexConnected && (
            <p className="mt-4 text-sm text-zinc-300">Select the server containing your music. Your Plex connection is stored in this browser.</p>
          )}
          {notice && <p role="status" className="mt-4 text-sm font-medium text-emerald-300">{notice}</p>}
          {error && <p role="alert" className="mt-4 text-sm font-medium text-red-300">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function SettingsView({
  state,
  onReset,
  onSaveLidarr,
}: {
  state: AppState;
  onReset: () => Promise<void>;
  onSaveLidarr: (url: string, apiKey: string) => void;
}) {
  const [lidarrUrl, setLidarrUrl] = useState(state.lidarr?.url ?? '');
  const [lidarrApiKey, setLidarrApiKey] = useState(state.lidarr?.apiKey ?? '');
  const [lidarrNotice, setLidarrNotice] = useState('');

  const saveLidarrSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveLidarr(lidarrUrl, lidarrApiKey);
    setLidarrNotice(lidarrUrl.trim() && lidarrApiKey.trim() ? 'Lidarr settings saved in this browser.' : 'Lidarr settings cleared.');
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Application configuration</h1>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
        <div className="flex items-center gap-3">
          <ServerCog className="h-5 w-5 text-yellow-300" />
          <h2 className="text-lg font-semibold text-white">Lidarr connection</h2>
        </div>
        <p className="mt-3 text-sm text-zinc-300">
          Add and monitor albums for missing tracks. This app will not trigger Lidarr searches or downloads.
          The URL and API key are stored in this browser’s IndexedDB and sent directly to your Lidarr server.
        </p>
        <form onSubmit={saveLidarrSettings} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-white">
            Lidarr URL
            <input
              type="url"
              value={lidarrUrl}
              onChange={(event) => setLidarrUrl(event.target.value)}
              placeholder="http://192.168.1.20:8686"
              className="mt-2 min-h-11 w-full rounded-lg border border-zinc-600 bg-white px-3 text-zinc-950 placeholder:text-zinc-600"
            />
          </label>
          <label className="text-sm font-semibold text-white">
            Lidarr API key
            <input
              type="password"
              autoComplete="new-password"
              value={lidarrApiKey}
              onChange={(event) => setLidarrApiKey(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-lg border border-zinc-600 bg-white px-3 text-zinc-950"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button type="submit" className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-bold text-black">
              Save Lidarr settings
            </button>
            {lidarrNotice && <p role="status" className="text-sm font-medium text-emerald-300">{lidarrNotice}</p>}
          </div>
        </form>
        <p className="mt-3 text-xs text-zinc-300">
          Lidarr must be reachable from this browser and allow cross-origin requests. Keep the API key private.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold text-white">Local persistence</h2>
        </div>
        <p className="mt-3 text-sm text-zinc-300">Playlist data, Plex credentials, and the optional Lidarr API key are stored in this browser’s IndexedDB. Spotify credentials are never requested or stored.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">Export settings</button>
          <button type="button" onClick={() => { void onReset(); }} className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300">Clear local data</button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
        <div className="flex items-center gap-3">
          <Wrench className="h-5 w-5 text-orange-300" />
          <h2 className="text-lg font-semibold text-white">Environment requirements</h2>
        </div>
        <ul className="mt-4 space-y-3 text-sm text-zinc-400">
          <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" /> No Spotify API keys, Premium subscription, or login required for public playlist imports.</li>
          <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" /> Playlist track text is read from the public listing using a user-initiated page-reader step.</li>
          <li className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 text-orange-300" /> Plex and Lidarr requests run directly from this browser and require CORS access.</li>
        </ul>
      </div>
    </div>
  );
}

function App() {
  const [appState, setAppState] = useState<AppState>(initialAppState);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadAppState().then((stored) => {
      setAppState(stored);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    void saveAppState(appState);
  }, [appState, ready]);

  const handleReset = async () => {
    const restored = await resetAppState();
    setAppState(restored);
  };

  const handlePlaylistImport = (metadata: PublicPlaylistMetadata, tracks: SpotifyTrack[]) => {
    setAppState((current) => {
      const previous = current.importedPlaylists.find((playlist) => playlist.id === metadata.id);
      const updatedPlaylist = createImportedPlaylist(metadata, tracks, previous);

      return {
        ...current,
        importedPlaylists: [
          updatedPlaylist,
          ...current.importedPlaylists.filter((playlist) => playlist.id !== metadata.id),
        ],
        spotifyTracks: {
          ...current.spotifyTracks,
          [metadata.id]: tracks,
        },
      };
    });
  };

  const handleSyncCompleted = (
    playlist: PlaylistMeta,
    plexPlaylistId: string,
    plexPlaylistName: string,
    summary: MatchingSummary,
    library: PlexMusicLibrary,
    confirmedMatches: Record<string, PlexTrack>,
  ) => {
    const syncedAt = new Date().toISOString();
    const unmatchedTracks = [
      ...summary.missingSpotify.map((spotify) => ({ spotify, status: 'missing' as const, candidatePlexTracks: [] as PlexTrack[] })),
      ...summary.ambiguous.map(({ spotify, candidates }) => ({ spotify, status: 'review' as const, candidatePlexTracks: candidates })),
    ];
    const processedTrackIds = new Set([
      ...summary.matched.map(({ spotify }) => spotify.id),
      ...unmatchedTracks.map(({ spotify }) => spotify.id),
    ]);
    const syncRecord: SyncRecord = {
      id: `${playlist.id}-${syncedAt}`,
      spotifyPlaylistId: playlist.id,
      spotifyName: playlist.name,
      plexPlaylistId,
      plexName: plexPlaylistName,
      matchedCount: summary.matched.length,
      missingCount: unmatchedTracks.length,
      lastSyncedAt: syncedAt,
      status: unmatchedTracks.length > 0 ? 'partial' : 'synced',
    };
    setAppState((current) => ({
      ...current,
      selectedLibrary: library,
      confirmedMatches: { ...current.confirmedMatches, ...confirmedMatches },
      importedPlaylists: current.importedPlaylists.map((item) =>
        item.id === playlist.id ? { ...item, isSynced: true, lastSyncedAt: syncedAt } : item,
      ),
      syncHistory: [syncRecord, ...current.syncHistory].slice(0, 50),
      missingTracks: [
        ...current.missingTracks.filter((item) => !processedTrackIds.has(item.spotifyTrackId)),
        ...unmatchedTracks.map(({ spotify, status, candidatePlexTracks }) => ({
          title: spotify.name,
          artist: spotify.artists.join(', '),
          album: spotify.album,
          durationMs: spotify.durationMs,
          playlistPosition: spotify.position,
          status,
          spotifyTrackId: spotify.id,
          playlistId: playlist.id,
          ...(candidatePlexTracks.length > 0 ? { candidatePlexTracks } : {}),
        })),
      ],
    }));
  };

  const handleManualMatchConfirm = (spotifyTrackId: string, match: PlexTrack) => {
    setAppState((current) => ({
      ...current,
      confirmedMatches: { ...current.confirmedMatches, [spotifyTrackId]: match },
      missingTracks: current.missingTracks.filter((track) => track.spotifyTrackId !== spotifyTrackId),
    }));
  };

  const handleLidarrAlbumAdded = (spotifyTrackId: string, albumId: number) => {
    setAppState((current) => ({
      ...current,
      missingTracks: current.missingTracks.map((track) =>
        track.spotifyTrackId === spotifyTrackId ? { ...track, lidarrAlbumId: albumId } : track,
      ),
    }));
  };

  const handleLidarrSettingsSave = (url: string, apiKey: string) => {
    setAppState((current) => ({
      ...current,
      lidarr: url.trim() && apiKey.trim()
        ? { url: url.trim().replace(/\/+$/, ''), apiKey: apiKey.trim() }
        : undefined,
    }));
  };

  const handlePlexConnected = useCallback((user: string, token: string) => {
    setAppState((current) => ({
      ...current,
      plexConnected: true,
      plexUserName: user,
      plexToken: token,
    }));
  }, []);

  const handlePlexServerSelect = (server: NonNullable<AppState['selectedServer']>) => {
    setAppState((current) => ({
      ...current,
      selectedServer: server,
    }));
  };

  return (
    <HashRouter>
      <div className="portfolio-app">
        <div className="portfolio-layout">
          <main className="portfolio-main" aria-busy={!ready}>
            <header className="portfolio-header">
              <NavLink to="/" className="portfolio-wordmark" aria-label="Needle home">
                <span className="wordmark-icon"><Disc3 className="h-5 w-5" /></span>
                <span>NEEDLE<span className="wordmark-period">.</span></span>
              </NavLink>
              <nav className="portfolio-nav" aria-label="Main navigation">
                <NavLink to="/" end>Overview</NavLink>
                <NavLink to="/playlists">Playlists</NavLink>
                <NavLink to="/missing">Missing tracks</NavLink>
                <NavLink to="/connections">Plex</NavLink>
              </nav>
              <div className="portfolio-header-side">
                <span>LOCAL AUDIO <i>PLAYLIST TOOLS</i></span>
                <NavLink to="/settings" aria-label="Settings" className="settings-link"><Settings className="h-4 w-4" /></NavLink>
              </div>
            </header>

            <div className="portfolio-content">
              <Routes>
                <Route path="/" element={<DashboardView state={appState} playlistUrl={playlistUrl} onPlaylistUrlChange={setPlaylistUrl} />} />
                <Route path="/playlists" element={<PlaylistView state={appState} playlistUrl={playlistUrl} onPlaylistUrlChange={setPlaylistUrl} onImport={handlePlaylistImport} onConfirmMatch={handleManualMatchConfirm} onSyncCompleted={handleSyncCompleted} />} />
                <Route path="/missing" element={<MissingTracksView state={appState} onConfirm={handleManualMatchConfirm} onLidarrAdded={handleLidarrAlbumAdded} />} />
                <Route path="/connections" element={<ConnectionsView state={appState} onConnected={handlePlexConnected} onServerSelect={handlePlexServerSelect} />} />
                <Route path="/settings" element={<SettingsView state={appState} onReset={handleReset} onSaveLidarr={handleLidarrSettingsSave} />} />
              </Routes>
            </div>

            <footer className="portfolio-footer">
              <span>GOOD RECORDS. GOOD BACKUPS.</span>
              <span>YOUR MUSIC. YOUR LIBRARY. <b>✳</b></span>
            </footer>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
