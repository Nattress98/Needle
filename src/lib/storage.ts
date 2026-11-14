import { openDB, type DBSchema } from 'idb';
import { initialAppState } from './initialState';
import type { AppState } from './types';

interface AppDatabase extends DBSchema {
  app: {
    key: 'state';
    value: AppState;
  };
}

const databasePromise = openDB<AppDatabase>('spotify-plex-sync-db', 1, {
  upgrade(database) {
    if (!database.objectStoreNames.contains('app')) {
      database.createObjectStore('app');
    }
  },
});

export async function loadAppState(): Promise<AppState> {
  const database = await databasePromise;
  const state = await database.get('app', 'state');
  if (!state) {
    return initialAppState;
  }

  const seededPlaylistIds = new Set(['playlist-1', 'playlist-2']);
  const isLegacyDemoServer = state.selectedServer?.serverId === 'server-1';

  return {
    ...initialAppState,
    ...state,
    plexConnected: state.plexUserName === 'demo.plex' ? false : state.plexConnected,
    plexUserName: state.plexUserName === 'demo.plex' ? '' : state.plexUserName,
    selectedServer: isLegacyDemoServer ? undefined : state.selectedServer,
    selectedLibrary: isLegacyDemoServer ? undefined : state.selectedLibrary,
    importedPlaylists: (state.importedPlaylists ?? []).filter((playlist) => !seededPlaylistIds.has(playlist.id)),
    spotifyTracks: Object.fromEntries(
      Object.entries(state.spotifyTracks ?? {}).filter(([playlistId]) => !seededPlaylistIds.has(playlistId)),
    ),
    syncHistory: (state.syncHistory ?? []).filter(
      (entry) => entry.id !== 'sync-1' && !seededPlaylistIds.has(entry.spotifyPlaylistId),
    ),
    missingTracks: (state.missingTracks ?? []).filter(
      (track) => track.spotifyTrackId !== 'sp-5' && track.spotifyTrackId !== 'sp-6',
    ),
  };
}

export async function saveAppState(state: AppState): Promise<void> {
  const database = await databasePromise;
  await database.put('app', state, 'state');
}

export async function resetAppState(): Promise<AppState> {
  await saveAppState(initialAppState);
  return initialAppState;
}
