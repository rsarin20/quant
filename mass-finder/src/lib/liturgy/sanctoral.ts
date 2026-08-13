import { Rank, type Celebration, type Colour } from './types';

/**
 * The sanctoral cycle of the General Roman Calendar: celebrations attached to a
 * fixed calendar date.
 *
 * Coverage is complete for every solemnity and feast, and for the obligatory
 * memorials. Optional memorials are included where a parish is likely to
 * advertise a Mass for them (patronal titles, popular devotions). Anything a
 * particular diocese or country adds on top of this is a *proper* calendar,
 * handled separately in `propers.ts` — this file is the universal floor.
 */

interface FixedEntry {
  month: number;
  day: number;
  id: string;
  name: string;
  rank: Rank;
  colour: Colour;
  ofTheLord?: boolean;
  ofMary?: boolean;
  about?: string;
}

const M = Rank.MEMORIAL;
const O = Rank.OPTIONAL_MEMORIAL;
const F = Rank.FEAST;
const FL = Rank.FEAST_OF_THE_LORD;
const S = Rank.SOLEMNITY;

// Colour shorthands.
const w: Colour = 'white';
const r: Colour = 'red';

const FIXED: FixedEntry[] = [
  // ── January ───────────────────────────────────────────────────────────────
  { month: 1, day: 1, id: 'mary-mother-of-god', name: 'Mary, the Holy Mother of God', rank: S, colour: w, ofMary: true, about: 'The Church honours Mary as the Mother of God on the eighth day of Christmas — the same day as the New Year.' },
  { month: 1, day: 2, id: 'ss-basil-gregory', name: 'Saints Basil the Great and Gregory Nazianzen', rank: M, colour: w },
  { month: 1, day: 3, id: 'holy-name-of-jesus', name: 'The Most Holy Name of Jesus', rank: O, colour: w, ofTheLord: true },
  { month: 1, day: 6, id: 'epiphany', name: 'The Epiphany of the Lord', rank: Rank.PRIVILEGED, colour: w, ofTheLord: true, about: 'The day the Wise Men found the child Jesus — Christ shown to all the nations. In many countries it is moved to a Sunday.' },
  { month: 1, day: 7, id: 'st-raymond-of-penyafort', name: 'Saint Raymond of Penyafort', rank: O, colour: w },
  { month: 1, day: 13, id: 'st-hilary', name: 'Saint Hilary of Poitiers', rank: O, colour: w },
  { month: 1, day: 17, id: 'st-antony-abbot', name: 'Saint Antony, Abbot', rank: M, colour: w },
  { month: 1, day: 20, id: 'st-fabian', name: 'Saint Fabian', rank: O, colour: r },
  { month: 1, day: 20, id: 'st-sebastian', name: 'Saint Sebastian', rank: O, colour: r },
  { month: 1, day: 21, id: 'st-agnes', name: 'Saint Agnes', rank: M, colour: r },
  { month: 1, day: 22, id: 'st-vincent-deacon', name: 'Saint Vincent, Deacon and Martyr', rank: O, colour: r },
  { month: 1, day: 24, id: 'st-francis-de-sales', name: 'Saint Francis de Sales', rank: M, colour: w },
  { month: 1, day: 25, id: 'conversion-of-st-paul', name: 'The Conversion of Saint Paul the Apostle', rank: F, colour: w },
  { month: 1, day: 26, id: 'ss-timothy-titus', name: 'Saints Timothy and Titus', rank: M, colour: w },
  { month: 1, day: 27, id: 'st-angela-merici', name: 'Saint Angela Merici', rank: O, colour: w },
  { month: 1, day: 28, id: 'st-thomas-aquinas', name: 'Saint Thomas Aquinas', rank: M, colour: w },
  { month: 1, day: 31, id: 'st-john-bosco', name: 'Saint John Bosco', rank: M, colour: w },

  // ── February ──────────────────────────────────────────────────────────────
  { month: 2, day: 2, id: 'presentation-of-the-lord', name: 'The Presentation of the Lord', rank: FL, colour: w, ofTheLord: true, about: 'Candlemas — Jesus is presented in the Temple. Candles are blessed at Mass.' },
  { month: 2, day: 3, id: 'st-blase', name: 'Saint Blase', rank: O, colour: r, about: 'Throats are traditionally blessed at Mass on this day.' },
  { month: 2, day: 3, id: 'st-ansgar', name: 'Saint Ansgar', rank: O, colour: w },
  { month: 2, day: 5, id: 'st-agatha', name: 'Saint Agatha', rank: M, colour: r },
  { month: 2, day: 6, id: 'st-paul-miki', name: 'Saints Paul Miki and Companions', rank: M, colour: r },
  { month: 2, day: 8, id: 'st-jerome-emiliani', name: 'Saint Jerome Emiliani', rank: O, colour: w },
  { month: 2, day: 8, id: 'st-josephine-bakhita', name: 'Saint Josephine Bakhita', rank: O, colour: w },
  { month: 2, day: 10, id: 'st-scholastica', name: 'Saint Scholastica', rank: M, colour: w },
  { month: 2, day: 11, id: 'our-lady-of-lourdes', name: 'Our Lady of Lourdes', rank: O, colour: w, ofMary: true },
  { month: 2, day: 14, id: 'ss-cyril-methodius', name: 'Saints Cyril and Methodius', rank: M, colour: w },
  { month: 2, day: 17, id: 'seven-founders-servites', name: 'The Seven Holy Founders of the Servite Order', rank: O, colour: w },
  { month: 2, day: 21, id: 'st-peter-damian', name: 'Saint Peter Damian', rank: O, colour: w },
  { month: 2, day: 22, id: 'chair-of-st-peter', name: 'The Chair of Saint Peter the Apostle', rank: F, colour: w },
  { month: 2, day: 23, id: 'st-polycarp', name: 'Saint Polycarp', rank: M, colour: r },
  { month: 2, day: 27, id: 'st-gregory-of-narek', name: 'Saint Gregory of Narek', rank: O, colour: w },

  // ── March ─────────────────────────────────────────────────────────────────
  { month: 3, day: 4, id: 'st-casimir', name: 'Saint Casimir', rank: O, colour: w },
  { month: 3, day: 7, id: 'ss-perpetua-felicity', name: 'Saints Perpetua and Felicity', rank: M, colour: r },
  { month: 3, day: 8, id: 'st-john-of-god', name: 'Saint John of God', rank: O, colour: w },
  { month: 3, day: 9, id: 'st-frances-of-rome', name: 'Saint Frances of Rome', rank: O, colour: w },
  { month: 3, day: 17, id: 'st-patrick', name: 'Saint Patrick', rank: O, colour: w },
  { month: 3, day: 18, id: 'st-cyril-of-jerusalem', name: 'Saint Cyril of Jerusalem', rank: O, colour: w },
  { month: 3, day: 19, id: 'st-joseph', name: 'Saint Joseph, Spouse of the Blessed Virgin Mary', rank: S, colour: w, about: 'The foster-father of Jesus, patron of workers and of the whole Church.' },
  { month: 3, day: 23, id: 'st-turibius', name: 'Saint Turibius of Mogrovejo', rank: O, colour: w },
  { month: 3, day: 25, id: 'annunciation', name: 'The Annunciation of the Lord', rank: S, colour: w, ofTheLord: true, about: 'The angel Gabriel asks Mary to be the mother of Jesus, and she says yes — nine months before Christmas.' },

  // ── April ─────────────────────────────────────────────────────────────────
  { month: 4, day: 2, id: 'st-francis-of-paola', name: 'Saint Francis of Paola', rank: O, colour: w },
  { month: 4, day: 4, id: 'st-isidore', name: 'Saint Isidore', rank: O, colour: w },
  { month: 4, day: 5, id: 'st-vincent-ferrer', name: 'Saint Vincent Ferrer', rank: O, colour: w },
  { month: 4, day: 7, id: 'st-john-baptist-de-la-salle', name: 'Saint John Baptist de la Salle', rank: M, colour: w },
  { month: 4, day: 11, id: 'st-stanislaus', name: 'Saint Stanislaus', rank: M, colour: r },
  { month: 4, day: 13, id: 'st-martin-i', name: 'Saint Martin I', rank: O, colour: r },
  { month: 4, day: 21, id: 'st-anselm', name: 'Saint Anselm', rank: O, colour: w },
  { month: 4, day: 23, id: 'st-george', name: 'Saint George', rank: O, colour: r },
  { month: 4, day: 23, id: 'st-adalbert', name: 'Saint Adalbert', rank: O, colour: r },
  { month: 4, day: 24, id: 'st-fidelis', name: 'Saint Fidelis of Sigmaringen', rank: O, colour: r },
  { month: 4, day: 25, id: 'st-mark', name: 'Saint Mark, Evangelist', rank: F, colour: r },
  { month: 4, day: 28, id: 'st-peter-chanel', name: 'Saint Peter Chanel', rank: O, colour: r },
  { month: 4, day: 28, id: 'st-louis-de-montfort', name: 'Saint Louis Grignion de Montfort', rank: O, colour: w },
  { month: 4, day: 29, id: 'st-catherine-of-siena', name: 'Saint Catherine of Siena', rank: M, colour: w },
  { month: 4, day: 30, id: 'st-pius-v', name: 'Saint Pius V', rank: O, colour: w },

  // ── May ───────────────────────────────────────────────────────────────────
  { month: 5, day: 1, id: 'st-joseph-the-worker', name: 'Saint Joseph the Worker', rank: O, colour: w },
  { month: 5, day: 2, id: 'st-athanasius', name: 'Saint Athanasius', rank: M, colour: w },
  { month: 5, day: 3, id: 'ss-philip-james', name: 'Saints Philip and James, Apostles', rank: F, colour: r },
  { month: 5, day: 10, id: 'st-john-of-avila', name: 'Saint John of Ávila', rank: O, colour: w },
  { month: 5, day: 12, id: 'ss-nereus-achilleus', name: 'Saints Nereus and Achilleus', rank: O, colour: r },
  { month: 5, day: 12, id: 'st-pancras', name: 'Saint Pancras', rank: O, colour: r },
  { month: 5, day: 13, id: 'our-lady-of-fatima', name: 'Our Lady of Fatima', rank: O, colour: w, ofMary: true },
  { month: 5, day: 14, id: 'st-matthias', name: 'Saint Matthias, Apostle', rank: F, colour: r },
  { month: 5, day: 18, id: 'st-john-i', name: 'Saint John I', rank: O, colour: r },
  { month: 5, day: 20, id: 'st-bernardine-of-siena', name: 'Saint Bernardine of Siena', rank: O, colour: w },
  { month: 5, day: 21, id: 'st-christopher-magallanes', name: 'Saint Christopher Magallanes and Companions', rank: O, colour: r },
  { month: 5, day: 22, id: 'st-rita', name: 'Saint Rita of Cascia', rank: O, colour: w },
  { month: 5, day: 25, id: 'st-bede', name: 'Saint Bede the Venerable', rank: O, colour: w },
  { month: 5, day: 25, id: 'st-gregory-vii', name: 'Saint Gregory VII', rank: O, colour: w },
  { month: 5, day: 25, id: 'st-mary-magdalene-de-pazzi', name: 'Saint Mary Magdalene de Pazzi', rank: O, colour: w },
  { month: 5, day: 26, id: 'st-philip-neri', name: 'Saint Philip Neri', rank: M, colour: w },
  { month: 5, day: 27, id: 'st-augustine-of-canterbury', name: 'Saint Augustine of Canterbury', rank: O, colour: w },
  { month: 5, day: 29, id: 'st-paul-vi', name: 'Saint Paul VI', rank: O, colour: w },
  { month: 5, day: 31, id: 'visitation', name: 'The Visitation of the Blessed Virgin Mary', rank: F, colour: w, ofMary: true },

  // ── June ──────────────────────────────────────────────────────────────────
  { month: 6, day: 1, id: 'st-justin', name: 'Saint Justin', rank: M, colour: r },
  { month: 6, day: 2, id: 'ss-marcellinus-peter', name: 'Saints Marcellinus and Peter', rank: O, colour: r },
  { month: 6, day: 3, id: 'st-charles-lwanga', name: 'Saints Charles Lwanga and Companions', rank: M, colour: r },
  { month: 6, day: 5, id: 'st-boniface', name: 'Saint Boniface', rank: M, colour: r },
  { month: 6, day: 6, id: 'st-norbert', name: 'Saint Norbert', rank: O, colour: w },
  { month: 6, day: 9, id: 'st-ephrem', name: 'Saint Ephrem', rank: O, colour: w },
  { month: 6, day: 11, id: 'st-barnabas', name: 'Saint Barnabas, Apostle', rank: M, colour: r },
  { month: 6, day: 13, id: 'st-antony-of-padua', name: 'Saint Antony of Padua', rank: M, colour: w },
  { month: 6, day: 19, id: 'st-romuald', name: 'Saint Romuald', rank: O, colour: w },
  { month: 6, day: 21, id: 'st-aloysius-gonzaga', name: 'Saint Aloysius Gonzaga', rank: M, colour: w },
  { month: 6, day: 22, id: 'st-paulinus-of-nola', name: 'Saint Paulinus of Nola', rank: O, colour: w },
  { month: 6, day: 22, id: 'ss-john-fisher-thomas-more', name: 'Saints John Fisher and Thomas More', rank: O, colour: r },
  { month: 6, day: 24, id: 'nativity-of-john-the-baptist', name: 'The Nativity of Saint John the Baptist', rank: S, colour: w, about: 'The birth of the cousin who would prepare the way for Jesus — six months before Christmas.' },
  { month: 6, day: 27, id: 'st-cyril-of-alexandria', name: 'Saint Cyril of Alexandria', rank: O, colour: w },
  { month: 6, day: 28, id: 'st-irenaeus', name: 'Saint Irenaeus', rank: M, colour: r },
  { month: 6, day: 29, id: 'ss-peter-paul', name: 'Saints Peter and Paul, Apostles', rank: S, colour: r, about: 'The two great apostles of Rome, celebrated together.' },
  { month: 6, day: 30, id: 'first-martyrs-of-rome', name: 'The First Martyrs of the Holy Roman Church', rank: O, colour: r },

  // ── July ──────────────────────────────────────────────────────────────────
  { month: 7, day: 3, id: 'st-thomas-apostle', name: 'Saint Thomas, Apostle', rank: F, colour: r },
  { month: 7, day: 4, id: 'st-elizabeth-of-portugal', name: 'Saint Elizabeth of Portugal', rank: O, colour: w },
  { month: 7, day: 5, id: 'st-antony-zaccaria', name: 'Saint Antony Zaccaria', rank: O, colour: w },
  { month: 7, day: 6, id: 'st-maria-goretti', name: 'Saint Maria Goretti', rank: O, colour: r },
  { month: 7, day: 9, id: 'st-augustine-zhao-rong', name: 'Saint Augustine Zhao Rong and Companions', rank: O, colour: r },
  { month: 7, day: 11, id: 'st-benedict', name: 'Saint Benedict', rank: M, colour: w },
  { month: 7, day: 13, id: 'st-henry', name: 'Saint Henry', rank: O, colour: w },
  { month: 7, day: 14, id: 'st-camillus-de-lellis', name: 'Saint Camillus de Lellis', rank: O, colour: w },
  { month: 7, day: 15, id: 'st-bonaventure', name: 'Saint Bonaventure', rank: M, colour: w },
  { month: 7, day: 16, id: 'our-lady-of-mount-carmel', name: 'Our Lady of Mount Carmel', rank: O, colour: w, ofMary: true },
  { month: 7, day: 20, id: 'st-apollinaris', name: 'Saint Apollinaris', rank: O, colour: r },
  { month: 7, day: 21, id: 'st-lawrence-of-brindisi', name: 'Saint Lawrence of Brindisi', rank: O, colour: w },
  { month: 7, day: 22, id: 'st-mary-magdalene', name: 'Saint Mary Magdalene', rank: F, colour: w },
  { month: 7, day: 23, id: 'st-bridget-of-sweden', name: 'Saint Bridget of Sweden', rank: O, colour: w },
  { month: 7, day: 24, id: 'st-sharbel', name: 'Saint Sharbel Makhlūf', rank: O, colour: w },
  { month: 7, day: 25, id: 'st-james-apostle', name: 'Saint James, Apostle', rank: F, colour: r },
  { month: 7, day: 26, id: 'ss-joachim-anne', name: 'Saints Joachim and Anne', rank: M, colour: w, about: 'The parents of Mary — the grandparents of Jesus.' },
  { month: 7, day: 29, id: 'ss-martha-mary-lazarus', name: 'Saints Martha, Mary and Lazarus', rank: M, colour: w },
  { month: 7, day: 30, id: 'st-peter-chrysologus', name: 'Saint Peter Chrysologus', rank: O, colour: w },
  { month: 7, day: 31, id: 'st-ignatius-of-loyola', name: 'Saint Ignatius of Loyola', rank: M, colour: w },

  // ── August ────────────────────────────────────────────────────────────────
  { month: 8, day: 1, id: 'st-alphonsus-liguori', name: 'Saint Alphonsus Maria de Liguori', rank: M, colour: w },
  { month: 8, day: 2, id: 'st-eusebius-of-vercelli', name: 'Saint Eusebius of Vercelli', rank: O, colour: w },
  { month: 8, day: 2, id: 'st-peter-julian-eymard', name: 'Saint Peter Julian Eymard', rank: O, colour: w },
  { month: 8, day: 4, id: 'st-john-vianney', name: 'Saint John Vianney', rank: M, colour: w, about: 'The Curé of Ars, patron saint of parish priests.' },
  { month: 8, day: 5, id: 'dedication-st-mary-major', name: 'The Dedication of the Basilica of Saint Mary Major', rank: O, colour: w, ofMary: true },
  { month: 8, day: 6, id: 'transfiguration', name: 'The Transfiguration of the Lord', rank: FL, colour: w, ofTheLord: true, about: 'Jesus shines with glory on the mountain before Peter, James and John.' },
  { month: 8, day: 7, id: 'st-sixtus-ii', name: 'Saint Sixtus II and Companions', rank: O, colour: r },
  { month: 8, day: 7, id: 'st-cajetan', name: 'Saint Cajetan', rank: O, colour: w },
  { month: 8, day: 8, id: 'st-dominic', name: 'Saint Dominic', rank: M, colour: w },
  { month: 8, day: 9, id: 'st-teresa-benedicta', name: 'Saint Teresa Benedicta of the Cross', rank: O, colour: r },
  { month: 8, day: 10, id: 'st-lawrence-deacon', name: 'Saint Lawrence, Deacon and Martyr', rank: F, colour: r },
  { month: 8, day: 11, id: 'st-clare', name: 'Saint Clare', rank: M, colour: w },
  { month: 8, day: 12, id: 'st-jane-frances-de-chantal', name: 'Saint Jane Frances de Chantal', rank: O, colour: w },
  { month: 8, day: 13, id: 'ss-pontian-hippolytus', name: 'Saints Pontian and Hippolytus', rank: O, colour: r },
  { month: 8, day: 14, id: 'st-maximilian-kolbe', name: 'Saint Maximilian Mary Kolbe', rank: M, colour: r },
  { month: 8, day: 15, id: 'assumption', name: 'The Assumption of the Blessed Virgin Mary', rank: S, colour: w, ofMary: true, about: 'Mary is taken up body and soul into heaven at the end of her earthly life.' },
  { month: 8, day: 16, id: 'st-stephen-of-hungary', name: 'Saint Stephen of Hungary', rank: O, colour: w },
  { month: 8, day: 19, id: 'st-john-eudes', name: 'Saint John Eudes', rank: O, colour: w },
  { month: 8, day: 20, id: 'st-bernard', name: 'Saint Bernard', rank: M, colour: w },
  { month: 8, day: 21, id: 'st-pius-x', name: 'Saint Pius X', rank: M, colour: w },
  { month: 8, day: 22, id: 'queenship-of-mary', name: 'The Queenship of the Blessed Virgin Mary', rank: M, colour: w, ofMary: true },
  { month: 8, day: 23, id: 'st-rose-of-lima', name: 'Saint Rose of Lima', rank: O, colour: w },
  { month: 8, day: 24, id: 'st-bartholomew', name: 'Saint Bartholomew, Apostle', rank: F, colour: r },
  { month: 8, day: 25, id: 'st-louis', name: 'Saint Louis', rank: O, colour: w },
  { month: 8, day: 25, id: 'st-joseph-calasanz', name: 'Saint Joseph Calasanz', rank: O, colour: w },
  { month: 8, day: 27, id: 'st-monica', name: 'Saint Monica', rank: M, colour: w },
  { month: 8, day: 28, id: 'st-augustine', name: 'Saint Augustine', rank: M, colour: w },
  { month: 8, day: 29, id: 'passion-of-john-the-baptist', name: 'The Passion of Saint John the Baptist', rank: M, colour: r },

  // ── September ─────────────────────────────────────────────────────────────
  { month: 9, day: 3, id: 'st-gregory-the-great', name: 'Saint Gregory the Great', rank: M, colour: w },
  { month: 9, day: 8, id: 'nativity-of-mary', name: 'The Nativity of the Blessed Virgin Mary', rank: F, colour: w, ofMary: true, about: "Mary's birthday." },
  { month: 9, day: 9, id: 'st-peter-claver', name: 'Saint Peter Claver', rank: O, colour: w },
  { month: 9, day: 12, id: 'holy-name-of-mary', name: 'The Most Holy Name of Mary', rank: O, colour: w, ofMary: true },
  { month: 9, day: 13, id: 'st-john-chrysostom', name: 'Saint John Chrysostom', rank: M, colour: w },
  { month: 9, day: 14, id: 'exaltation-of-the-cross', name: 'The Exaltation of the Holy Cross', rank: FL, colour: r, ofTheLord: true, about: 'The Cross is honoured as the instrument of our salvation.' },
  { month: 9, day: 15, id: 'our-lady-of-sorrows', name: 'Our Lady of Sorrows', rank: M, colour: w, ofMary: true },
  { month: 9, day: 16, id: 'ss-cornelius-cyprian', name: 'Saints Cornelius and Cyprian', rank: M, colour: r },
  { month: 9, day: 17, id: 'st-robert-bellarmine', name: 'Saint Robert Bellarmine', rank: O, colour: w },
  { month: 9, day: 17, id: 'st-hildegard-of-bingen', name: 'Saint Hildegard of Bingen', rank: O, colour: w },
  { month: 9, day: 19, id: 'st-januarius', name: 'Saint Januarius', rank: O, colour: r },
  { month: 9, day: 20, id: 'st-andrew-kim-taegon', name: 'Saints Andrew Kim Taegon and Companions', rank: M, colour: r },
  { month: 9, day: 21, id: 'st-matthew', name: 'Saint Matthew, Apostle and Evangelist', rank: F, colour: r },
  { month: 9, day: 23, id: 'st-pio-of-pietrelcina', name: 'Saint Pius of Pietrelcina', rank: M, colour: w, about: 'Padre Pio.' },
  { month: 9, day: 26, id: 'ss-cosmas-damian', name: 'Saints Cosmas and Damian', rank: O, colour: r },
  { month: 9, day: 27, id: 'st-vincent-de-paul', name: 'Saint Vincent de Paul', rank: M, colour: w },
  { month: 9, day: 28, id: 'st-wenceslaus', name: 'Saint Wenceslaus', rank: O, colour: r },
  { month: 9, day: 28, id: 'st-lawrence-ruiz', name: 'Saint Lawrence Ruiz and Companions', rank: O, colour: r },
  { month: 9, day: 29, id: 'ss-michael-gabriel-raphael', name: 'Saints Michael, Gabriel and Raphael, Archangels', rank: F, colour: w },
  { month: 9, day: 30, id: 'st-jerome', name: 'Saint Jerome', rank: M, colour: w },

  // ── October ───────────────────────────────────────────────────────────────
  { month: 10, day: 1, id: 'st-therese-of-lisieux', name: 'Saint Thérèse of the Child Jesus', rank: M, colour: w },
  { month: 10, day: 2, id: 'guardian-angels', name: 'The Holy Guardian Angels', rank: M, colour: w },
  { month: 10, day: 4, id: 'st-francis-of-assisi', name: 'Saint Francis of Assisi', rank: M, colour: w },
  { month: 10, day: 5, id: 'st-faustina', name: 'Saint Faustina Kowalska', rank: O, colour: w },
  { month: 10, day: 6, id: 'st-bruno', name: 'Saint Bruno', rank: O, colour: w },
  { month: 10, day: 7, id: 'our-lady-of-the-rosary', name: 'Our Lady of the Rosary', rank: M, colour: w, ofMary: true },
  { month: 10, day: 9, id: 'st-denis', name: 'Saint Denis and Companions', rank: O, colour: r },
  { month: 10, day: 9, id: 'st-john-leonardi', name: 'Saint John Leonardi', rank: O, colour: w },
  { month: 10, day: 11, id: 'st-john-xxiii', name: 'Saint John XXIII', rank: O, colour: w },
  { month: 10, day: 14, id: 'st-callistus-i', name: 'Saint Callistus I', rank: O, colour: r },
  { month: 10, day: 15, id: 'st-teresa-of-avila', name: 'Saint Teresa of Jesus', rank: M, colour: w },
  { month: 10, day: 16, id: 'st-hedwig', name: 'Saint Hedwig', rank: O, colour: w },
  { month: 10, day: 16, id: 'st-margaret-mary-alacoque', name: 'Saint Margaret Mary Alacoque', rank: O, colour: w },
  { month: 10, day: 17, id: 'st-ignatius-of-antioch', name: 'Saint Ignatius of Antioch', rank: M, colour: r },
  { month: 10, day: 18, id: 'st-luke', name: 'Saint Luke, Evangelist', rank: F, colour: r },
  { month: 10, day: 19, id: 'ss-john-de-brebeuf-isaac-jogues', name: 'Saints John de Brébeuf and Isaac Jogues and Companions', rank: O, colour: r },
  { month: 10, day: 19, id: 'st-paul-of-the-cross', name: 'Saint Paul of the Cross', rank: O, colour: w },
  { month: 10, day: 22, id: 'st-john-paul-ii', name: 'Saint John Paul II', rank: O, colour: w },
  { month: 10, day: 23, id: 'st-john-of-capistrano', name: 'Saint John of Capistrano', rank: O, colour: w },
  { month: 10, day: 24, id: 'st-antony-mary-claret', name: 'Saint Antony Mary Claret', rank: O, colour: w },
  { month: 10, day: 28, id: 'ss-simon-jude', name: 'Saints Simon and Jude, Apostles', rank: F, colour: r },

  // ── November ──────────────────────────────────────────────────────────────
  { month: 11, day: 1, id: 'all-saints', name: 'All Saints', rank: S, colour: w, about: 'Every saint in heaven, known and unknown, honoured on one day.' },
  // All Souls has its own rank note: it outranks a Sunday in Ordinary Time.
  { month: 11, day: 2, id: 'all-souls', name: 'The Commemoration of All the Faithful Departed', rank: S, colour: 'violet', about: 'A day of prayer for everyone who has died. Priests may celebrate three Masses.' },
  { month: 11, day: 3, id: 'st-martin-de-porres', name: 'Saint Martin de Porres', rank: O, colour: w },
  { month: 11, day: 4, id: 'st-charles-borromeo', name: 'Saint Charles Borromeo', rank: M, colour: w },
  { month: 11, day: 9, id: 'dedication-lateran-basilica', name: 'The Dedication of the Lateran Basilica', rank: FL, colour: w, ofTheLord: true },
  { month: 11, day: 10, id: 'st-leo-the-great', name: 'Saint Leo the Great', rank: M, colour: w },
  { month: 11, day: 11, id: 'st-martin-of-tours', name: 'Saint Martin of Tours', rank: M, colour: w },
  { month: 11, day: 12, id: 'st-josaphat', name: 'Saint Josaphat', rank: M, colour: r },
  { month: 11, day: 15, id: 'st-albert-the-great', name: 'Saint Albert the Great', rank: O, colour: w },
  { month: 11, day: 16, id: 'st-margaret-of-scotland', name: 'Saint Margaret of Scotland', rank: O, colour: w },
  { month: 11, day: 16, id: 'st-gertrude', name: 'Saint Gertrude', rank: O, colour: w },
  { month: 11, day: 17, id: 'st-elizabeth-of-hungary', name: 'Saint Elizabeth of Hungary', rank: M, colour: w },
  { month: 11, day: 18, id: 'dedication-basilicas-peter-paul', name: 'The Dedication of the Basilicas of Saints Peter and Paul', rank: O, colour: w },
  { month: 11, day: 21, id: 'presentation-of-mary', name: 'The Presentation of the Blessed Virgin Mary', rank: M, colour: w, ofMary: true },
  { month: 11, day: 22, id: 'st-cecilia', name: 'Saint Cecilia', rank: M, colour: r },
  { month: 11, day: 23, id: 'st-clement-i', name: 'Saint Clement I', rank: O, colour: r },
  { month: 11, day: 23, id: 'st-columban', name: 'Saint Columban', rank: O, colour: w },
  { month: 11, day: 24, id: 'st-andrew-dung-lac', name: 'Saint Andrew Dũng-Lạc and Companions', rank: M, colour: r },
  { month: 11, day: 25, id: 'st-catherine-of-alexandria', name: 'Saint Catherine of Alexandria', rank: O, colour: r },
  { month: 11, day: 30, id: 'st-andrew-apostle', name: 'Saint Andrew, Apostle', rank: F, colour: r },

  // ── December ──────────────────────────────────────────────────────────────
  { month: 12, day: 3, id: 'st-francis-xavier', name: 'Saint Francis Xavier', rank: M, colour: w },
  { month: 12, day: 4, id: 'st-john-damascene', name: 'Saint John Damascene', rank: O, colour: w },
  { month: 12, day: 6, id: 'st-nicholas', name: 'Saint Nicholas', rank: O, colour: w },
  { month: 12, day: 7, id: 'st-ambrose', name: 'Saint Ambrose', rank: M, colour: w },
  { month: 12, day: 8, id: 'immaculate-conception', name: 'The Immaculate Conception of the Blessed Virgin Mary', rank: S, colour: w, ofMary: true, about: 'Mary was preserved free from sin from the very first moment of her life.' },
  { month: 12, day: 9, id: 'st-juan-diego', name: 'Saint Juan Diego Cuauhtlatoatzin', rank: O, colour: w },
  { month: 12, day: 10, id: 'our-lady-of-loreto', name: 'Our Lady of Loreto', rank: O, colour: w, ofMary: true },
  { month: 12, day: 11, id: 'st-damasus-i', name: 'Saint Damasus I', rank: O, colour: w },
  { month: 12, day: 12, id: 'our-lady-of-guadalupe', name: 'Our Lady of Guadalupe', rank: O, colour: w, ofMary: true, about: 'Mary appears to Juan Diego in Mexico — patroness of all the Americas.' },
  { month: 12, day: 13, id: 'st-lucy', name: 'Saint Lucy', rank: M, colour: r },
  { month: 12, day: 14, id: 'st-john-of-the-cross', name: 'Saint John of the Cross', rank: M, colour: w },
  { month: 12, day: 21, id: 'st-peter-canisius', name: 'Saint Peter Canisius', rank: O, colour: w },
  { month: 12, day: 23, id: 'st-john-of-kanty', name: 'Saint John of Kęty', rank: O, colour: w },
  { month: 12, day: 25, id: 'christmas', name: 'The Nativity of the Lord', rank: Rank.PRIVILEGED, colour: w, ofTheLord: true, about: 'Christmas — the birth of Jesus Christ.' },
  { month: 12, day: 26, id: 'st-stephen', name: 'Saint Stephen, First Martyr', rank: F, colour: r },
  { month: 12, day: 27, id: 'st-john-apostle', name: 'Saint John, Apostle and Evangelist', rank: F, colour: w },
  { month: 12, day: 28, id: 'holy-innocents', name: 'The Holy Innocents', rank: F, colour: r },
  { month: 12, day: 29, id: 'st-thomas-becket', name: 'Saint Thomas Becket', rank: O, colour: r },
  { month: 12, day: 31, id: 'st-sylvester-i', name: 'Saint Sylvester I', rank: O, colour: w },
];

const BY_KEY = new Map<string, FixedEntry[]>();
for (const e of FIXED) {
  const key = `${e.month}-${e.day}`;
  const list = BY_KEY.get(key);
  if (list) list.push(e);
  else BY_KEY.set(key, [e]);
}

function toCelebration(e: FixedEntry): Celebration {
  return {
    id: e.id,
    name: e.name,
    rank: e.rank,
    colour: e.colour,
    ofTheLord: e.ofTheLord,
    ofMary: e.ofMary,
    about: e.about,
    scope: 'universal',
  };
}

/** Every universal-calendar celebration assigned to the given month and day. */
export function sanctoralFor(month: number, day: number): Celebration[] {
  return (BY_KEY.get(`${month}-${day}`) ?? []).map(toCelebration);
}

/** Look up a fixed celebration by slug — used to resolve transfers. */
export function fixedCelebrationById(id: string): Celebration | undefined {
  const e = FIXED.find((x) => x.id === id);
  return e ? toCelebration(e) : undefined;
}

/** The date a fixed celebration normally falls on. */
export function fixedDateOf(id: string): { month: number; day: number } | undefined {
  const e = FIXED.find((x) => x.id === id);
  return e ? { month: e.month, day: e.day } : undefined;
}
