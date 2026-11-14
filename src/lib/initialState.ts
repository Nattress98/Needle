import type { AppState } from './types';

export const initialAppState: AppState = {
  plexConnected: false,
  plexUserName: '',
  importedPlaylists: [],
  spotifyTracks: {},
  syncHistory: [],
  missingTracks: [],
  confirmedMatches: {},
};
