import type { PlexTrack } from './types';

export interface PlexPinResponse {
  id: string;
  code: string;
  product: string;
  qr: string;
}

export interface PlexServer {
  name: string;
  url: string;
  accessToken?: string;
  machineIdentifier?: string;
}

export interface PlexMusicLibrary {
  key: string;
  name: string;
}

export interface PlexCreatedPlaylist {
  id: string;
  name: string;
}

export type PlexAudioPlaylist = PlexCreatedPlaylist;

export interface PlexPlaylistUpdate {
  addedCount: number;
  alreadyPresentCount: number;
}

export const PLEX_CLIENT_ID = 'spotify-plex-sync-app';
export const PLEX_PRODUCT = 'Spotify to Plex Sync';

function getPlexClientHeaders(): Headers {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('X-Plex-Product', PLEX_PRODUCT);
  headers.set('X-Plex-Client-Identifier', PLEX_CLIENT_ID);
  return headers;
}

async function plexRequestError(response: Response, action: string): Promise<Error> {
  const details = (await response.text()).trim().slice(0, 300);
  return new Error(
    `${action} failed: ${response.status}${details ? ` — ${details}` : ''}`,
  );
}

export function getPlexAuthHeaders(token: string): Headers {
  const headers = getPlexClientHeaders();
  headers.set('X-Plex-Token', token);
  return headers;
}

export async function createPlexPin(): Promise<PlexPinResponse> {
  const response = await fetch('https://plex.tv/api/v2/pins?strong=true', {
    method: 'POST',
    headers: getPlexClientHeaders(),
  });

  if (!response.ok) {
    throw await plexRequestError(response, 'Plex PIN creation');
  }

  const payload = (await response.json()) as { id?: number | string; code?: string; product?: string; qr?: string };

  return {
    id: payload.id === undefined ? '' : String(payload.id),
    code: payload.code ?? '',
    product: payload.product ?? PLEX_PRODUCT,
    qr: payload.qr ?? '',
  };
}

export function getPlexAuthorizationUrl(pin: PlexPinResponse): string {
  const context = new URLSearchParams({
    clientID: PLEX_CLIENT_ID,
    code: pin.code,
    'context[device][product]': PLEX_PRODUCT,
    'context[device][version]': '1.0',
    'context[device][platform]': 'Web',
    'context[device][device]': 'Browser',
  });
  return `https://app.plex.tv/auth#?${context.toString()}`;
}

interface PlexResourceConnection {
  uri?: string;
  local?: boolean | string | number;
}

interface PlexResourceDevice {
  name?: string;
  machineIdentifier?: string;
  provides?: string;
  accessToken?: string;
  Connection?: PlexResourceConnection[] | PlexResourceConnection;
}

interface PlexLibraryEntry {
  key?: string | number;
  title?: string;
  type?: string;
}

interface PlexTrackEntry {
  ratingKey?: string | number;
  title?: string;
  grandparentTitle?: string;
  artist?: string;
  artistName?: string;
  trackArtist?: string;
  parentTitle?: string;
  duration?: string | number;
}

function isLocalConnection(connection: PlexResourceConnection): boolean {
  return connection.local === true || connection.local === 1 || connection.local === '1';
}

function parsePlexResourceJson(text: string): PlexResourceDevice[] {
  let payload: {
    MediaContainer?: {
      Device?: PlexResourceDevice[] | PlexResourceDevice;
    };
  };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    throw new Error('Plex server discovery returned invalid JSON.');
  }

  const devices = payload.MediaContainer?.Device;
  if (!devices) {
    throw new Error('Plex server discovery response did not contain a device list.');
  }
  return Array.isArray(devices) ? devices : [devices];
}

function parsePlexResourceXml(text: string): PlexResourceDevice[] {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Plex server discovery returned invalid XML.');
  }

  const mediaContainer = document.querySelector('MediaContainer');
  if (!mediaContainer) {
    throw new Error('Plex server discovery response did not contain a MediaContainer.');
  }

  return Array.from(mediaContainer.querySelectorAll(':scope > Device')).map((device) => ({
    name: device.getAttribute('name') ?? undefined,
    machineIdentifier: device.getAttribute('clientIdentifier') ?? undefined,
    provides: device.getAttribute('provides') ?? undefined,
    accessToken: device.getAttribute('accessToken') ?? undefined,
    Connection: Array.from(device.querySelectorAll(':scope > Connection')).map((connection) => ({
      uri: connection.getAttribute('uri') ?? undefined,
      local: connection.getAttribute('local') ?? undefined,
    })),
  }));
}

