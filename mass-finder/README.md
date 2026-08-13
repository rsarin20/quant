# Mass Finder

**When and where is the next Catholic Mass?** One screen, in large type: the
time, the church, what is being celebrated, and a button that opens Google Maps
with the travel time.

Built for the person who actually needs it — often somebody in their seventies or
eighties who finds Google, ChatGPT and parish websites equally impenetrable, and
who cannot afford to travel to a church that turns out to be locked.

```bash
npm install
npm test                        # 55 tests, no network needed
MASSFINDER_DEMO=1 npm run dev   # see the interface with invented example parishes
npm run dev                     # the real thing (needs outbound network)
```

---

## The two hard problems

The interface is the easy part. Everything difficult sits in two questions.

### 1. How do you find a Catholic church anywhere in the world?

Every obvious answer fails the "every country, city and town" test:

| Source | Why not |
| --- | --- |
| Diocesan directories | Authoritative, but ~3,000 dioceses each with its own site, format and language. A correctness layer to add later, hopeless as a starting point. |
| Google Places | Best coverage, but needs a billed API key, and its terms forbid storing and redistributing the place data an offline-capable app needs. |
| masstimes.org and similar | Regional, no public API, and bulk-scraping them is neither polite nor legal. |

**OpenStreetMap** is the only dataset that is genuinely global, openly licensed,
key-free and queryable by bounding box. It holds several hundred thousand
Catholic places of worship. `src/lib/churches/overpass.ts` queries it.

Its weakness is uneven tagging, and the app is explicit about that rather than
papering over it. Two passes with different confidence:

- `denomination=catholic` (and the Eastern Catholic variants) → presented as a
  Catholic church.
- `religion=christian` with no denomination, matched against Catholic naming
  patterns in a dozen languages → presented as *"we believe this is Catholic —
  please check before travelling."*

Timezones are resolved offline from coordinates (`tz-lookup`). A Mass time is a
wall-clock time in the parish's own zone, and shipping one without its zone is
how you tell a traveller Mass is at the wrong hour.

### 2. How do you extract the Mass times?

Parish websites are the least standardised corner of the public web. Times live
in hand-drawn tables, sidebar widgets, images, PDF bulletins, or one sentence in
the middle of a welcome message. Four layers, cheapest and most reliable first
(`src/lib/extract/pipeline.ts`):

| Layer | Source | Confidence |
| --- | --- | --- |
| 1 | OpenStreetMap `service_times` tag | 0.45 — community-maintained, often years stale |
| 2 | The parish's own website, crawled one hop from the homepage | — |
| 3 | Deterministic text matching over those pages | 0.40 — works with no API key |
| 4 | Claude reading the same pages | 0.82 — after verification |

Layers 3 and 4 read the *same* fetched pages, so the model costs one API call
rather than another round of traffic to a volunteer-run parish server.

#### The one thing that must not happen

A model asked for Mass times will always produce plausible Mass times. A
hallucinated "Sunday 10:00" is indistinguishable from a correct one, and the
person it fails is standing outside a locked church. So the model is treated as a
*proposer whose proposals are checked*, never as an oracle
(`src/lib/extract/llm.ts`):

1. Every reported Mass must carry a **verbatim quote** from the page — exact
   characters, not a paraphrase.
2. The quote must actually occur in the page text we fetched.
3. The claimed time must actually occur in that text, in any format a parish
   might have written it (`6.30pm`, `18:30`, `18h30`, `noon`).
4. Anything failing (2) or (3) is **discarded**, not down-weighted.

It cannot invent a Mass, because it cannot invent a quote that exists in text it
did not write. The UI always offers to show you the quote it was read from.

---

## The liturgical calendar

The brief was right that this is the complicated part. Masses are not just
Sundays, and a listing that treats them as such is wrong on the days that matter
most. `src/lib/liturgy/` computes the Roman Rite calendar from first principles —
no lookup tables, any year.

**Two anchors, everything else is arithmetic.** Gregorian Easter via the
anonymous Gregorian algorithm (`computus.ts`), and Christmas. From Easter:
Ash Wednesday, the Sundays of Lent, Holy Week, the Triduum, the Easter Octave,
Ascension, Pentecost, Trinity, Corpus Christi, the Sacred Heart, Christ the King.
From Christmas: Advent, the Christmas Octave, Holy Family, Epiphany, the Baptism
of the Lord. Ordinary Time is numbered forward from the Baptism and *backwards*
from Advent, so Christ the King always lands in week 34.

