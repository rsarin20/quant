/**
 * Print a liturgical year, so it can be checked against a published ordo.
 *
 *   npm run calendar -- 2026 IE
 *   npm run calendar -- 2026 US --obligations
 *   npm run calendar -- 2026 PL --month 6
 *
 * This exists because the calendar engine is the part of Mass Finder that a
 * reader cannot verify by eye from the source. Every diocese publishes an ordo;
 * dumping the computed year in a readable form makes it a five-minute job to
 * check ours against theirs, and to find the year where they disagree.
 */

import { buildYear } from '../src/lib/liturgy/calendar';
import { allRegions, regionFor } from '../src/lib/liturgy/regions';
import { RANK_LABELS, SEASON_LABELS, Rank } from '../src/lib/liturgy/types';

const args = process.argv.slice(2);

function flag(name: string): boolean {
  return args.includes(`--${name}`);
}

function option(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

if (flag('help') || flag('regions')) {
  if (flag('regions')) {
    console.log('Countries with holy-day rules in this build:\n');
    for (const r of allRegions()) {
      console.log(
        `  ${r.code.padEnd(8)} ${r.name.padEnd(34)} ${r.confidence.padEnd(11)} ` +
          `Epiphany:${r.temporal.epiphany.padEnd(7)} Ascension:${r.temporal.ascension.padEnd(9)} Corpus:${r.temporal.corpusChristi}`,
      );
      if (r.note) console.log(`           ${r.note}`);
    }
    process.exit(0);
  }
  console.log(`Usage: npm run calendar -- <year> <country> [options]

Options:
  --obligations   Only days of obligation
  --solemnities   Only solemnities and feasts
  --month <n>     Only that month
  --regions       List the countries we have rules for, and exit
`);
  process.exit(0);
}

const year = Number(args[0]) || new Date().getUTCFullYear();
const countryArg = args[1] && !args[1].startsWith('--') ? args[1] : 'US';
const region = regionFor(countryArg);
const monthFilter = option('month') ? Number(option('month')) : undefined;

const days = buildYear(year, region);

console.log(`\nLiturgical year ${year} — ${region.name} (${region.code})`);
console.log(
  `Epiphany: ${region.temporal.epiphany === 'jan6' ? '6 January' : 'Sunday'} · ` +
    `Ascension: ${region.temporal.ascension} · Corpus Christi: ${region.temporal.corpusChristi}`,
);
console.log(`Holy-day rules confidence: ${region.confidence.toUpperCase()}`);
if (region.note) console.log(`Note: ${region.note}`);
console.log('='.repeat(100));

let lastSeason = '';
let shown = 0;

for (const [iso, day] of days) {
  if (monthFilter && Number(iso.slice(5, 7)) !== monthFilter) continue;
  if (flag('obligations') && !day.isHolyDayOfObligation) continue;
  if (flag('solemnities') && day.celebration.rank > Rank.PROPER_FEAST) continue;

  if (day.season !== lastSeason && !monthFilter && !flag('obligations')) {
    console.log(`\n── ${SEASON_LABELS[day.season].toUpperCase()} ──`);
    lastSeason = day.season;
  }

  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.weekday];
  const marks = [
    day.isHolyDayOfObligation ? 'OBLIGATION' : '',
    day.massRestriction === 'none' ? 'NO MASS' : '',
    day.massRestriction === 'vigil-only' ? 'VIGIL ONLY' : '',
    day.massRestriction === 'evening-only' ? 'EVENING ONLY' : '',
    day.celebration.scope === 'transferred' ? 'transferred' : '',
    day.celebration.scope === 'national' ? 'national' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Prefer the celebration's own display label: rank 2 covers both genuine
  // solemnities and the Sundays of Advent, Lent and Easter, so the rank alone
  // would print "Solemnity" against the Third Sunday of Lent.
  const kind = day.celebration.displayKind ?? RANK_LABELS[day.celebration.rank];

  console.log(
    `${iso} ${weekday}  ${day.celebration.name.padEnd(58).slice(0, 58)} ` +
      `${kind.padEnd(26)} ${day.colour.padEnd(7)} ${marks}`,
  );
  shown += 1;
}

console.log('='.repeat(100));
console.log(`${shown} days shown of ${days.size} in the year.`);

const obligations = Array.from(days.values()).filter(
  (d) => d.isHolyDayOfObligation && d.weekday !== 0,
);
console.log(`\nDays of obligation other than Sundays (${obligations.length}):`);
for (const d of obligations) {
  console.log(`  ${d.date}  ${d.celebration.name}`);
}