function parsePlexLibraries(text: string, contentType: string): PlexLibraryEntry[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || contentType.includes('json')) {
    let payload: { MediaContainer?: { Directory?: PlexLibraryEntry[] | PlexLibraryEntry } };
    try {
      payload = JSON.parse(trimmed) as typeof payload;
    } catch {
      throw new Error('Plex music library response returned invalid JSON.');
    }
    const directories = payload.MediaContainer?.Directory;
    return directories ? Array.isArray(directories) ? directories : [directories] : [];
  }
  if (!trimmed.startsWith('<') && !contentType.includes('xml')) {
    throw new Error('Plex music library response was not JSON or XML.');
  }
  const document = new DOMParser().parseFromString(trimmed, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Plex music library response returned invalid XML.');
  }
  return Array.from(document.querySelectorAll('MediaContainer > Directory')).map((directory) => ({
    key: directory.getAttribute('key') ?? undefined,
    title: directory.getAttribute('title') ?? undefined,
    type: directory.getAttribute('type') ?? undefined,
  }));
}

function parsePlexTrackEntries(text: string, contentType: string): PlexTrackEntry[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || contentType.includes('json')) {
    let payload: { MediaContainer?: { Metadata?: PlexTrackEntry[] | PlexTrackEntry } };
    try {
      payload = JSON.parse(trimmed) as typeof payload;
    } catch {
      throw new Error('Plex music tracks response returned invalid JSON.');
    }
    const metadata = payload.MediaContainer?.Metadata;
    return metadata ? Array.isArray(metadata) ? metadata : [metadata] : [];
  }
  if (!trimmed.startsWith('<') && !contentType.includes('xml')) {
    throw new Error('Plex music tracks response was not JSON or XML.');
  }
  const document = new DOMParser().parseFromString(trimmed, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Plex music tracks response returned invalid XML.');
  }
  return Array.from(document.querySelectorAll('MediaContainer > Track')).map((track) => ({
    ratingKey: track.getAttribute('ratingKey') ?? undefined,
    title: track.getAttribute('title') ?? undefined,
    grandparentTitle: track.getAttribute('grandparentTitle') ?? undefined,
    artist: track.getAttribute('artist') ?? undefined,
    artistName: track.getAttribute('artistName') ?? undefined,
    trackArtist: track.getAttribute('trackArtist') ?? undefined,
    parentTitle: track.getAttribute('parentTitle') ?? undefined,
    duration: track.getAttribute('duration') ?? undefined,
  }));
}

function getPlexTrackTotalSize(text: string, contentType: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || contentType.includes('json')) {
    const payload = JSON.parse(trimmed) as { MediaContainer?: { totalSize?: number | string } };
    const total = Number(payload.MediaContainer?.totalSize);
    return Number.isFinite(total) ? total : undefined;
  }
  const document = new DOMParser().parseFromString(trimmed, 'application/xml');
  const totalSize = document.querySelector('MediaContainer')?.getAttribute('totalSize');
  if (totalSize === null || totalSize === undefined) {
    return undefined;
  }
  const total = Number(totalSize);
  return Number.isFinite(total) ? total : undefined;
}

export function parsePlexMusicLibraries(text: string, contentType = ''): PlexMusicLibrary[] {
  return parsePlexLibraries(text, contentType)
    .filter((entry) => entry.key !== undefined && entry.title && ['artist', 'music'].includes(entry.type ?? ''))
    .map((entry) => ({ key: String(entry.key), name: entry.title ?? 'Music' }));
}

export function parsePlexMusicTracks(
  text: string,
  libraryKey: string,
  contentType = '',
): PlexTrack[] {
  return parsePlexTrackEntries(text, contentType).flatMap((entry) => {
    const artist = entry.trackArtist ?? entry.artistName ?? entry.artist ?? entry.grandparentTitle;
    if (entry.ratingKey === undefined || !entry.title || !artist) {
      return [];
    }
    const durationMs = Number(entry.duration ?? 0);
    return [{
      id: String(entry.ratingKey),
      title: entry.title,
      artist,
      album: entry.parentTitle ?? '',
      albumArtist: entry.grandparentTitle ?? artist,
      durationMs: Number.isFinite(durationMs) ? durationMs : 0,
      ratingKey: String(entry.ratingKey),
      libraryId: libraryKey,
    }];
  });
}