**The precedence table is not "highest rank wins."** `calendar.ts` implements the
Table of Liturgical Days including the cases where a naive implementation gives a
plausible wrong answer:

- A solemnity landing on a Sunday of Advent, Lent or Easter is **transferred**,
  not dropped. The Annunciation in Holy Week moves to the Monday after the Second
  Sunday of Easter — in 2024, to 8 April. The Immaculate Conception on the Second
  Sunday of Advent moves to 9 December — as it did in 2024.
- **All Souls** is the one commemoration that outranks a Sunday in Ordinary Time.
- An **optional** memorial never displaces the day it falls on. The weekday Mass
  is the default; the memorial is something the parish *may* keep. (This one was
  caught by running the app and seeing it announce "Saints Pontian and
  Hippolytus" as the celebration of an ordinary Thursday in August.)
- A memorial impeded by a Lenten weekday survives as a commemoration.

**Days when Mass may not be celebrated.** On Good Friday there is no Mass
anywhere on earth; on Holy Saturday none until the Vigil after nightfall; on Holy
Thursday only one, in the evening. A parish with a "Friday 10:00" rule must not
have it projected onto Good Friday — that sends someone to a locked church on one
of the highest-attendance days of the year. `resolve.ts` enforces this.

**Vigils.** A Saturday evening Mass *is* the Sunday Mass (canon 1248 §1). It is
resolved to Sunday's liturgy, counts for the obligation, and is labelled
*"counts as your Sunday Mass"* — while still being listed under Saturday, where
you actually turn up.

### Holy days of obligation vary by country, and that changes the answer

Canon 1246 §1 lists ten days besides Sundays. Canon 1246 §2 lets each episcopal
conference suppress them or move them to a Sunday, and almost every conference
has — no two the same. So "is today a holy day of obligation?" has no universal
answer. `regions.ts` holds rules for 29 countries and territories:

```
$ npm run calendar -- 2026 US --obligations   # Jan 1, Dec 8, Dec 25
$ npm run calendar -- 2026 PL --obligations   # + Epiphany, Corpus Christi (Thu), Assumption
$ npm run calendar -- 2026 IE --obligations   # + St Patrick, Ascension (Thu)
$ npm run calendar -- --regions               # what we have, and how sure we are
```

The same date genuinely differs: Corpus Christi 2025 was Thursday 19 June in
Poland and Sunday 22 June in the United States. The Assumption on Saturday
15 August 2026 binds in Ireland and does *not* bind in the United States, which
abrogates it on Saturdays and Mondays. National **proper** calendars are
supported too — Ireland keeps Saint Patrick as a Solemnity, Mexico Our Lady of
Guadalupe, Brazil Our Lady of Aparecida.

#### Why the code admits what it does not know

These decrees change, are published locally, and sometimes vary by province.
Every region entry carries a confidence — `verified`, `likely` or `unverified` —
and **the interface is required to phrase itself differently for each**:

> *verified* → "This is a holy day of obligation in Ireland, so Catholics are
> expected to be at Mass."
>
> *unverified* → "In many countries this is a day when Catholics go to Mass. We
> are not certain about the rules where you are — your parish will know."

A confidently wrong "HOLY DAY OF OBLIGATION" banner is worse than a hedge,
because the error is invisible to the person relying on it. Current coverage:
6 verified, 13 likely, 10 unverified. **Verifying more countries against their
conferences' own decrees is the highest-value contribution to this repo.**

### Eastern Catholic churches

The Roman calendar applies to the Latin church. The Byzantine, Syro-Malabar,
Syro-Malankara, Maronite, Melkite, Chaldean and other Eastern Catholic churches
keep their own. Their parishes are found and shown, labelled with their rite, and
carry a standing warning that the feast days shown do not necessarily apply to
them. `computus.ts` also implements Julian Easter, which several of them follow.
Implementing those calendars properly is not done and is the largest known gap.

---

## Trust, and how it is shown

Every Mass time carries a `SourceRef` — where it came from, the verbatim quote,
and when it was last checked — from extraction all the way to the screen. Every
card shows one of these, in words as well as colour:

| | |
| --- | --- |
| **Reliable** | Confirmed by people who have been there / from the parish's own website |
| **Take care** | From a bulletin, or from community map data, which is often out of date |
| **Warning** | Someone has reported these times as wrong / we have no times at all |

One user report of "these times were wrong" flips a church to **Warning** for
everyone. The cost of a wasted journey is much higher than the cost of an
unnecessary caveat. Reports are append-only and anonymous — we want the
correction, not the person.

Where there are no times, the app says so plainly and offers the parish's phone
number. That is a better answer than a guess.

---

## Design for the actual user

`globals.css` is plain CSS, no framework, and every choice follows from who is
holding the phone: 20px base type (not 16px), 64px headline times, nothing
meaningful below 17px, 56px+ tap targets, contrast beyond WCAG AAA, no
information conveyed by colour alone, no icon without a text label, and buttons
that look like buttons. Zoom is never blocked. `12:00` renders as "12 noon" and
`00:00` as "Midnight", because "12:00 AM" genuinely confuses people and Christmas
Midnight Mass is one of the times you most need to get right.

The two ways in — share your location, type a place name — are offered as equals.
Plenty of older users have location switched off and will never turn it on.

---

## Layout

```
src/lib/liturgy/     computus · temporal · sanctoral · regions · calendar · explain
src/lib/churches/    overpass · geocode · geo · types
src/lib/schedule/    types (the rule model) · osmServiceTimes · heuristic · timezone · resolve
src/lib/extract/     crawl · llm · pipeline
src/lib/             service (orchestration) · store (caching) · maps · demo
src/app/             page · church/[id] · api/{nearby,church,search,report,status}
scripts/calendar.ts  print a liturgical year to check against a diocesan ordo
test/                55 tests: liturgy and schedule resolution
```

`GET /api/status?probe=1` reports whether the upstream services are reachable —
most failures of this app are a dependency being unreachable, and that looks
identical to "there are no churches near you" unless something tells you.

---

## Verifying the calendar yourself

The calendar is the part you cannot check by eye from the source. Every diocese
publishes an ordo, so dump the computed year and compare:

```bash
npm run calendar -- 2026 IE            # the whole year
npm run calendar -- 2026 US --month 4  # Holy Week and Easter
npm run calendar -- 2027 MX            # Guadalupe on an Advent Sunday
```

The test suite pins the cases most likely to be wrong against known real-world
answers: Easter for twelve reference years and every Sunday from 1600–2400, the
2024 Annunciation and Immaculate Conception transfers, All Souls displacing
Sunday in 2025, the Baptism of the Lord falling on Monday 8 January 2024, DST
boundaries, half-hour timezones, and Good Friday suppressing a daily-Mass rule.

---

## Known gaps

Stated plainly, because a Mass finder that overstates itself is the failure mode:

1. **Only 6 of 29 countries have verified holy-day rules.** The rest are marked
   `likely` or `unverified` and the UI hedges accordingly. This is the top
   priority.
2. **Eastern Catholic calendars are not implemented** — those parishes are found
   and labelled, but the feast days shown are Roman.
3. **Diocesan propers are not implemented.** A parish's own patronal feast and
   dedication anniversary (ranks 4, 8, 11) are real solemnities and feasts there,
   and we do not know them.
4. **No image or JavaScript-rendered extraction.** Times published only inside a
   graphic, or injected by client-side script, are invisible to the crawler.
5. **Coverage depends on OpenStreetMap**, which is thinner in some countries than
   others, and on parishes having websites — which many, especially in the global
   south, do not. The phone number is the fallback.
6. **No de-duplication across sources.** Two OSM entries for one church appear
   twice.
7. **Confessions, Adoration and other devotions are deliberately excluded.** The
   extractor is told to skip them. Many people want them; that is a later feature,
   not a silent inclusion.

---

## Attribution and licence

Church locations come from **OpenStreetMap contributors**, licensed under the
[Open Database Licence](https://www.openstreetmap.org/copyright). The attribution
is displayed in the app, as the licence requires.

Mass times are gathered from parish websites and community map data. They can be
wrong or out of date. **If a time matters — a funeral, a feast day, a long
journey — ring the parish first.** The app says this too, on every screen.
