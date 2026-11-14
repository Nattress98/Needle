import { describe, expect, it } from 'vitest';
import {
  createImportedPlaylist,
  extractSpotifyPlaylistId,
  parsePublicPlaylistTitle,
  parsePublicPlaylistText,
} from './spotifyPublicPlaylist';

describe('extractSpotifyPlaylistId', () => {
  it('accepts public playlist and embed links', () => {
    expect(extractSpotifyPlaylistId('https://open.spotify.com/playlist/0CI4vmPgomYc7UrF4pBHJP?si=abc'))
      .toBe('0CI4vmPgomYc7UrF4pBHJP');
    expect(extractSpotifyPlaylistId('https://open.spotify.com/embed/playlist/0CI4vmPgomYc7UrF4pBHJP'))
      .toBe('0CI4vmPgomYc7UrF4pBHJP');
    expect(extractSpotifyPlaylistId('spotify:playlist:0CI4vmPgomYc7UrF4pBHJP'))
      .toBe('0CI4vmPgomYc7UrF4pBHJP');
  });

  it('rejects non-Spotify and non-playlist URLs', () => {
    expect(extractSpotifyPlaylistId('https://example.com/playlist/abc')).toBeNull();
    expect(extractSpotifyPlaylistId('https://open.spotify.com/track/abc')).toBeNull();
    expect(extractSpotifyPlaylistId('not a link')).toBeNull();
  });
});

describe('parsePublicPlaylistTitle', () => {
  it('reads the playlist title from public page-reader text', () => {
    expect(parsePublicPlaylistTitle('Title: Best of Tony Hawks Soundtrack - playlist-owner'))
      .toBe('Best of Tony Hawks Soundtrack - playlist-owner');
  });
});

describe('parsePublicPlaylistText', () => {
  it('parses ordered tracks from Spotify Reader markdown', () => {
    const tracks = parsePublicPlaylistText(
      `Title: Example playlist

1. ### Superman

#### Goldfinger

03:05

2. ### Guerrilla Radio

#### E Rage Against The Machine

03:26`,
      'playlist-id',
    );

    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({
      name: 'Superman',
      artists: ['Goldfinger'],
      durationMs: 185000,
      position: 1,
    });
    expect(tracks[1]).toMatchObject({
      name: 'Guerrilla Radio',
      artists: ['Rage Against The Machine'],
      durationMs: 206000,
      position: 2,
    });
  });

  it('skips incomplete entries rather than inventing metadata', () => {
    expect(parsePublicPlaylistText('1. ### Title only\n\n02:30', 'playlist-id')).toEqual([]);
  });

  it('reads an unnumbered leading title and artist before the first numbered track', () => {
    const tracks = parsePublicPlaylistText(
      `### Misfits,Glenn Danzig

02:43

69. ### Liberate
#### E Disturbed
03:26`,
      'playlist-id',
    );

    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({
      name: 'Misfits',
      artists: ['Glenn Danzig'],
      durationMs: 163000,
      position: 68,
    });
    expect(tracks[1]).toMatchObject({
      name: 'Liberate',
      artists: ['Disturbed'],
      position: 69,
    });
  });
});

describe('createImportedPlaylist', () => {
  it('updates the count and preserves the existing sync mapping state', () => {
    const playlist = createImportedPlaylist(
      { id: 'id', name: 'Updated name' },
      parsePublicPlaylistText('1. ### Song\n#### Artist\n03:00', 'id'),
      {
        id: 'id',
        name: 'Old name',
        owner: 'Existing owner',
        trackCount: 1,
        isSynced: true,
        lastSyncedAt: '2026-01-01T00:00:00Z',
      },
    );

    expect(playlist).toMatchObject({
      name: 'Updated name',
      trackCount: 1,
      owner: 'Existing owner',
      isSynced: true,
      lastSyncedAt: '2026-01-01T00:00:00Z',
    });
  });
});
