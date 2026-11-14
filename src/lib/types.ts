export type Confidence = 'high' | 'medium' | 'low';
export type SyncStatus = 'ready' | 'synced' | 'partial';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  releaseDate?: string;
  durationMs: number;
  position: number;
  isrc?: string;
  spotifyUrl?: string;
}

export interface PlexTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  durationMs: number;
  ratingKey: string;
  libraryId: string;
  isrc?: string;
}

export interface MatchingCandidate {
  spotify: SpotifyTrack;
  plex: PlexTrack;
  confidence: Confidence;
  explanation: string;
}

export interface AmbiguousMatch {
  spotify: SpotifyTrack;
  candidates: PlexTrack[];
  explanation: string;
}

export interface MatchingSummary {
  matched: MatchingCandidate[];
  missingSpotify: SpotifyTrack[];
  ambiguous: AmbiguousMatch[];
}

export interface PlaylistMeta {
  id: string;
  name: string;
  owner: string;
  imageUrl?: string;
  trackCount: number;
  isSynced: boolean;
  lastSyncedAt?: string;
}

export interface SyncRecord {
  id: string;
  spotifyPlaylistId: string;
  spotifyName: string;
  plexPlaylistId?: string;
  plexName?: string;
  matchedCount: number;
  missingCount: number;
  lastSyncedAt: string;
  status: SyncStatus;
}

export interface MissingTrack {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  playlistPosition: number;
  status: 'missing' | 'review';
  spotifyTrackId: string;
  playlistId?: string;
  plexPlaylistId?: string;
  plexPlaylistName?: string;
  candidatePlexTracks?: PlexTrack[];
  lidarrAlbumId?: number;
}

export interface LidarrConnection {
  url: string;
  apiKey: string;
}

export interface AppState {
  plexConnected: boolean;
  plexUserName: string;
  plexToken?: string;
  selectedServer?: {
    name: string;
    url: string;
    serverId: string;
    accessToken?: string;
  };
  selectedLibrary?: {
    key: string;
    name: string;
  };
  importedPlaylists: PlaylistMeta[];
  spotifyTracks: Record<string, SpotifyTrack[]>;
  syncHistory: SyncRecord[];
  missingTracks: MissingTrack[];
  confirmedMatches: Record<string, PlexTrack>;
  lidarr?: LidarrConnection;
}
