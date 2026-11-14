import { describe, expect, it } from 'vitest';
import {
  addPlexTracksToPlaylist,
  createPlexPlaylist,
  discoverPlexMusicLibraries,
  discoverPlexServers,
  getPlexAudioPlaylists,
  getPlexMusicLibraryTracks,
  parsePlexMusicLibraries,
  parsePlexMusicTracks,
  parsePlexResources,
} from './plex';

describe('parsePlexResources', () => {
  it('parses JSON resources with one server device', () => {
    expect(parsePlexResources(JSON.stringify({
      MediaContainer: {
        Device: {
          name: 'Living Room',
          provides: 'server',
          machineIdentifier: 'machine-1',
          Connection: { uri: 'https://plex.example:32400', local: true },
        },
      },
    }), 'application/json')).toEqual([
      {
        name: 'Living Room',
        url: 'https://plex.example:32400',
        machineIdentifier: 'machine-1',
        connectionType: 'local',
      },
    ]);
  });

  it('parses Plex XML resources and orders local, remote, and relay connections', () => {
    const xml = `<?xml version="1.0"?>
      <MediaContainer size="3">
        <Device name="Living Room" provides="server" clientIdentifier="machine-1" accessToken="server-token">
          <Connection uri="https://relay.example:443" local="0" relay="1" />
          <Connection uri="https://remote.example:32400" local="0" relay="0" />
          <Connection uri="http://192.168.1.20:32400" local="1" />
        </Device>
        <Device name="Plexamp" provides="client">
          <Connection uri="http://192.168.1.20:32400" local="1" />
        </Device>
      </MediaContainer>`;

    expect(parsePlexResources(xml, 'application/xml')).toEqual([
      {
        name: 'Living Room',
        url: 'http://192.168.1.20:32400',
        accessToken: 'server-token',
        machineIdentifier: 'machine-1',
        connectionType: 'local',
      },
      {
        name: 'Living Room',
        url: 'https://remote.example:32400',
        accessToken: 'server-token',
        machineIdentifier: 'machine-1',
        connectionType: 'remote',
      },
      {
        name: 'Living Room',
        url: 'https://relay.example:443',
        accessToken: 'server-token',
        machineIdentifier: 'machine-1',
        connectionType: 'relay',
      },
    ]);
  });

  it('reports an actionable error for non-JSON and non-XML responses', () => {
    expect(() => parsePlexResources('unexpected response', 'text/html'))
      .toThrow('Plex server discovery returned an unsupported response (text/html); expected JSON or XML.');
    expect(() => parsePlexResources('<html></html>', 'text/html'))
      .toThrow('Plex server discovery response did not contain a MediaContainer.');
  });
});