function toPlexServers(devices: PlexResourceDevice[]): PlexServer[] {
  return devices.flatMap((device) => {
    if (!device.provides?.split(',').includes('server')) {
      return [];
    }

    const connections = device.Connection
      ? Array.isArray(device.Connection) ? device.Connection : [device.Connection]
      : [];
    const connection = connections
      .filter((candidate) => Boolean(candidate.uri))
      .sort((left, right) => Number(isLocalConnection(right)) - Number(isLocalConnection(left)))[0];
    if (!connection?.uri) {
      return [];
    }

    return [{
      name: device.name ?? 'Unknown server',
      url: connection.uri.replace(/\/+$/, ''),
      accessToken: device.accessToken,
      machineIdentifier: device.machineIdentifier,
    }];
  });
}

export function parsePlexResources(text: string, contentType = ''): PlexServer[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return toPlexServers(parsePlexResourceJson(trimmed));
  }
  if (trimmed.startsWith('<')) {
    return toPlexServers(parsePlexResourceXml(trimmed));
  }
  if (contentType.includes('json')) {
    return toPlexServers(parsePlexResourceJson(trimmed));
  }
  if (contentType.includes('xml')) {
    return toPlexServers(parsePlexResourceXml(trimmed));
  }
  throw new Error(
    `Plex server discovery returned an unsupported response${contentType ? ` (${contentType})` : ''}; expected JSON or XML.`,
  );
}

export async function pollPlexAuth(pin: Pick<PlexPinResponse, 'id' | 'code'>): Promise<{ user: string; authToken?: string }> {
  const response = await fetch(`https://plex.tv/api/v2/pins/${encodeURIComponent(pin.id)}?code=${encodeURIComponent(pin.code)}`, {
    method: 'GET',
    headers: getPlexClientHeaders(),
  });

  if (!response.ok) {
    throw await plexRequestError(response, 'Plex auth check');
  }

  const payload = (await response.json()) as { authToken?: string; user?: { username?: string } };

  return {
    user: payload.user?.username ?? 'Connected user',
    ...(payload.authToken ? { authToken: payload.authToken } : {}),
  };
}

export async function discoverPlexServers(token: string): Promise<PlexServer[]> {
  const response = await fetch(`https://plex.tv/api/resources?includeHttps=1&includeRelay=1&X-Plex-Token=${encodeURIComponent(token)}`, {
    headers: getPlexClientHeaders(),
  });

  if (!response.ok) {
    throw await plexRequestError(response, 'Plex resource discovery');
  }

  const body = await response.text();
  return parsePlexResources(body, response.headers.get('content-type') ?? '');
}

async function fetchPlexXmlOrJson(
  url: string,
  action: string,
  init: RequestInit = {},
): Promise<{ text: string; contentType: string }> {
  let response: Response;
  try {
    const headers = new Headers({ Accept: 'application/json' });
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`${action} could not reach the Plex server. Check that it is online and allows browser cross-origin access.`);
    }
    throw error;
  }
  if (!response.ok) {
    throw await plexRequestError(response, action);
  }
  return {
    text: await response.text(),
    contentType: response.headers.get('content-type') ?? '',
  };
}

export async function discoverPlexMusicLibraries(
  serverUrl: string,
  token: string,
): Promise<PlexMusicLibrary[]> {
  const query = new URLSearchParams({ 'X-Plex-Token': token });
  const response = await fetchPlexXmlOrJson(
    `${serverUrl.replace(/\/+$/, '')}/library/sections?${query.toString()}`,
    'Plex music library discovery',
  );
  return parsePlexMusicLibraries(response.text, response.contentType);
}

export async function getPlexMusicLibraryTracks(
  serverUrl: string,
  token: string,
  libraryKey: string,
): Promise<PlexTrack[]> {
  const pageSize = 1000;
  const allTracks: PlexTrack[] = [];
  let start = 0;
  while (true) {
    const query = new URLSearchParams({
      type: '10',
      includeGuids: '1',
      'X-Plex-Container-Start': String(start),
      'X-Plex-Container-Size': String(pageSize),
      'X-Plex-Token': token,
    });
    const response = await fetchPlexXmlOrJson(
      `${serverUrl.replace(/\/+$/, '')}/library/sections/${encodeURIComponent(libraryKey)}/all?${query.toString()}`,
      'Plex music track loading',
    );
    const pageTracks = parsePlexMusicTracks(response.text, libraryKey, response.contentType);
    allTracks.push(...pageTracks);
    const totalSize = getPlexTrackTotalSize(response.text, response.contentType);
    if (
      pageTracks.length === 0 ||
      (totalSize !== undefined && allTracks.length >= totalSize) ||
      pageTracks.length < pageSize
    ) {
      return allTracks;
    }
    start += pageTracks.length;
  }
}

