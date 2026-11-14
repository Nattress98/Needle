import type { AmbiguousMatch, MatchingCandidate, MatchingSummary, PlexTrack, SpotifyTrack } from './types';

export function normaliseText(value: string): string {
  if (!value) {
    return '';
  }

  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/\b(feat|featuring|ft)\.?\s*/gi, ' ')
    .replace(/\b(remastered|deluxe|radio|edit|live|acoustic|single)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function compactText(value: string): string {
  return normaliseText(value).replace(/\s+/g, '');
}

function artistVariants(value: string): string[] {
  const cleaned = stripFeaturedArtist(value);
  return Array.from(new Set([
    cleaned,
    ...cleaned.split(/\s*[,;]\s*/),
  ].map(compactText).filter((artist) => artist && !['variousartists', 'va', 'unknownartist'].includes(artist))));
}

function isCompilationArtist(value: string): boolean {
  return ['variousartists', 'various', 'va'].includes(compactText(value));
}

function scoreCompilationTrackMatch(spotify: SpotifyTrack, plex: PlexTrack): number {
  const spotifyTitle = compactText(stripFeaturedArtist(spotify.name));
  const plexTitle = compactText(stripFeaturedArtist(plex.title));
  if (
    !isCompilationArtist(plex.artist) ||
    !spotifyTitle ||
    spotifyTitle !== plexTitle ||
    spotify.durationMs <= 0 ||
    plex.durationMs <= 0
  ) {
    return 0;
  }

  const durationDifference = Math.abs(spotify.durationMs - plex.durationMs);
  if (durationDifference > Math.max(3000, spotify.durationMs * 0.02)) {
    return 0;
  }
  return 0.84 + stringSimilarity(String(spotify.durationMs), String(plex.durationMs)) * 0.1;
}

export function stripFeaturedArtist(value: string): string {
  return value
    .replace(/\s*\((feat\.|featuring|ft\.)[^)]*\)/gi, '')
    .replace(/\s*(feat\.|featuring|ft\.)\s*.*$/gi, '');
}

export function stringSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  if (!left || !right) {
    return 0;
  }

  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const maxLength = Math.max(a.length, b.length);

  if (maxLength === 0) {
    return 1;
  }

  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLength;
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= right.length; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[left.length][right.length];
}

export function scoreSpotifyPlexMatch(spotify: SpotifyTrack, plex: PlexTrack): number {
  if (spotify.isrc && plex.isrc && spotify.isrc === plex.isrc) {
    return 1;
  }

  const spotifyArtists = spotify.artists.flatMap(artistVariants);
  const plexArtists = artistVariants(plex.artist);
  const plexAlbumArtist = plexArtists.length === 0 && !isCompilationArtist(plex.artist)
    ? artistVariants(plex.albumArtist)
    : [];
  const spotifyTitle = compactText(stripFeaturedArtist(spotify.name));
  const plexTitle = compactText(stripFeaturedArtist(plex.title));
  const spotifyAlbum = compactText(spotify.album);
  const plexAlbum = compactText(plex.album);

  if (!spotifyTitle || !plexTitle) {
    return 0;
  }

  if (spotifyArtists.length === 0 || (plexArtists.length === 0 && plexAlbumArtist.length === 0)) {
    return scoreCompilationTrackMatch(spotify, plex);
  }

  const artistSimilarity = Math.max(...spotifyArtists.flatMap((spotifyArtist) => [
    ...plexArtists.map((plexArtist) => stringSimilarity(spotifyArtist, plexArtist)),
    ...plexAlbumArtist.map((plexArtist) => stringSimilarity(spotifyArtist, plexArtist) * 0.9),
  ]));
  const titleSimilarity = stringSimilarity(spotifyTitle, plexTitle);

  // A strong title alone is not enough: require the primary artist to agree too.
  if (artistSimilarity < 0.62 || titleSimilarity < 0.72) {
    return 0;
  }

  const albumSimilarity = spotifyAlbum && plexAlbum
    ? stringSimilarity(spotifyAlbum, plexAlbum)
    : 0;
  const durationSimilarity = spotify.durationMs > 0 && plex.durationMs > 0
    ? Math.max(0, 1 - Math.abs(spotify.durationMs - plex.durationMs) / Math.max(spotify.durationMs, plex.durationMs))
    : 0;

  return Math.min(1, artistSimilarity * 0.45 + titleSimilarity * 0.45 + albumSimilarity * 0.06 + durationSimilarity * 0.04);
}

