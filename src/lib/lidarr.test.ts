import { afterEach, describe, expect, it, vi } from 'vitest';
import { addLidarrAlbum, searchLidarrAlbums } from './lidarr';
import type { LidarrAlbumLookup } from './lidarr';

const config = { url: 'http://lidarr.example:8686/', apiKey: 'secret-key' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Lidarr album workflow', () => {
  it('searches albums by artist and album name', async () => {
    let requestUrl = '';
    let requestHeaders: Headers | undefined;
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      requestUrl = String(input);
      requestHeaders = new Headers(init?.headers);
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    });

    await expect(searchLidarrAlbums(config, 'The Artist', 'The Album')).resolves.toEqual([]);
    expect(requestUrl).toContain('/api/v1/album/lookup?term=The%20Artist%20The%20Album');
    expect(requestHeaders?.get('X-Api-Key')).toBe('secret-key');
  });

  it('adds and monitors an album for an artist already in Lidarr without searching', async () => {
    const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined;
      calls.push({ url: String(input), method, body });
      if (String(input).endsWith('/api/v1/artist')) {
        return new Response(JSON.stringify([{ id: 4, foreignArtistId: 'artist-mbid', artistName: 'The Artist' }]));
      }
      if (String(input).includes('/api/v1/album?artistId=4')) {
        return new Response('[]');
      }
      if (method === 'POST' && String(input).endsWith('/api/v1/album')) {
        return new Response(JSON.stringify({ id: 8 }));
      }
      return new Response('[]');
    });

    const result = await addLidarrAlbum(
      config,
      {
        foreignAlbumId: 'album-mbid',
        title: 'The Album',
        artist: { foreignArtistId: 'artist-mbid', artistName: 'The Artist' },
      },
      { rootFolderPath: 'D:\\Music', qualityProfileId: 2, metadataProfileId: 3, monitored: true },
    );

    expect(result).toEqual({
      albumId: 8,
      artistName: 'The Artist',
      albumTitle: 'The Album',
      alreadyAdded: false,
      monitored: true,
    });
    expect(calls.at(-1)?.body).toMatchObject({
      artistId: 4,
      monitored: true,
      addOptions: { searchForNewAlbum: false },
    });
  });

  it('adds the artist without monitoring/searching other albums when needed', async () => {
    const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined;
      calls.push({ url: String(input), method, body });
      if (String(input).endsWith('/api/v1/artist') && method === 'GET') {
        return new Response('[]');
      }
      if (String(input).endsWith('/api/v1/artist') && method === 'POST') {
        return new Response(JSON.stringify({ id: 4, foreignArtistId: 'artist-mbid', artistName: 'The Artist' }));
      }
      if (String(input).includes('/api/v1/album?artistId=4')) {
        return new Response('[]');
      }
      if (String(input).endsWith('/api/v1/album')) {
        return new Response(JSON.stringify({ id: 8 }));
      }
      return new Response('[]');
    });

    const lookup: LidarrAlbumLookup = {
      foreignAlbumId: 'album-mbid',
      title: 'The Album',
      artist: { foreignArtistId: 'artist-mbid', artistName: 'The Artist' },
    };
    await addLidarrAlbum(
      config,
      lookup,
      { rootFolderPath: 'D:\\Music', qualityProfileId: 2, metadataProfileId: 3, monitored: true },
    );

    expect(calls[1]?.body).toMatchObject({
      rootFolderPath: 'D:\\Music',
      monitored: true,
      monitorNewItems: 'none',
      addOptions: { searchForMissingAlbums: false },
    });
    expect(calls[3]?.method).toBe('POST');
  });

  it('adds an album without monitoring it or starting a search', async () => {
    let addedAlbumBody: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/artist')) {
        return new Response(JSON.stringify([{ id: 4, foreignArtistId: 'artist-mbid', artistName: 'The Artist' }]));
      }
      if (url.includes('/api/v1/album?artistId=4')) {
        return new Response('[]');
      }
      if (init?.method === 'POST' && url.endsWith('/api/v1/album')) {
        addedAlbumBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ id: 8 }));
      }
      return new Response('[]');
    });

    await expect(addLidarrAlbum(
      config,
      {
        foreignAlbumId: 'album-mbid',
        title: 'The Album',
        artist: { foreignArtistId: 'artist-mbid', artistName: 'The Artist' },
      },
      { rootFolderPath: 'D:\\Music', qualityProfileId: 2, metadataProfileId: 3, monitored: false },
    )).resolves.toMatchObject({ alreadyAdded: false, monitored: false });

    expect(addedAlbumBody).toMatchObject({
      artistId: 4,
      monitored: false,
      addOptions: { searchForNewAlbum: false },
    });
  });
});
