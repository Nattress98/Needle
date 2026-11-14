import { expect, test } from '@playwright/test';

test('application loads the dashboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Keep the playlist/ })).toBeVisible();
  await expect(page.getByLabel('Spotify playlist URL')).toBeVisible();
  await expect(page.getByLabel('Spotify playlist URL')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByLabel('Spotify playlist URL')).toHaveCSS('color', 'rgb(17, 17, 15)');
  await expect(page.getByText('Road Trip Essentials')).toHaveCount(0);
  await expect(page.getByText('0 PLAYLISTS ADDED')).toBeVisible();
  await expect(page.locator('.portfolio-main')).toHaveCSS('background-color', 'rgb(255, 216, 0)');
  await expect(page.locator('.portfolio-main')).toHaveCSS('border-radius', '0px');
  await expect(page.locator('.portfolio-main')).toHaveCSS('min-height', '960px');
  await expect(page.locator('.portfolio-layout')).toHaveCSS('width', '1280px');
});

test('portfolio layout fits a mobile viewport without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Keep the playlist/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
});

test('playlist page shows URL and track inputs with a format preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Playlists', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Paste a playlist to get started' })).toBeVisible();
  await expect(page.getByText(/Enter your public Spotify playlist link/))
    .toHaveCSS('color', 'rgb(240, 238, 227)');
  await expect(page.locator('[aria-current="step"]')).toContainText('Add link');
  await expect.poll(() => page.locator('.import-step').first().evaluate((step) => {
    const marker = step.querySelector('.step-number')!.getBoundingClientRect();
    const label = step.querySelector(':scope > span:last-child')!.getBoundingClientRect();
    const markerCenter = marker.top + marker.height / 2;
    const labelCenter = label.top + label.height / 2;
    return Math.abs(markerCenter - labelCenter);
  })).toBeLessThan(1);
  await expect(page.locator('.import-step').first().locator(':scope > span:last-child'))
    .toHaveCSS('line-height', '25px');
  await expect(page.getByRole('textbox', { name: 'Spotify playlist URL' }))
    .toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Spotify playlist URL' }))
    .toHaveAttribute('placeholder', 'https://open.spotify.com/playlist/...');
  await expect(page.getByRole('textbox', { name: 'Spotify playlist URL' }))
    .toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByLabel('Paste the track listing')).toBeVisible();
  await expect(page.getByLabel('Paste the track listing')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByLabel('Paste the track listing')).toHaveValue('');
  await expect(page.getByLabel('Track listing format example'))
    .toContainText('#### Artist name');

  await page.getByLabel('Spotify playlist URL')
    .fill('https://open.spotify.com/playlist/testPlaylist123');
  await page.getByRole('button', { name: 'Validate link' }).click();
  await expect(page.getByRole('link', { name: 'Open playlist text to copy' })).toBeVisible();
});

test('homepage playlist prompt carries URL into the import form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Spotify playlist URL' })
    .fill('https://open.spotify.com/playlist/testPlaylist123');
  await page.getByRole('button', { name: 'Continue with playlist' }).click();
  await expect(page).toHaveURL(/#\/playlists$/);
  await expect(page.getByRole('textbox', { name: 'Spotify playlist URL' }))
    .toHaveValue('https://open.spotify.com/playlist/testPlaylist123');
});

test('imports and displays pasted public playlist tracks', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.portfolio-main')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('link', { name: 'Playlists', exact: true }).click();
  const playlistUrlInput = page.getByRole('textbox', { name: 'Spotify playlist URL' });
  await playlistUrlInput.fill('https://open.spotify.com/playlist/testPlaylist123');
  await expect(playlistUrlInput).toHaveValue('https://open.spotify.com/playlist/testPlaylist123');
  await page.getByRole('button', { name: 'Validate link' }).click();
  await expect(page.getByRole('status')).toContainText('Link validated');
  await expect(page.locator('[aria-current="step"]')).toContainText('Open listing');
  await page.getByLabel('Paste the track listing').fill(
    'Title: Imported test playlist\n\n1. ### Example song\n#### Example artist\n03:05\n\n2. ### Second song\n#### Second artist\n04:12',
  );
  await expect(page.locator('[aria-current="step"]')).toContainText('Import tracks');
  await page.getByRole('button', { name: 'Import 2 tracks' }).click();

  await expect(page.locator('article').getByRole('heading', { name: 'Imported test playlist' })).toBeVisible();
  await page.getByText('Show imported tracks (2)').click();
  await expect(page.getByText('Example song', { exact: true })).toBeVisible();
  await expect(page.getByText('Second song', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const library = document.querySelector('.playlist-library');
    const card = document.querySelector('.playlist-library > article');
    if (!library || !card) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.abs(library.getBoundingClientRect().width - card.getBoundingClientRect().width);
  })).toBeLessThan(1);

  await page.reload();
  await page.getByText('Show imported tracks (2)').click();
  await expect(page.getByText('Example song', { exact: true })).toBeVisible();
});

