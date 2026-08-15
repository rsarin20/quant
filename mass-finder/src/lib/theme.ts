import type { Colour } from './liturgy/types';

/**
 * A background that belongs to one church and one day.
 *
 * ## What "custom to each church" means here
 *
 * Two ingredients, and neither is an arbitrary decoration:
 *
 *  1. **The church's own photograph**, when Wikimedia Commons has one. Nothing is
 *     more specific to a building than a picture of it, and it doubles as the
 *     confirmation that a stranger is looking at the right door.
 *  2. **A stained-glass field derived from the church's identity**, when it has no
 *     photograph. The hue comes from a hash of the church's id, so St Anton in
 *     Zürich looks the same every visit and different from its neighbour — the
 *     variety is stable and recognisable rather than random.
 *
 * Both are then tinted by **today's liturgical colour**, which is the part that
 * makes it a holy theme rather than a pretty one. Green in Ordinary Time, violet
 * in Lent and Advent, white on solemnities, red for martyrs and Pentecost, rose on
 * Gaudete and Laetare. The Church has dressed its buildings by the season for
 * centuries; an app about the liturgical calendar should do the same, and a
 * regular churchgoer reads the colour faster than they read the words.
 *
 * ## Constraints this must respect
 *
 * Text sits on these backgrounds, and the audience is people with ageing eyes. So
 * every generated field is dark and low-contrast in itself, and the reading
 * surfaces are opaque cards on top of it rather than text floating on an image.
 * The theme is never the thing carrying the information.
 */

export interface ChurchTheme {
  /** Two hues for the field's gradient, in degrees. */
  hueA: number;
  hueB: number;
  /** The liturgical accent, as an HSL string. */
  accent: string;
  /** A quiet version of the accent for borders and rules. */
  accentSoft: string;
  /** Full CSS `background` value for the hero, photo or generated. */
  background: string;
  /** True when the background is the church's own photograph. */
  fromPhoto: boolean;
}

/**
 * Liturgical colours, as they actually look in a church rather than as their
 * names suggest. Vestment green is deep and slightly blue; liturgical red is
 * closer to blood than to pillarbox; "white" is the warm off-white of linen, and
 * rendering it pure white would glare on a screen.
 */
const LITURGICAL: Record<Colour, { h: number; s: number; l: number }> = {
  green: { h: 152, s: 42, l: 34 },
  violet: { h: governedHue(276), s: 38, l: 38 },
  white: { h: 44, s: 34, l: 62 },
  red: { h: 358, s: 52, l: 42 },
  rose: { h: 340, s: 46, l: 62 },
  black: { h: 220, s: 12, l: 26 },
  gold: { h: 42, s: 58, l: 50 },
};

/** Keeps the table honest if a hue is ever mistyped out of range. */
function governedHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

/**
 * A stable hash of the church id.
 *
 * FNV-1a: tiny, no dependency, and well distributed enough that neighbouring OSM
 * ids — which differ by one digit — land on visibly different hues. A modulo of
 * the raw id would have given the whole street the same colour.
 */
function hashOf(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Hues chosen from the palette of church glass rather than the whole wheel.
 *
 * An unconstrained hue produces the occasional lurid orange or acid yellow, which
 * reads as a bug in an app about a church. These are the ranges that actually
 * appear in stained glass: deep blues, indigos, wine reds, forest greens, amber.
 */
const GLASS_HUES = [214, 232, 258, 284, 318, 346, 14, 34, 152, 178];

export interface ThemeInput {
  churchId: string;
  /** Today's liturgical colour at this church. */
  colour: Colour;
  /** The church's photograph, when it has one. */
  photoUrl?: string;
}

export function themeFor(input: ThemeInput): ChurchTheme {
  const hash = hashOf(input.churchId);
  const hueA = GLASS_HUES[hash % GLASS_HUES.length];
  // A second hue a deliberate distance away, so the gradient reads as glass
  // panels meeting rather than as a single colour fading out.
  const hueB = GLASS_HUES[(hash >>> 8) % GLASS_HUES.length] === hueA
    ? GLASS_HUES[(hash >>> 8) % GLASS_HUES.length] + 42
    : GLASS_HUES[(hash >>> 8) % GLASS_HUES.length];

  const lit = LITURGICAL[input.colour] ?? LITURGICAL.green;
  const accent = `hsl(${lit.h} ${lit.s}% ${lit.l}%)`;
  const accentSoft = `hsl(${lit.h} ${Math.round(lit.s * 0.6)}% ${Math.min(88, lit.l + 34)}%)`;

  // The generated field. Two radial pools of colour over a dark ground, plus a
  // wash of the liturgical hue — the effect of light through glass onto stone.
  const generated = [
    `radial-gradient(120% 90% at 12% 8%, hsl(${hueA} 58% 26% / 0.95), transparent 62%)`,
    `radial-gradient(110% 80% at 88% 18%, hsl(${hueB} 54% 22% / 0.9), transparent 58%)`,
    `linear-gradient(178deg, hsl(${lit.h} ${lit.s}% 14% / 0.86), hsl(222 26% 9%))`,
  ].join(', ');

  const background = input.photoUrl
    // The scrim is not optional: a photograph of a sunlit white cathedral will
    // otherwise leave the heading unreadable. Darkened top and bottom, with the
    // liturgical hue laid over it so the season still shows.
    ? [
        `linear-gradient(180deg, hsl(222 30% 8% / 0.72), hsl(${lit.h} ${lit.s}% 12% / 0.62) 55%, hsl(222 30% 8% / 0.88))`,
        `url("${input.photoUrl}") center/cover no-repeat`,
      ].join(', ')
    : generated;

  return { hueA, hueB, accent, accentSoft, background, fromPhoto: !!input.photoUrl };
}

/** The theme as inline CSS custom properties, for a `style` attribute. */
export function themeStyle(theme: ChurchTheme): Record<string, string> {
  return {
    '--church-background': theme.background,
    '--church-accent': theme.accent,
    '--church-accent-soft': theme.accentSoft,
  };
}
