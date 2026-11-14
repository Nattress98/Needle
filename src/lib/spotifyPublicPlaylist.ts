import type { PlaylistMeta, SpotifyTrack } from './types';

export interface PublicPlaylistMetadata {
  id: string;
  name: string;
}

export function extractSpotifyPlaylistId(input: string): string | null {
  const value = input.trim();
  const uriMatch = value.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uriMatch?.[1]) {
    return uriMatch[1];
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.hostname !== 'open.spotify.com' && url.hostname !== 'www.open.spotify.com') {
    return null;
  }

  const match = url.pathname.match(/^\/(?:embed\/)?playlist\/([A-Za-z0-9]+)\/?$/);
  return match?.[1] ?? null;
}

export function parsePublicPlaylistTitle(text: string): string | undefined {
  const titleLine = text.match(/^\s*Title:\s*(.+?)\s*$/im);
  return titleLine?.[1]?.trim() || undefined;
}

function parseDuration(line: string): number | undefined {
  const match = line.trim().match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) {
    return undefined;
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] === undefined ? undefined : Number(match[3]);
  const totalSeconds = third === undefined ? first * 60 + second : first * 3600 + second * 60 + third;
  return totalSeconds * 1000;
}

function cleanTextLine(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*[-*]\s*/, '')
    .trim();
}

export function parsePublicPlaylistText(text: string, playlistId: string): SpotifyTrack[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const starts: Array<{ index: number; position: number; title: string }> = [];
  const firstNumberedTrack = lines.findIndex((line) => /^\s*\d+\.\s*/.test(line));

  lines.forEach((line, index) => {
    const match = line.match(/^\s*(\d+)\.\s*(?:#{1,6}\s*)?(.+?)\s*$/);
    if (match?.[1] && match[2]) {
      starts.push({
        index,
        position: Number(match[1]),
        title: cleanTextLine(match[2]),
      });
    }
  });

  const tracks: SpotifyTrack[] = [];

  if (firstNumberedTrack > 0) {
    const leadingBlock = lines.slice(0, firstNumberedTrack);
    const leadingDurationIndex = leadingBlock.findIndex((line) => parseDuration(line) !== undefined);
    const leadingHeading = leadingDurationIndex >= 0
      ? [...leadingBlock.slice(0, leadingDurationIndex)].reverse()
        .find((line) => /^\s*#{1,6}\s*.+/.test(line))
      : undefined;
    const combinedTrack = leadingHeading
      ? cleanTextLine(leadingHeading).match(/^(.+?)\s*,\s*(.+)$/)
      : null;

    const leadingPosition = (starts[0]?.position ?? 1) - 1;
    if (combinedTrack?.[1] && combinedTrack[2] && leadingPosition > 0) {
      const durationMs = parseDuration(leadingBlock[leadingDurationIndex]);
      if (durationMs) {
        tracks.push({
          id: `${playlistId}-0`,
          name: combinedTrack[1].trim(),
          artists: combinedTrack[2].split(/\s*,\s*/).map((artist) => artist.trim()).filter(Boolean),
          album: '',
          durationMs,
          position: leadingPosition,
          spotifyUrl: `https://open.spotify.com/playlist/${encodeURIComponent(playlistId)}`,
        });
      }
    }
  }

  for (let itemIndex = 0; itemIndex < starts.length; itemIndex += 1) {
    const item = starts[itemIndex];
    const nextItemIndex = starts[itemIndex + 1]?.index ?? lines.length;
    const block = lines.slice(item.index + 1, nextItemIndex);
    const durationLine = block.find((line) => parseDuration(line) !== undefined);
    const durationMs = durationLine ? parseDuration(durationLine) : undefined;
    const artistLine = block.find((line) => {
      const cleaned = cleanTextLine(line);
      return cleaned.length > 0 && parseDuration(line) === undefined;
    });

    if (!durationMs || !artistLine) {
      continue;
    }

    const artistNames = cleanTextLine(artistLine)
      .replace(/^E\s+/, '')
      .split(/\s*,\s*/)
      .map((artist) => artist.trim())
      .filter(Boolean);

    if (!item.title || artistNames.length === 0) {
      continue;
    }

    tracks.push({
      id: `${playlistId}-${item.position}`,
      name: item.title,
      artists: artistNames,
      album: '',
      durationMs,
      position: item.position,
      spotifyUrl: `https://open.spotify.com/playlist/${encodeURIComponent(playlistId)}`,
    });
  }

  return tracks.sort((left, right) => left.position - right.position);
}

export function createImportedPlaylist(
  metadata: PublicPlaylistMetadata,
  tracks: SpotifyTrack[],
  previous?: PlaylistMeta,
): PlaylistMeta {
  return {
    id: metadata.id,
    name: metadata.name,
    owner: previous?.owner ?? 'Public Spotify playlist',
    trackCount: tracks.length,
    isSynced: previous?.isSynced ?? false,
    ...(previous?.lastSyncedAt ? { lastSyncedAt: previous.lastSyncedAt } : {}),
  };
}