test('playlist sync actions request Plex setup before navigating there', async ({ page }) => {
  await page.goto('/#/playlists');
  await expect(page.locator('.portfolio-main')).toHaveAttribute('aria-busy', 'false');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('spotify-plex-sync-db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('app', 'readwrite');
      transaction.objectStore('app').put({
        plexConnected: false,
        plexUserName: '',
        importedPlaylists: [{
          id: 'my-playlist',
          name: 'My soundtrack',
          owner: 'Public Spotify playlist',
          trackCount: 1,
          isSynced: false,
        }],
        spotifyTracks: { 'my-playlist': [] },
        syncHistory: [],
        missingTracks: [],
      }, 'state');
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.reload();
  await page.getByRole('button', { name: 'Preview sync' }).click();

  const setupDialog = page.getByRole('dialog');
  await expect(setupDialog.getByRole('heading', { name: 'Connect Plex to continue' })).toBeVisible();
  await expect(setupDialog).toContainText('Your playlist will stay saved.');
  await setupDialog.getByRole('link', { name: 'Go to Plex setup' }).click();
  await expect(page).toHaveURL(/#\/connections$/);
  await expect(page.getByRole('button', { name: 'Connect Plex' })).toBeVisible();
});

test('previews playlist matches against a selected Plex music library', async ({ page }) => {
  const playlistRequests: string[] = [];
  await page.route('https://plex.example:32400/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'accept',
        },
      });
    } else if (url.pathname === '/library/sections') {
      await route.fulfill({
        contentType: 'application/xml',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '<MediaContainer><Directory key="1" title="Music" type="artist"/></MediaContainer>',
      });
    } else if (url.pathname === '/library/sections/1/all') {
      await route.fulfill({
        contentType: 'application/xml',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '<MediaContainer><Track ratingKey="plex-1" title="Found song" grandparentTitle="Found artist" parentTitle="Album" duration="180000"/><Track ratingKey="plex-2" title="Second found" grandparentTitle="Found artist" parentTitle="Album" duration="180000"/><Track ratingKey="plex-3" title="Dreams" grandparentTitle="Fleetwood Mac" parentTitle="Rumours" duration="250000"/><Track ratingKey="plex-4" title="Dreams" grandparentTitle="Fleetwood Mac" parentTitle="The Dance" duration="250000"/><Track ratingKey="plex-5" title="Stay" grandparentTitle="Shakespears Sister" parentTitle="Hormonally Yours" duration="210000"/><Track ratingKey="plex-6" title="Stay" grandparentTitle="Shakespears Sister" parentTitle="Greatest Hits" duration="210000"/><Track ratingKey="plex-7" title="Paparazzi" grandparentTitle="Various Artists" parentTitle="Tony Hawk&apos;s Pro Skater 3" duration="180000"/><Track ratingKey="plex-8" title="Check" grandparentTitle="Various Artists" parentTitle="Tony Hawk&apos;s Pro Skater 3" duration="210000"/></MediaContainer>',
      });
    } else if (url.pathname === '/playlists' && request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/xml',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '<MediaContainer><Metadata type="playlist" ratingKey="existing-playlist" title="Road Mix" playlistType="audio"/></MediaContainer>',
      });
    } else if (url.pathname === '/playlists/existing-playlist/items' && request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/xml',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '<MediaContainer><Track ratingKey="plex-1"/></MediaContainer>',
      });
    } else if (url.pathname === '/playlists/existing-playlist/items' && request.method() === 'PUT') {
      playlistRequests.push(request.url());
      await route.fulfill({
        contentType: 'application/xml',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '<MediaContainer/>',
      });
    } else {
      await route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
  });
  await page.goto('/#/playlists');
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
          name: 'Music Server',
          url: 'https://plex.example:32400',
          serverId: 'server-id',
          accessToken: 'server-token',
        },
        importedPlaylists: [{
          id: 'my-playlist',
          name: 'My soundtrack',
          owner: 'Public Spotify playlist',
          trackCount: 7,
          isSynced: false,
        }],
        spotifyTracks: {
          'my-playlist': [
            { id: 'spotify-1', name: 'Found song', artists: ['Found artist'], album: 'Album', durationMs: 180000, position: 1 },
            { id: 'spotify-2', name: 'Missing song', artists: ['Missing artist'], album: 'Other album', durationMs: 200000, position: 2 },
            { id: 'spotify-3', name: 'Second found', artists: ['Found artist'], album: 'Album', durationMs: 180000, position: 3 },
            { id: 'spotify-4', name: 'Dreams', artists: ['Fleetwood Mac'], album: 'Rumours', durationMs: 250000, position: 4 },
            { id: 'spotify-5', name: 'Stay', artists: ['Shakespears Sister'], album: 'Hormonally Yours', durationMs: 210000, position: 5 },
            { id: 'spotify-6', name: 'Paparazzi', artists: ['Xzibit'], album: '', durationMs: 180000, position: 6 },
            { id: 'spotify-7', name: 'Check', artists: ['zebrahead'], album: '', durationMs: 210000, position: 7 },
          ],
        },
        syncHistory: [],
        missingTracks: [],
      }, 'state');
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.reload();
  await page.getByRole('button', { name: 'Preview sync' }).click();

  const previewDialog = page.getByRole('dialog');
  await expect(previewDialog.getByRole('heading', { name: 'Preview sync results' })).toBeVisible();
  await expect(previewDialog).toContainText('4 matched · 1 missing · 2 need review');
  await expect(previewDialog).toContainText('Paparazzi — Xzibit → Paparazzi — Various Artists');
  await expect(previewDialog).toContainText('Check — zebrahead → Check — Various Artists');
  await expect(previewDialog).toContainText('Missing song — Missing artist');
  await expect(previewDialog.locator('.playlist-match-list span').first()).toHaveCSS('color', 'rgb(255, 216, 0)');
  await previewDialog.getByRole('combobox', { name: 'Plex match for Dreams' }).selectOption('plex-3');
  await previewDialog.getByRole('listitem').filter({ hasText: 'Dreams — Fleetwood Mac' })
    .getByRole('button', { name: 'Confirm match' }).click();
  await expect(previewDialog).toContainText('5 matched · 1 missing · 1 need review');
  await previewDialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Sync now' }).click();

  const syncDialog = page.getByRole('dialog');
  await expect(syncDialog.getByRole('heading', { name: 'Sync now results' })).toBeVisible();
  await expect(syncDialog).toHaveCSS('width', '1080px');
  await expect(syncDialog.locator('.playlist-match-list li').first()).toHaveCSS('white-space', 'nowrap');
  await expect(syncDialog.locator('.playlist-destination')).toBeVisible();
  await expect(syncDialog.locator('.playlist-destination legend')).toHaveCSS('color', 'rgb(255, 216, 0)');
  await expect(syncDialog.getByRole('radio', { name: 'Create a new playlist' })).toHaveCSS('accent-color', 'rgb(255, 216, 0)');
  await expect(syncDialog.getByRole('radio', { name: 'Add to an existing playlist' })).toBeVisible();
  await syncDialog.getByRole('radio', { name: 'Add to an existing playlist' }).check();
  await expect(syncDialog).toContainText('Tracks already there are skipped');
  await expect(syncDialog).toContainText('missing and “needs review” tracks are excluded.');
  await expect(syncDialog.locator('#target-plex-playlist')).toHaveValue('existing-playlist');
  await expect(syncDialog.locator('#target-plex-playlist option').first())
    .toHaveCSS('color', 'rgb(17, 17, 15)');
  await expect(syncDialog.locator('#target-plex-playlist option').first())
    .toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(syncDialog.locator('#target-plex-playlist')).toHaveCSS('color', 'rgb(17, 17, 15)');
  await syncDialog.getByRole('button', { name: 'Add 5 tracks to playlist' }).click();
  await expect(syncDialog.getByRole('heading', { name: 'Sync complete' })).toBeVisible();
  await expect(syncDialog).toContainText('Updated “Road Mix” in Plex: 4 added, 1 already present.');
  expect(playlistRequests).toHaveLength(4);
  expect(playlistRequests[0]).toContain('plex-2');
  expect(playlistRequests[1]).toContain('plex-3');
  expect(playlistRequests[2]).toContain('plex-7');
  expect(playlistRequests[3]).toContain('plex-8');
  await syncDialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.playlist-card')).toContainText('Synced');
  await page.getByRole('link', { name: 'Missing tracks' }).click();
  await expect(page.getByRole('link', { name: 'Set up Lidarr' })).toBeVisible();
  const stayRow = page.getByRole('row').filter({ hasText: 'Stay' });
  await stayRow.getByRole('combobox', { name: 'Plex match for Stay' }).selectOption('plex-5');
  await stayRow.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Stay' })).toHaveCount(0);
});

