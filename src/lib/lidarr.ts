import type { LidarrConnection } from './types';

export type LidarrConfig = LidarrConnection;

export interface LidarrOption {
  id: number;
  name: string;
}

export interface LidarrArtistLookup {
  foreignArtistId: string;
  artistName?: string;
  name?: string;
  [key: string]: unknown;
}

export interface LidarrAlbumLookup {
  foreignAlbumId: string;
  title: string;
  artist?: LidarrArtistLookup;
  artistName?: string;
  [key: string]: unknown;
}

export interface LidarrAlbumAddResult {
  albumId: number;
  artistName: string;
  albumTitle: string;
  alreadyAdded: boolean;
  monitored: boolean;
}

interface LidarrArtist extends LidarrArtistLookup {
  id: number;
}

interface LidarrAlbum extends LidarrAlbumLookup {
  id: number;
  monitored?: boolean;
}

function getBaseUrl(config: LidarrConfig): string {
  const url = config.url.trim().replace(/\/+$/, '');
  if (!url || !config.apiKey.trim()) {
    throw new Error('Enter your Lidarr URL and API key in Settings first.');
  }
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error('Enter a valid Lidarr URL, including http:// or https://.');
  }
  return url;
}

async function lidarrRequest<T>(
  config: LidarrConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json', 'X-Api-Key': config.apiKey.trim() });
  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }
  let response: Response;
  try {
    response = await fetch(`${getBaseUrl(config)}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Could not reach Lidarr. Check its URL, network access, and browser CORS settings.');
    }
    throw error;
  }
  if (!response.ok) {
    const details = (await response.text()).trim().slice(0, 250);
    throw new Error(`Lidarr request failed: ${response.status}${details ? ` — ${details}` : ''}`);
  }
  return await response.json() as T;
}

function escapeQuery(value: string): string {
  return encodeURIComponent(value);
}

export async function searchLidarrAlbums(
  config: LidarrConfig,
  artist: string,
  album: string,
): Promise<LidarrAlbumLookup[]> {
  const term = `${artist} ${album}`.trim();
  return await lidarrRequest<LidarrAlbumLookup[]>(
    config,
    `/api/v1/album/lookup?term=${escapeQuery(term)}`,
  );
}

export async function getLidarrSetupOptions(config: LidarrConfig): Promise<{
  rootFolders: LidarrOption[];
  qualityProfiles: LidarrOption[];
  metadataProfiles: LidarrOption[];
}> {
  const [folders, qualityProfiles, metadataProfiles] = await Promise.all([
    lidarrRequest<Array<{ id: number; path: string }>>(config, '/api/v1/rootfolder'),
    lidarrRequest<Array<{ id: number; name: string }>>(config, '/api/v1/qualityprofile'),
    lidarrRequest<Array<{ id: number; name: string }>>(config, '/api/v1/metadataprofile'),
  ]);
  return {
    rootFolders: folders.map(({ id, path }) => ({ id, name: path })),
    qualityProfiles: qualityProfiles.map(({ id, name }) => ({ id, name })),
    metadataProfiles: metadataProfiles.map(({ id, name }) => ({ id, name })),
  };
}

export async function addLidarrAlbum(
  config: LidarrConfig,
  albumLookup: LidarrAlbumLookup,
  options: { rootFolderPath: string; qualityProfileId: number; metadataProfileId: number; monitored: boolean },
): Promise<LidarrAlbumAddResult> {
  if (!albumLookup.artist?.foreignArtistId) {
    throw new Error('Lidarr did not return the album’s artist metadata. Choose another album result or add the artist in Lidarr first.');
  }

  const artists = await lidarrRequest<LidarrArtist[]>(config, '/api/v1/artist');
  let artist = artists.find(({ foreignArtistId }) => foreignArtistId === albumLookup.artist?.foreignArtistId);
  const artistName = albumLookup.artist.artistName ?? albumLookup.artist.name ?? albumLookup.artistName ?? 'Unknown artist';
  if (!artist) {
    const artistPayload = {
      ...albumLookup.artist,
      artistName,
      qualityProfileId: options.qualityProfileId,
      metadataProfileId: options.metadataProfileId,
      rootFolderPath: options.rootFolderPath,
      monitored: true,
      monitorNewItems: 'none',
      addOptions: { monitor: 'none', searchForMissingAlbums: false },
    };
    artist = await lidarrRequest<LidarrArtist>(config, '/api/v1/artist', {
      method: 'POST',
      body: JSON.stringify(artistPayload),
    });
  }

  const albums = await lidarrRequest<LidarrAlbum[]>(
    config,
    `/api/v1/album?artistId=${encodeURIComponent(String(artist.id))}`,
  );
  const existingAlbum = albums.find(({ foreignAlbumId }) => foreignAlbumId === albumLookup.foreignAlbumId);
  if (existingAlbum) {
    return {
      albumId: existingAlbum.id,
      artistName,
      albumTitle: albumLookup.title,
      alreadyAdded: true,
      monitored: existingAlbum.monitored ?? true,
    };
  }

  const addedAlbum = await lidarrRequest<LidarrAlbum>(config, '/api/v1/album', {
    method: 'POST',
    body: JSON.stringify({
      ...albumLookup,
      artistId: artist.id,
      monitored: options.monitored,
      addOptions: { searchForNewAlbum: false },
    }),
  });
  return {
    albumId: addedAlbum.id,
    artistName,
    albumTitle: albumLookup.title,
    alreadyAdded: false,
    monitored: options.monitored,
  };
}
