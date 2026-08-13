import type { Church } from './churches/types';
import type { ChurchSchedule, MassRule } from './schedule/types';

/**
 * Fictional parishes, so the interface can be demonstrated and tested with no
 * network access.
 *
 * These are **not real churches**. Every name is obviously invented, every
 * church carries `example: true`, and every rule's source is `seed-data`. The UI
 * shows a standing warning whenever any of them is on screen.
 *
 * The alternative — seeding with real parishes and plausible times — would mean
 * shipping fabricated Mass times that look exactly like researched ones. For an
 * app whose whole promise is that a person can trust the time and travel to it,
 * that would be the worst possible default.
 *
 * They are chosen to exercise the awkward cases: a parish with several languages,
 * one with a Saturday vigil only, one in a half-hour timezone, one Eastern
 * Catholic parish on a different calendar, and one with no schedule at all.
 */

const seedSource = {
  kind: 'seed-data' as const,
  fetchedAt: '2025-01-01T00:00:00.000Z',
  detail: 'Bundled example data — not a real church',
};

function rules(churchId: string, specs: Array<Partial<MassRule> & { time: string }>): MassRule[] {
  return specs.map((spec, i) => ({
    id: `${churchId}:seed:${i}`,
    kind: 'weekly',
    confidence: 0.5,
    source: { ...seedSource, quote: 'Example data' },
    ...spec,
  })) as MassRule[];
}

export interface DemoEntry {
  church: Church;
  schedule: ChurchSchedule;
}

export const DEMO_CHURCHES: DemoEntry[] = [
  {
    church: {
      id: 'example:dublin-1',
      name: 'St Example the Confessor (EXAMPLE — not a real church)',
      lat: 53.3498,
      lon: -6.2603,
      timezone: 'Europe/Dublin',
      countryCode: 'IE',
      address: { street: 'Sample Street', city: 'Demo City', country: 'IE' },
      phone: '+353 1 000 0000',
      website: 'https://example.invalid/parish',
      rite: 'roman',
      identification: 'tagged-catholic',
      sources: [seedSource],
      example: true,
    },
    schedule: {
      churchId: 'example:dublin-1',
      quality: 'parish-website',
      lastCheckedAt: new Date().toISOString(),
      rules: rules('example:dublin-1', [
        { kind: 'weekly', weekdays: [6], time: '18:30', anticipates: 'next-day', note: 'Vigil' },
        { kind: 'weekly', weekdays: [0], time: '09:00' },
        { kind: 'weekly', weekdays: [0], time: '11:00', note: 'Sung' },
        { kind: 'weekly', weekdays: [0], time: '12:30', language: 'pl' },
        { kind: 'weekly', weekdays: [1, 2, 3, 4, 5], time: '10:00' },
        { kind: 'liturgical', celebrationId: 'ascension', time: '19:30' },
        { kind: 'annual-date', monthDay: { month: 8, day: 15 }, time: '07:30' },
        { kind: 'liturgical', celebrationId: 'christmas', time: '00:00', note: 'Midnight Mass' },
        { kind: 'liturgical', celebrationId: 'easter-sunday', time: '21:00', note: 'Easter Vigil' },
      ]),
    },
  },
  {
    church: {
      id: 'example:dublin-2',
      name: 'Example Chapel of the Holy Placeholder (EXAMPLE — not a real church)',
      lat: 53.3402,
      lon: -6.2675,
      timezone: 'Europe/Dublin',
      countryCode: 'IE',
      address: { street: 'Placeholder Road', city: 'Demo City', country: 'IE' },
      rite: 'roman',
      identification: 'tagged-catholic',
      sources: [seedSource],
      example: true,
    },
    schedule: {
      churchId: 'example:dublin-2',
      quality: 'community-tags',
      lastCheckedAt: new Date(Date.now() - 200 * 86_400_000).toISOString(),
      rules: rules('example:dublin-2', [
        { kind: 'weekly', weekdays: [6], time: '19:00', anticipates: 'next-day', confidence: 0.45 },
      ]),
    },
  },
  {
    church: {
      id: 'example:no-times',
      name: 'Example Church With No Times Known (EXAMPLE — not a real church)',
      lat: 53.3561,
      lon: -6.2489,
      timezone: 'Europe/Dublin',
      countryCode: 'IE',
      phone: '+353 1 000 0001',
      rite: 'roman',
      identification: 'name-inferred',
      sources: [seedSource],
      example: true,
    },
    schedule: { churchId: 'example:no-times', quality: 'unknown', rules: [] },
  },
  {
    church: {
      id: 'example:kochi',
      name: 'Example Syro-Malabar Parish (EXAMPLE — not a real church)',
      lat: 9.9312,
      lon: 76.2673,
      timezone: 'Asia/Kolkata',
      countryCode: 'IN',
      address: { city: 'Demo City', country: 'IN' },
      rite: 'syro-malabar',
      identification: 'tagged-catholic',
      sources: [seedSource],
      example: true,
    },
    schedule: {
      churchId: 'example:kochi',
      quality: 'parish-website',
      lastCheckedAt: new Date().toISOString(),
      rules: rules('example:kochi', [
        { kind: 'weekly', weekdays: [0], time: '06:30', language: 'ml' },
        { kind: 'weekly', weekdays: [0], time: '08:00', language: 'en' },
      ]),
    },
  },
];

export function isDemoMode(): boolean {
  return process.env.MASSFINDER_DEMO === '1';
}

export function demoChurchById(id: string): DemoEntry | undefined {
  return DEMO_CHURCHES.find((d) => d.church.id === id);
}