test('connects a Plex account and selects an available server', async ({ page }) => {
  let pinRequestHeaders: Record<string, string> = {};
  let pinRequestStrong: string | null = null;
  let pollRequestHeaders: Record<string, string> = {};
  await page.route('https://plex.tv/api/v2/pins?**', async (route) => {
    pinRequestHeaders = route.request().headers();
    pinRequestStrong = new URL(route.request().url()).searchParams.get('strong');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 12345, code: 'ABCD', product: 'Spotify to Plex Sync' }),
    });
  });
  await page.route('https://plex.tv/api/v2/pins/12345?code=ABCD', async (route) => {
    pollRequestHeaders = route.request().headers();
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ authToken: 'plex-auth-token', user: { username: 'musicfan' } }),
    });
  });
  await page.route('https://plex.tv/api/resources?**', async (route) => {
    await route.fulfill({
      contentType: 'application/xml',
      body: '<MediaContainer size="1"><Device name="Living Room Plex" provides="server" clientIdentifier="plex-machine-1" accessToken="server-access-token"><Connection uri="https://plex.example:32400" local="1"/></Device></MediaContainer>',
    });
  });

  await page.goto('/#/connections');
  await expect(page.locator('.portfolio-main')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Connect Plex' }).click();
  const authorizeLink = page.getByRole('link', { name: 'Open Plex to authorize' });
  await expect(authorizeLink).toBeVisible();
  await expect(authorizeLink).toHaveAttribute('href', /code=ABCD/);
  await expect(page.getByRole('option', { name: 'Living Room Plex' })).toHaveCount(1);
  await expect.poll(() => pollRequestHeaders['x-plex-client-identifier']).toBe('spotify-plex-sync-app');
  expect(pinRequestHeaders['x-plex-client-identifier']).toBe('spotify-plex-sync-app');
  expect(pinRequestHeaders['x-plex-product']).toBe('Spotify to Plex Sync');
  expect(pinRequestStrong).toBe('true');
  expect(pollRequestHeaders['x-plex-product']).toBe('Spotify to Plex Sync');
  await page.getByLabel('Plex server').selectOption('plex-machine-1');
  await expect(page.getByText('musicfan')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Authenticated')).toBeVisible();
  await expect(page.getByText(/Living Room Plex · https:\/\/plex.example:32400/)).toBeVisible();
});