function parseCreatedPlexPlaylist(text: string, contentType: string): PlexCreatedPlaylist {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || contentType.includes('json')) {
    let payload: {
      MediaContainer?: {
        Metadata?: Array<{ ratingKey?: string | number; title?: string }> | { ratingKey?: string | number; title?: string };
        Playlist?: Array<{ ratingKey?: string | number; title?: string }> | { ratingKey?: string | number; title?: string };
      };
    };
    try {
      payload = JSON.parse(trimmed) as typeof payload;
    } catch {
      throw new Error('Plex created the playlist but returned invalid JSON.');
    }
    const entries = payload.MediaContainer?.Metadata ?? payload.MediaContainer?.Playlist;
    const playlist = Array.isArray(entries) ? entries[0] : entries;
    if (playlist?.ratingKey !== undefined) {
      return { id: String(playlist.ratingKey), name: playlist.title ?? 'Plex playlist' };
    }
  } else if (trimmed.startsWith('<') || contentType.includes('xml')) {
    const document = new DOMParser().parseFromString(trimmed, 'application/xml');
    if (document.querySelector('parsererror')) {
      throw new Error('Plex created the playlist but returned invalid XML.');
    }
    const playlist = document.querySelector('MediaContainer > Playlist, MediaContainer > Metadata');
    const ratingKey = playlist?.getAttribute('ratingKey');
    if (ratingKey) {
      return { id: ratingKey, name: playlist?.getAttribute('title') ?? 'Plex playlist' };
    }
  }
  throw new Error('Plex created the playlist but did not return its playlist ID.');
}

function parsePlexAudioPlaylists(text: string, contentType: string): PlexAudioPlaylist[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || contentType.includes('json')) {
    let payload: {
      MediaContainer?: {
        Playlist?: PlexPlaylistEntry[] | PlexPlaylistEntry;
        Metadata?: PlexPlaylistEntry[] | PlexPlaylistEntry;
      };
    };
    try {
      payload = JSON.parse(trimmed) as typeof payload;
    } catch {
      throw new Error('Plex playlist list returned invalid JSON.');
    }
    const playlists = payload.MediaContainer?.Playlist ?? payload.MediaContainer?.Metadata;
    return (playlists ? Array.isArray(playlists) ? playlists : [playlists] : [])
      .filter(isAudioPlaylistEntry)
      .map((playlist) => ({ id: String(playlist.ratingKey), name: playlist.title ?? 'Plex playlist' }));
  }
  if (!trimmed.startsWith('<') && !contentType.includes('xml')) {
    throw new Error('Plex playlist list was not JSON or XML.');
  }
  const document = new DOMParser().parseFromString(trimmed, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Plex playlist list returned invalid XML.');
  }
  return Array.from(document.querySelectorAll('MediaContainer > Playlist, MediaContainer > Metadata'))
    .map((playlist) => ({
      ratingKey: playlist.getAttribute('ratingKey') ?? undefined,
      title: playlist.getAttribute('title') ?? undefined,
      type: playlist.getAttribute('type') ?? undefined,
      playlistType: playlist.getAttribute('playlistType') ?? undefined,
    }))
    .filter(isAudioPlaylistEntry)
    .map((playlist) => ({ id: String(playlist.ratingKey), name: playlist.title ?? 'Plex playlist' }));
}

interface PlexPlaylistEntry {
  ratingKey?: number | string;
  title?: string;
  type?: string;
  playlistType?: string;
}

function isAudioPlaylistEntry(playlist: PlexPlaylistEntry): boolean {
  return playlist.ratingKey !== undefined &&
    Boolean(playlist.title) &&
    (playlist.type === undefined || playlist.type === 'playlist' || playlist.type === 'audio') &&
    (playlist.playlistType === undefined || playlist.playlistType === 'audio');
}

