import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Accessibility', () => {
  test('page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    }))).toEqual([]);
  });

  test('text and placeholders have sufficient contrast', async ({ page }) => {
    await page.goto('/#/playlists');
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
    });

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(results.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    }))).toEqual([]);
  });

  test('Plex settings controls have no accessibility violations', async ({ page }) => {
    await page.goto('/#/settings');
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
    });

    const results = await new AxeBuilder({ page })
      .include('.connection-card')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    }))).toEqual([]);
  });

  test('missing-track continuation page has no accessibility violations', async ({ page }) => {
    await page.goto('/#/missing');
    await expect(page.locator('.portfolio-main')).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('spotify-plex-sync-db', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('app', 'readwrite');
        transaction.objectStore('app').put({
          plexConnected: true,
          plexUserName: 'musicfan',
          importedPlaylists: [{
            id: 'travel-playlist',
            name: 'Travel Mix',
            owner: 'Public Spotify playlist',
            trackCount: 1,
            isSynced: true,
          }],
          spotifyTracks: { 'travel-playlist': [] },
          syncHistory: [{
            id: 'travel-sync',
            spotifyPlaylistId: 'travel-playlist',
            spotifyName: 'Travel Mix',
            plexPlaylistId: 'plex-travel-mix',
            plexName: 'Travel in Plex',
            matchedCount: 0,
            missingCount: 1,
            lastSyncedAt: '2026-01-01T00:00:00.000Z',
            status: 'partial',
          }],
          missingTracks: [{
            title: 'Unfound song',
            artist: 'Example artist',
            album: 'Example album',
            durationMs: 180000,
            playlistPosition: 1,
            status: 'missing',
            spotifyTrackId: 'missing-track',
            playlistId: 'travel-playlist',
            plexPlaylistId: 'plex-travel-mix',
            plexPlaylistName: 'Travel in Plex',
          }],
          confirmedMatches: {},
        }, 'state');
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    }));
    await page.reload();
    await expect(page.getByRole('link', { name: 'Continue sync' })).toBeVisible();
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    }))).toEqual([]);
  });

  test('Plex remote connection choices remain accessible when populated', async ({ page }) => {
    await page.route('https://plex.tv/api/resources?**', async (route) => {
      await route.fulfill({
        contentType: 'application/xml',
        body: '<MediaContainer><Device name="Home Plex" provides="server" clientIdentifier="plex-id"><Connection uri="https://remote.example:32400" local="0" relay="0"/><Connection uri="https://relay.example:443" local="0" relay="1"/></Device></MediaContainer>',
      });
    });
    await page.goto('/#/settings');
    await expect(page.locator('.portfolio-main')).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('spotify-plex-sync-db', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('app', 'readwrite');
        transaction.objectStore('app').put({
          plexConnected: true,
          plexUserName: 'musicfan',
          plexToken: 'account-token',
          selectedServer: {
            name: 'Home Plex',
            url: 'https://remote.example:32400',
            serverId: 'plex-id',
            connectionType: 'remote',
          },
          importedPlaylists: [],
          spotifyTracks: {},
          syncHistory: [],
          missingTracks: [],
          confirmedMatches: {},
        }, 'state');
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    }));
    await page.reload();
    await page.getByRole('button', { name: 'Refresh servers' }).click();
    const connectionSelect = page.getByRole('combobox', { name: 'Plex server connection' });
    await expect(connectionSelect.getByRole('option', { name: 'Home Plex — Remote direct' })).toBeAttached();
    await expect(connectionSelect.getByRole('option', { name: 'Home Plex — Plex Relay' })).toBeAttached();

    const results = await new AxeBuilder({ page })
      .include('.connection-card')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    }))).toEqual([]);

    const contrastResults = await new AxeBuilder({ page })
      .include('.connection-card')
      .withRules(['color-contrast'])
      .analyze();
    expect(contrastResults.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    }))).toEqual([]);
  });
});
