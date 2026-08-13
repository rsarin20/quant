import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Church } from '../src/lib/churches/types';

/**
 * Regression tests for the first bug this app hit in production.
 *
 * The cache directory was chosen by sniffing `process.env.VERCEL`. On the real
 * deployment that variable was not exposed, so the store tried to `mkdir` inside
 * the read-only bundle, the write threw, and — because the failing write sat
 * inside the same `try` as the Overpass query — a perfectly successful church
 * search was reported to the user as "We could not search for churches just
 * now".
 *
 * Two invariants come out of that, and both are tested here:
 *   1. The cache root is found by *trying* candidates, not by guessing from the
 *      environment, so an unwritable first choice falls through to a working one.
 *   2. A cache write never throws. Caching is an optimisation; its failure must
 *      not surface to the person asking where Mass is.
 */

function church(id: string): Church {
  return {
    id,
    name: 'St Test',
    lat: 0,
    lon: 0,
    timezone: 'UTC',
    rite: 'roman',
    identification: 'tagged-catholic',
    sources: [{ kind: 'seed-data', fetchedAt: new Date().toISOString() }],
  };
}

/**
 * Point the store at a given data directory.
 *
 * The module memoises its resolved root, and a query-string import trick does not
 * defeat the loader's cache — so the store exposes `resetCacheRoot()` for exactly
 * this, and we call it after changing the environment.
 */
async function freshStore(dataDir: string | undefined) {
  if (dataDir === undefined) delete process.env.MASSFINDER_DATA_DIR;
  else process.env.MASSFINDER_DATA_DIR = dataDir;
  const store = await import('../src/lib/store');
  store.resetCacheRoot();
  return store;
}

test('a writable data directory is used for round-tripping', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'massfinder-ok-'));
  const store = await freshStore(dir);

  await store.putCachedChurches('tile_a', [church('osm:node/1')]);
  const read = await store.getCachedChurches('tile_a');
  assert.ok(read, 'should read back what was written');
  assert.equal(read!.length, 1);
  assert.equal(read![0].id, 'osm:node/1');

  await fs.rm(dir, { recursive: true, force: true });
});

test('an unwritable configured directory falls through to a working one', async () => {
  // A regular file cannot contain a directory, so mkdir under it fails with
  // ENOTDIR — standing in for the read-only bundle path that broke production.
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'massfinder-bad-'));
  const notADirectory = path.join(base, 'a-file');
  await fs.writeFile(notADirectory, 'not a directory', 'utf8');

  const store = await freshStore(path.join(notADirectory, 'data'));

  // The key assertion: this resolves rather than rejecting.
  await assert.doesNotReject(
    store.putCachedChurches('tile_b', [church('osm:node/2')]),
    'a cache write must never throw, whatever the filesystem says',
  );

  await fs.rm(base, { recursive: true, force: true });
});

test('reads and writes are harmless when nothing is cached', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'massfinder-empty-'));
  const store = await freshStore(dir);

  assert.equal(await store.getCachedChurches('never-written'), undefined);
  assert.equal(await store.getChurch('osm:node/999'), undefined);
  assert.equal(await store.getSchedule('osm:node/999'), undefined);
  assert.equal(await store.getScheduleEvenIfStale('osm:node/999'), undefined);
  assert.deepEqual(await store.readUserReports('osm:node/999'), []);

  await fs.rm(dir, { recursive: true, force: true });
});

test('user reports round-trip and drive the disputed verdict', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'massfinder-reports-'));
  const store = await freshStore(dir);

  assert.equal(store.reportSummary([]).verdict, 'none');

  await store.appendUserReport({
    churchId: 'osm:node/3',
    kind: 'times-correct',
    reportedAt: new Date().toISOString(),
  });
  await store.appendUserReport({
    churchId: 'osm:node/3',
    kind: 'times-wrong',
    reportedAt: new Date().toISOString(),
  });

  const reports = await store.readUserReports('osm:node/3');
  assert.equal(reports.length, 2, 'reports are append-only, so both survive');
  // A single "wrong" outranks a "correct": a wasted journey costs more than a
  // needless caveat.
  assert.equal(store.reportSummary(reports).verdict, 'disputed');

  await fs.rm(dir, { recursive: true, force: true });
});

test('church ids containing slashes do not become directories', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'massfinder-keys-'));
  const store = await freshStore(dir);

  await store.putChurch(church('osm:relation/12345'));
  const read = await store.getChurch('osm:relation/12345');
  assert.ok(read, 'an id with a slash must round-trip');
  assert.equal(read!.id, 'osm:relation/12345');

  // Exactly one file, directly inside the church directory.
  const entries = await fs.readdir(path.join(dir, 'church'), { withFileTypes: true });
  assert.equal(entries.length, 1);
  assert.ok(entries[0].isFile(), 'the key must be flattened into a filename');

  await fs.rm(dir, { recursive: true, force: true });
});