export function matchSpotifyToPlex(
  spotifyTracks: SpotifyTrack[],
  plexTracks: PlexTrack[],
  confirmedMatches: Record<string, PlexTrack> = {},
): MatchingSummary {
  const matched: MatchingCandidate[] = [];
  const missingSpotify: SpotifyTrack[] = [];
  const ambiguous: AmbiguousMatch[] = [];
  const usedPlexIds = new Set<string>();

  for (const spotifyTrack of spotifyTracks) {
    const confirmedTrack = confirmedMatches[spotifyTrack.id];
    const currentConfirmedTrack = confirmedTrack
      ? plexTracks.find((track) => track.ratingKey === confirmedTrack.ratingKey && !usedPlexIds.has(track.id))
      : undefined;
    if (currentConfirmedTrack) {
      matched.push({
        spotify: spotifyTrack,
        plex: currentConfirmedTrack,
        confidence: 'high',
        explanation: 'Manually confirmed by the user.',
      });
      usedPlexIds.add(currentConfirmedTrack.id);
      continue;
    }

    const isrcMatches = plexTracks.filter(
      (plexTrack) =>
        Boolean(spotifyTrack.isrc) &&
        Boolean(plexTrack.isrc) &&
        spotifyTrack.isrc === plexTrack.isrc &&
        !usedPlexIds.has(plexTrack.id),
    );

    if (isrcMatches.length > 0) {
      if (isrcMatches.length === 1) {
        matched.push({
          spotify: spotifyTrack,
          plex: isrcMatches[0],
          confidence: 'high',
          explanation: `ISRC match on ${spotifyTrack.isrc}.`,
        });
        usedPlexIds.add(isrcMatches[0].id);
      } else {
        ambiguous.push({
          spotify: spotifyTrack,
          candidates: isrcMatches,
          explanation: `Multiple Plex tracks share the same ISRC ${spotifyTrack.isrc}.`,
        });
      }
      continue;
    }

    const ranked = plexTracks
      .filter((plexTrack) => !usedPlexIds.has(plexTrack.id))
      .map((plexTrack) => ({
        plexTrack,
        score: scoreSpotifyPlexMatch(spotifyTrack, plexTrack),
        compilationFallback: isCompilationArtist(plexTrack.artist) &&
          artistVariants(plexTrack.artist).length === 0,
      }))
      .filter((entry) => entry.score >= 0.78)
      .sort((left, right) => right.score - left.score);

    if (ranked.length === 0) {
      missingSpotify.push(spotifyTrack);
      continue;
    }

    const bestMatch = ranked[0];
    const closeMatches = ranked.filter(
      (entry) => entry.score >= bestMatch.score - 0.06 && entry.plexTrack.id !== bestMatch.plexTrack.id,
    );

    if (closeMatches.length > 0) {
      ambiguous.push({
        spotify: spotifyTrack,
        candidates: [bestMatch.plexTrack, ...closeMatches.map((entry) => entry.plexTrack)],
        explanation: 'Several Plex tracks are close; manual review required before sync.',
      });
      continue;
    }

    const confidence: MatchingCandidate['confidence'] = bestMatch.score >= 0.85 && !bestMatch.compilationFallback
      ? 'high'
      : 'medium';
    matched.push({
      spotify: spotifyTrack,
      plex: bestMatch.plexTrack,
      confidence,
      explanation: bestMatch.compilationFallback
        ? 'Matched by exact title and close duration on a Various Artists compilation.'
        : `Matched by ${bestMatch.score >= 0.85 ? 'exact or near-exact' : 'normalised'} artist/title metadata.`,
    });
    usedPlexIds.add(bestMatch.plexTrack.id);
  }

  return { matched, missingSpotify, ambiguous };
}
