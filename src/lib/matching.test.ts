import { describe, expect, it } from 'vitest';
import { matchSpotifyToPlex, normaliseText } from './matching';
import type { PlexTrack, SpotifyTrack } from './types';

const spotifyTrack = (overrides: Partial<SpotifyTrack> = {}): SpotifyTrack => ({
  id: 'track-1',
  name: 'Bohemian Rhapsody',
  artists: ['Queen'],
  album: 'A Night at the Opera',
  durationMs: 360000,
  position: 1,
  ...overrides,
});

const plexTrack = (overrides: Partial<PlexTrack> = {}): PlexTrack => ({
  id: 'plex-1',
  title: 'Bohemian Rhapsody',
  artist: 'Queen',
  album: 'A Night at the Opera',
  albumArtist: 'Queen',
  durationMs: 360000,
  ratingKey: 'r-1',
  libraryId: 'lib-1',
  ...overrides,
});

describe('normaliseText', () => {
  it('removes accents, punctuation and featured artist markers', () => {
    expect(normaliseText('Björk - feat. Jasmin & Kimbra')).toBe('bjork jasmin kimbra');
    expect(normaliseText('  C’est la vie!  ')).toBe('cest la vie');
  });
});

describe('matchSpotifyToPlex', () => {
  it('matches exact metadata with high confidence', () => {
    const summary = matchSpotifyToPlex([spotifyTrack()], [plexTrack()]);

    expect(summary.matched).toHaveLength(1);
    expect(summary.matched[0]?.confidence).toBe('high');
    expect(summary.missingSpotify).toHaveLength(0);
  });

  it('handles fuzzy normalization with minor spelling differences', () => {
    const summary = matchSpotifyToPlex(
      [spotifyTrack({ name: 'Bohemien Rhapsody', artists: ['Quee n'] })],
      [plexTrack({ title: 'Bohemian Rhapsody', artist: 'Queen' })],
    );

    expect(summary.matched).toHaveLength(1);
    expect(summary.matched[0]?.confidence).toBe('high');
  });

  it('rejects an exact title when the artist is different', () => {
    const summary = matchSpotifyToPlex(
      [spotifyTrack({ name: 'You', artists: ['Bad Religion'], album: 'Recipe for Hate' })],
      [plexTrack({ title: 'You', artist: 'Radiohead', albumArtist: 'Radiohead', album: 'The Bends' })],
    );

    expect(summary.matched).toHaveLength(0);
    expect(summary.missingSpotify).toHaveLength(1);
  });

  it('rejects a close title when the artist is different', () => {
    const summary = matchSpotifyToPlex(
      [spotifyTrack({ name: 'Paparazzi', artists: ['Xzibit'] })],
      [plexTrack({ title: 'Paparazzi', artist: 'Lady Gaga', albumArtist: 'Lady Gaga' })],
    );

    expect(summary.matched).toHaveLength(0);
    expect(summary.missingSpotify).toHaveLength(1);
  });

  it('matches compilation tracks with exact titles and close durations when Plex only exposes Various Artists', () => {
    const spotifyTracks = [
      spotifyTrack({ id: 'paparazzi', name: 'Paparazzi', artists: ['Xzibit'], durationMs: 180000 }),
      spotifyTrack({ id: 'check', name: 'Check', artists: ['zebrahead'], durationMs: 360000 }),
    ];
    const plexTracks = [
      plexTrack({
        id: 'plex-paparazzi',
        title: 'Paparazzi',
        artist: 'Various Artists',
        albumArtist: 'Various Artists',
        album: 'Tony Hawk’s Pro Skater 3',
        durationMs: 180000,
      }),
      plexTrack({
        id: 'plex-check',
        title: 'Check',
        artist: 'Various Artists',
        albumArtist: 'Various Artists',
        album: 'Tony Hawk’s Pro Skater 3',
        durationMs: 360000,
      }),
    ];

    const summary = matchSpotifyToPlex(spotifyTracks, plexTracks);

    expect(summary.matched.map(({ plex: matchedTrack }) => matchedTrack.id)).toEqual([
      'plex-paparazzi',
      'plex-check',
    ]);
    expect(summary.matched.map(({ confidence }) => confidence)).toEqual(['medium', 'medium']);
    expect(summary.missingSpotify).toHaveLength(0);
  });

  it('requires a close duration for a compilation fallback match', () => {
    const summary = matchSpotifyToPlex(
      [spotifyTrack({ name: 'Paparazzi', artists: ['Xzibit'], durationMs: 180000 })],
      [plexTrack({
        title: 'Paparazzi',
        artist: 'Various Artists',
        albumArtist: 'Various Artists',
        durationMs: 240000,
      })],
    );

    expect(summary.matched).toHaveLength(0);
    expect(summary.missingSpotify).toHaveLength(1);
  });

  it('flags duplicate title and duration matches on compilations for review', () => {
    const spotify = spotifyTrack({ name: 'Paparazzi', artists: ['Xzibit'], durationMs: 180000 });
    const candidate = plexTrack({
      title: 'Paparazzi',
      artist: 'Various Artists',
      albumArtist: 'Various Artists',
      durationMs: 180000,
    });
    const summary = matchSpotifyToPlex([spotify], [
      candidate,
      plexTrack({ ...candidate, id: 'plex-duplicate', ratingKey: 'r-duplicate', album: 'Different compilation' }),
    ]);

    expect(summary.ambiguous).toHaveLength(1);
    expect(summary.matched).toHaveLength(0);
  });

  it('flags ambiguous matches for multiple candidates', () => {
    const summary = matchSpotifyToPlex(
      [spotifyTrack({ name: 'Dreams', artists: ['Fleetwood Mac'], album: 'Rumours' })],
      [
        plexTrack({ id: 'p1', title: 'Dreams', artist: 'Fleetwood Mac', album: 'Rumours' }),
        plexTrack({ id: 'p2', title: 'Dreams', artist: 'Fleetwood Mac', album: 'Rumours' }),
      ],
    );

    expect(summary.ambiguous).toHaveLength(1);
    expect(summary.matched).toHaveLength(0);
  });

  it('uses a user-confirmed Plex match in later matching runs', () => {
    const spotify = spotifyTrack({ id: 'confirmed-1', name: 'Dreams' });
    const chosen = plexTrack({ id: 'chosen', ratingKey: 'chosen-key', title: 'Dreams' });
    const summary = matchSpotifyToPlex(
      [spotify],
      [chosen, plexTrack({ id: 'other', ratingKey: 'other-key', title: 'Dreams' })],
      { 'confirmed-1': chosen },
    );

    expect(summary.matched).toHaveLength(1);
    expect(summary.matched[0]?.plex.ratingKey).toBe('chosen-key');
    expect(summary.matched[0]?.explanation).toBe('Manually confirmed by the user.');
    expect(summary.ambiguous).toHaveLength(0);
  });

  it('keeps missing tracks visible instead of silently dropping them', () => {
    const summary = matchSpotifyToPlex(
      [spotifyTrack({ id: 'm-1', name: 'Missing Track', artists: ['Unknown Artist'] })],
      [plexTrack({ title: 'Different Song', artist: 'Someone Else' })],
    );

    expect(summary.missingSpotify).toHaveLength(1);
    expect(summary.missingSpotify[0]?.name).toBe('Missing Track');
  });
});