function parsePlexPlaylistTrackIds(text: string, contentType: string): Set<string> {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || contentType.includes('json')) {
    let payload: {
      MediaContainer?: {
        Metadata?: Array<{ ratingKey?: string | number }> | { ratingKey?: string | number };
      };
    };
    try {
      payload = JSON.parse(trimmed) as typeof payload;
    } catch {
      throw new Error('Plex playlist tracks returned invalid JSON.');
    }
    const entries = payload.MediaContainer?.Metadata;
    const metadata = entries ? Array.isArray(entries) ? entries : [entries] : [];
    return new Set(metadata.flatMap((entry) => entry.ratingKey === undefined ? [] : [String(entry.ratingKey)]));
  }
  if (!trimmed.startsWith('<') && !contentType.includes('xml')) {
    throw new Error('Plex playlist tracks were not JSON or XML.');
  }
  const document = new DOMParser().parseFromString(trimmed, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Plex playlist tracks returned invalid XML.');
  }
  return new Set(Array.from(document.querySelectorAll('MediaContainer > Track'))
    .map((track) => track.getAttribute('ratingKey'))
    .filter((ratingKey): ratingKey is string => ratingKey !== null));
}

export async function getPlexAudioPlaylists(serverUrl: string, token: string): Promise<PlexAudioPlaylist[]> {
  const query = new URLSearchParams({ playlistType: 'audio', 'X-Plex-Token': token });
  const response = await fetchPlexXmlOrJson(
    `${serverUrl.replace(/\/+$/, '')}/playlists?${query.toString()}`,
    'Plex playlist discovery',
  );
  return parsePlexAudioPlaylists(response.text, response.contentType);
}

export async function addPlexTracksToPlaylist(
  serverUrl: string,
  token: string,
  machineIdentifier: string,
  playlistId: string,
  tracks: PlexTrack[],
): Promise<PlexPlaylistUpdate> {
  if (!machineIdentifier) {
    throw new Error('The selected Plex server did not provide a machine identifier. Refresh servers and select it again.');
  }
  const baseUrl = serverUrl.replace(/\/+$/, '');
  const query = new URLSearchParams({ 'X-Plex-Token': token });
  const currentResponse = await fetchPlexXmlOrJson(
    `${baseUrl}/playlists/${encodeURIComponent(playlistId)}/items?${query.toString()}`,
    'Plex playlist track loading',
  );
  const existingRatingKeys = parsePlexPlaylistTrackIds(currentResponse.text, currentResponse.contentType);
  const additions = tracks.filter((track) => !existingRatingKeys.has(track.ratingKey));
  if (additions.length === 0) {
    return { addedCount: 0, alreadyPresentCount: tracks.length };
  }

  const serverUri = `server://${machineIdentifier}/com.plexapp.plugins.library/library/metadata/`;
  let addedCount = 0;
  for (const track of additions) {
    const addQuery = new URLSearchParams({
      uri: `${serverUri}${encodeURIComponent(track.ratingKey)}`,
      'X-Plex-Token': token,
    });
    try {
      await fetchPlexXmlOrJson(
        `${baseUrl}/playlists/${encodeURIComponent(playlistId)}/items?${addQuery.toString()}`,
        'Adding a track to the Plex playlist',
        { method: 'PUT' },
      );
      addedCount += 1;
    } catch (error) {
      throw new Error(
        `Plex playlist (ID ${playlistId}) was updated with ${addedCount} of ${additions.length} new tracks. ${error instanceof Error ? error.message : 'Unknown Plex error.'}`,
      );
    }
  }
  return { addedCount, alreadyPresentCount: tracks.length - additions.length };
}

export async function createPlexPlaylist(
  serverUrl: string,
  token: string,
  machineIdentifier: string,
  playlistName: string,
  tracks: PlexTrack[],
): Promise<PlexCreatedPlaylist> {
  if (tracks.length === 0) {
    throw new Error('No matched tracks are available to add to a Plex playlist.');
  }
  if (!machineIdentifier) {
    throw new Error('The selected Plex server did not provide a machine identifier. Refresh servers and select it again.');
  }

  const baseUrl = serverUrl.replace(/\/+$/, '');
  const serverUri = `server://${machineIdentifier}/com.plexapp.plugins.library/library/metadata/`;
  const firstTrackUri = `${serverUri}${encodeURIComponent(tracks[0].ratingKey)}`;
  const createQuery = new URLSearchParams({
    type: 'audio',
    title: playlistName,
    smart: '0',
    uri: firstTrackUri,
    'X-Plex-Token': token,
  });
  const createResponse = await fetchPlexXmlOrJson(
    `${baseUrl}/playlists?${createQuery.toString()}`,
    'Plex playlist creation',
    { method: 'POST' },
  );
  const playlist = parseCreatedPlexPlaylist(createResponse.text, createResponse.contentType);
  await addPlexTracksToPlaylist(serverUrl, token, machineIdentifier, playlist.id, tracks.slice(1));
  return playlist;
}