describe('discoverPlexServers', () => {
  it('loads Plex servers from an XML resources response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      '<MediaContainer><Device name="Music Server" provides="server" clientIdentifier="music-id"><Connection uri="https://music.example:32400" local="1"/></Device></MediaContainer>',
      { headers: { 'Content-Type': 'application/json' } },
    );

    try {
      await expect(discoverPlexServers('account-token')).resolves.toEqual([
        {
          name: 'Music Server',
          url: 'https://music.example:32400',
          machineIdentifier: 'music-id',
          connectionType: 'local',
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Plex music library parsing', () => {
  it('parses music sections from XML and ignores non-music sections', () => {
    const xml = '<MediaContainer><Directory key="1" title="Music" type="artist"/><Directory key="2" title="Movies" type="movie"/></MediaContainer>';
    expect(parsePlexMusicLibraries(xml, 'application/xml')).toEqual([{ key: '1', name: 'Music' }]);
  });

  it('parses music sections from JSON', () => {
    const json = JSON.stringify({
      MediaContainer: {
        Directory: [
          { key: 1, title: 'Music', type: 'artist' },
          { key: 2, title: 'Films', type: 'movie' },
        ],
      },
    });
    expect(parsePlexMusicLibraries(json, 'application/json')).toEqual([{ key: '1', name: 'Music' }]);
  });

  it('converts Plex XML tracks to matcher metadata', () => {
    const xml = '<MediaContainer><Track ratingKey="42" title="Song" grandparentTitle="Artist" parentTitle="Album" duration="180000"/></MediaContainer>';
    expect(parsePlexMusicTracks(xml, '1', 'application/xml')).toEqual([{
      id: '42',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      albumArtist: 'Artist',
      durationMs: 180000,
      ratingKey: '42',
      libraryId: '1',
    }]);
  });

  it('uses track-level artist metadata for compilation tracks', () => {
    const xml = '<MediaContainer><Track ratingKey="42" title="Paparazzi" grandparentTitle="Various Artists" artist="Xzibit" parentTitle="Tony Hawk’s Pro Skater 3"/></MediaContainer>';
    expect(parsePlexMusicTracks(xml, '1', 'application/xml')).toEqual([{
      id: '42',
      title: 'Paparazzi',
      artist: 'Xzibit',
      album: 'Tony Hawk’s Pro Skater 3',
      albumArtist: 'Various Artists',
      durationMs: 0,
      ratingKey: '42',
      libraryId: '1',
    }]);
  });

  it('loads libraries and tracks from the selected Plex server', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    globalThis.fetch = async (input) => {
      requestedUrls.push(String(input));
      if (String(input).includes('/library/sections?')) {
        return new Response('<MediaContainer><Directory key="1" title="Music" type="artist"/></MediaContainer>', {
          headers: { 'Content-Type': 'application/xml' },
        });
      }
      return new Response('<MediaContainer><Track ratingKey="42" title="Song" grandparentTitle="Artist"/></MediaContainer>', {
        headers: { 'Content-Type': 'application/xml' },
      });
    };

    try {
      await expect(discoverPlexMusicLibraries('https://plex.example:32400/', 'server-token'))
        .resolves.toEqual([{ key: '1', name: 'Music' }]);
      await expect(getPlexMusicLibraryTracks('https://plex.example:32400', 'server-token', '1'))
        .resolves.toHaveLength(1);
      expect(requestedUrls[0]).toContain('/library/sections?');
      expect(requestedUrls[0]).toContain('X-Plex-Token=server-token');
      expect(requestedUrls[1]).toContain('/library/sections/1/all?');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('creates a Plex playlist and appends the remaining matched tracks', async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; method: string }> = [];
    globalThis.fetch = async (input, init) => {
      requests.push({ url: String(input), method: init?.method ?? 'GET' });
      if (init?.method === 'POST') {
        return new Response(
          '<MediaContainer><Playlist ratingKey="plex-playlist-1" title="My soundtrack"/></MediaContainer>',
          { headers: { 'Content-Type': 'application/xml' } },
        );
      }
      return new Response('<MediaContainer/>', { headers: { 'Content-Type': 'application/xml' } });
    };

    try {
      await expect(createPlexPlaylist(
        'https://plex.example:32400',
        'server-token',
        'machine-1',
        'My soundtrack',
        [
          { id: '1', ratingKey: 'track-1', title: 'One', artist: 'Artist', album: 'Album', albumArtist: 'Artist', durationMs: 1, libraryId: 'music' },
          { id: '2', ratingKey: 'track-2', title: 'Two', artist: 'Artist', album: 'Album', albumArtist: 'Artist', durationMs: 1, libraryId: 'music' },
        ],
      )).resolves.toEqual({ id: 'plex-playlist-1', name: 'My soundtrack' });
      expect(requests).toHaveLength(3);
      expect(requests[0].method).toBe('POST');
      expect(requests[0].url).toContain('/playlists?');
      const createUrl = new URL(requests[0].url);
      expect(createUrl.searchParams.get('title')).toBe('My soundtrack');
      expect(createUrl.searchParams.get('uri')).toContain('track-1');
      expect(requests[1].method).toBe('GET');
      expect(requests[2].method).toBe('PUT');
      expect(requests[2].url).toContain('/playlists/plex-playlist-1/items?');
      expect(new URL(requests[2].url).searchParams.get('uri')).toContain('track-2');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('lists existing Plex audio playlists', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      '<MediaContainer><Metadata type="playlist" ratingKey="7" title="Road Mix" playlistType="audio"/><Metadata type="playlist" ratingKey="8" title="Video Mix" playlistType="video"/></MediaContainer>',
      { headers: { 'Content-Type': 'application/xml' } },
    );
    try {
      await expect(getPlexAudioPlaylists('https://plex.example:32400', 'server-token'))
        .resolves.toEqual([
          { id: '7', name: 'Road Mix' },
        ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('adds only tracks not already in an existing playlist', async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; method: string }> = [];
    globalThis.fetch = async (input, init) => {
      const method = init?.method ?? 'GET';
      requests.push({ url: String(input), method });
      if (method === 'GET') {
        return new Response('<MediaContainer><Track ratingKey="track-1"/></MediaContainer>', {
          headers: { 'Content-Type': 'application/xml' },
        });
      }
      return new Response('<MediaContainer/>', { headers: { 'Content-Type': 'application/xml' } });
    };
    try {
      await expect(addPlexTracksToPlaylist(
        'https://plex.example:32400',
        'server-token',
        'machine-1',
        'playlist-1',
        [
          { id: 'track-1', ratingKey: 'track-1', title: 'One', artist: 'Artist', album: 'Album', albumArtist: 'Artist', durationMs: 1, libraryId: 'music' },
          { id: 'track-2', ratingKey: 'track-2', title: 'Two', artist: 'Artist', album: 'Album', albumArtist: 'Artist', durationMs: 1, libraryId: 'music' },
        ],
      )).resolves.toEqual({ addedCount: 1, alreadyPresentCount: 1 });
      expect(requests).toHaveLength(2);
      expect(requests[0].method).toBe('GET');
      expect(requests[1].method).toBe('PUT');
      expect(new URL(requests[1].url).searchParams.get('uri')).toContain('track-2');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