test('adds a missing album to Lidarr without triggering a search', async ({ page }) => {
  let addedAlbumBody: Record<string, unknown> | undefined;
  let albumAddRequestCount = 0;
  await page.route('https://lidarr.example:8686/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'accept, content-type, x-api-key',
        },
      });
      return;
    }
    if (request.method() === 'POST' && url.pathname === '/api/v1/artist') {
      await route.fulfill({
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ id: 4, foreignArtistId: 'artist-mbid', artistName: 'Missing Artist' }),
      });
      return;
    }
    if (request.method() === 'POST' && url.pathname === '/api/v1/album') {
      albumAddRequestCount += 1;
      addedAlbumBody = request.postDataJSON() as Record<string, unknown>;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ id: 8 }),
      });
      return;
    }
    let body: unknown = [];
    if (url.pathname === '/api/v1/album/lookup') {
      body = [{
        foreignAlbumId: 'album-mbid',
        title: 'The Album',
        artist: { foreignArtistId: 'artist-mbid', artistName: 'Missing Artist' },
      }];
    } else if (url.pathname === '/api/v1/rootfolder') {
      body = [{ id: 1, path: 'D:\\Music' }];
    } else if (url.pathname === '/api/v1/qualityprofile') {
      body = [{ id: 2, name: 'Lossless' }];
    } else if (url.pathname === '/api/v1/metadataprofile') {
      body = [{ id: 3, name: 'Standard' }];
    } else if (url.pathname === '/api/v1/artist') {
      body = [];
    } else if (url.pathname === '/api/v1/album') {
      body = [];
    }
    await route.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(body),
    });
  });

  await page.goto('/#/settings');
  await expect(page.locator('.portfolio-main')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('Lidarr URL').fill('https://lidarr.example:8686');
  await expect(page.getByLabel('Lidarr URL')).toHaveCSS('color', 'rgb(17, 17, 15)');
  await expect(page.getByLabel('Lidarr URL')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect.poll(() => page.getByLabel('Lidarr URL').evaluate(
    (input) => getComputedStyle(input, '::placeholder').color,
  )).toBe('rgb(90, 90, 85)');
  await page.getByLabel('Lidarr API key').fill('test-api-key');
  await page.getByRole('button', { name: 'Save Lidarr settings' }).click();
  await expect(page.getByRole('status')).toContainText('Lidarr settings saved');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('spotify-plex-sync-db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('app', 'readwrite');
      transaction.objectStore('app').put({
        plexConnected: false,
        plexUserName: '',
        importedPlaylists: [],
        spotifyTracks: {},
        syncHistory: [],
        lidarr: { url: 'https://lidarr.example:8686', apiKey: 'test-api-key' },
        missingTracks: [{
          title: 'Missing song',
          artist: 'Missing Artist',
          album: 'The Album',
          durationMs: 180000,
          playlistPosition: 1,
          status: 'missing',
          spotifyTrackId: 'spotify-missing-1',
        }],
      }, 'state');
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.reload();
  await page.goto('/#/missing');
  await expect(page.locator('.portfolio-main')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Search in Lidarr' }).click();
  const lidarrDialog = page.getByRole('dialog');
  await expect(lidarrDialog.getByRole('heading', { name: 'Choose the album to add' })).toBeVisible();
  await expect(lidarrDialog.getByRole('button', { name: 'Just Add' })).toBeVisible();
  await expect.poll(async () => {
    const bounds = await lidarrDialog.boundingBox();
    return bounds
      ? Math.abs((bounds.y + bounds.height / 2) - (await page.evaluate(() => innerHeight / 2)))
      : Number.POSITIVE_INFINITY;
  }).toBeLessThan(2);
  await expect(lidarrDialog.getByLabel('Album result')).toContainText('The Album');
  const monitorButton = lidarrDialog.getByRole('button', { name: 'Add and monitor album' });
  const justAddButton = lidarrDialog.getByRole('button', { name: 'Just Add' });
  await monitorButton.click();
  await expect(monitorButton).toBeDisabled();
  await expect(justAddButton).toBeDisabled();
  await expect(lidarrDialog.getByRole('heading', { name: 'Album added to Lidarr' })).toBeVisible();
  expect(albumAddRequestCount).toBe(1);
  await expect(lidarrDialog).toContainText('Lidarr was not asked to search or download.');
  expect(addedAlbumBody).toMatchObject({
    artistId: 4,
    monitored: true,
    addOptions: { searchForNewAlbum: false },
  });
  await lidarrDialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Added to Lidarr')).toBeVisible();
});

test('removes previously stored sample playlists without removing user playlists', async ({ page }) => {
  await page.goto('/#/playlists');
  await expect(page.getByRole('heading', { name: 'Paste a playlist to get started' })).toBeVisible();
  await expect(page.locator('.portfolio-main')).toHaveAttribute('aria-busy', 'false');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('spotify-plex-sync-db', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('app', 'readwrite');
      transaction.objectStore('app').put({
        importedPlaylists: [
          { id: 'playlist-1', name: 'Road Trip Essentials', owner: 'demo_user', trackCount: 28, isSynced: true },
          { id: 'personal-playlist', name: 'My playlist', owner: 'Public Spotify playlist', trackCount: 1, isSynced: false },
        ],
        spotifyTracks: {},
        syncHistory: [],
        missingTracks: [],
        plexConnected: false,
        plexUserName: '',
      }, 'state');
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.reload();

  await expect(page.getByRole('heading', { name: 'My playlist' })).toBeVisible();
  await expect(page.getByText('Road Trip Essentials')).toHaveCount(0);
});
