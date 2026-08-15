/**
 * The place hierarchy behind "browse to a church" — country, then region, then town.
 *
 * ## Why a bundled list at all
 *
 * Searching by name needs a geocoder, and a geocoder needs the person to already
 * know what to type. Someone planning a trip does not: they know they will be in
 * Switzerland, near Lucerne, and want to see what is there. Dropdowns answer that
 * question; a search box cannot, because it asks the reader to supply the answer.
 *
 * ## What this list is and is not
 *
 * It is the **top of the hierarchy only**: every country with a significant
 * Catholic population, and each one's major cities. It is not a gazetteer — there
 * are some four million populated places on earth and shipping them to a phone
 * would be indefensible. Below the city level the interface hands over to
 * Nominatim's search, which does know every town, and the map handles "somewhere
 * between two towns" better than any list could.
 *
 * So: dropdowns to get you to the right region, then a free-text town box and a
 * map for the last mile. Each does the part it is actually good at.
 *
 * Coordinates are the city centre; the search radius does the rest.
 */

export interface BrowseCity {
  name: string;
  lat: number;
  lon: number;
  /** State, province or canton, so the dropdown can group by it. */
  region?: string;
}

export interface BrowseCountry {
  /** ISO 3166-1 alpha-2 — the same code the holy-day rules are keyed by. */
  code: string;
  name: string;
  cities: BrowseCity[];
}

export const BROWSE_COUNTRIES: BrowseCountry[] = [
  {
    code: 'CH',
    name: 'Switzerland',
    cities: [
      { name: 'Zürich', lat: 47.3769, lon: 8.5417, region: 'Zürich' },
      { name: 'Geneva', lat: 46.2044, lon: 6.1432, region: 'Genève' },
      { name: 'Basel', lat: 47.5596, lon: 7.5886, region: 'Basel-Stadt' },
      { name: 'Bern', lat: 46.948, lon: 7.4474, region: 'Bern' },
      { name: 'Lausanne', lat: 46.5197, lon: 6.6323, region: 'Vaud' },
      { name: 'Lucerne', lat: 47.0502, lon: 8.3093, region: 'Luzern' },
      { name: 'Lugano', lat: 46.0037, lon: 8.9511, region: 'Ticino' },
      { name: 'St. Gallen', lat: 47.4245, lon: 9.3767, region: 'St. Gallen' },
      { name: 'Fribourg', lat: 46.8065, lon: 7.1619, region: 'Fribourg' },
      { name: 'Sion', lat: 46.2331, lon: 7.3606, region: 'Valais' },
    ],
  },
  {
    code: 'IE',
    name: 'Ireland',
    cities: [
      { name: 'Dublin', lat: 53.3498, lon: -6.2603 },
      { name: 'Cork', lat: 51.8985, lon: -8.4756 },
      { name: 'Galway', lat: 53.2707, lon: -9.0568 },
      { name: 'Limerick', lat: 52.6638, lon: -8.6267 },
      { name: 'Waterford', lat: 52.2593, lon: -7.11 },
      { name: 'Kilkenny', lat: 52.6541, lon: -7.2448 },
      { name: 'Sligo', lat: 54.2766, lon: -8.4761 },
      { name: 'Knock', lat: 53.7906, lon: -8.9186 },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    cities: [
      { name: 'London', lat: 51.5072, lon: -0.1276, region: 'England' },
      { name: 'Birmingham', lat: 52.4862, lon: -1.8904, region: 'England' },
      { name: 'Manchester', lat: 53.4808, lon: -2.2426, region: 'England' },
      { name: 'Liverpool', lat: 53.4084, lon: -2.9916, region: 'England' },
      { name: 'Leeds', lat: 53.8008, lon: -1.5491, region: 'England' },
      { name: 'Glasgow', lat: 55.8642, lon: -4.2518, region: 'Scotland' },
      { name: 'Edinburgh', lat: 55.9533, lon: -3.1883, region: 'Scotland' },
      { name: 'Cardiff', lat: 51.4816, lon: -3.1791, region: 'Wales' },
      { name: 'Belfast', lat: 54.5973, lon: -5.9301, region: 'Northern Ireland' },
    ],
  },
  {
    code: 'US',
    name: 'United States',
    cities: [
      { name: 'New York', lat: 40.7128, lon: -74.006, region: 'New York' },
      { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, region: 'California' },
      { name: 'Chicago', lat: 41.8781, lon: -87.6298, region: 'Illinois' },
      { name: 'Houston', lat: 29.7604, lon: -95.3698, region: 'Texas' },
      { name: 'Philadelphia', lat: 39.9526, lon: -75.1652, region: 'Pennsylvania' },
      { name: 'Boston', lat: 42.3601, lon: -71.0589, region: 'Massachusetts' },
      { name: 'San Francisco', lat: 37.7749, lon: -122.4194, region: 'California' },
      { name: 'Miami', lat: 25.7617, lon: -80.1918, region: 'Florida' },
      { name: 'New Orleans', lat: 29.9511, lon: -90.0715, region: 'Louisiana' },
      { name: 'Washington', lat: 38.9072, lon: -77.0369, region: 'District of Columbia' },
      { name: 'Detroit', lat: 42.3314, lon: -83.0458, region: 'Michigan' },
      { name: 'San Antonio', lat: 29.4241, lon: -98.4936, region: 'Texas' },
    ],
  },
  {
    code: 'IT',
    name: 'Italy',
    cities: [
      { name: 'Rome', lat: 41.9028, lon: 12.4964, region: 'Lazio' },
      { name: 'Milan', lat: 45.4642, lon: 9.19, region: 'Lombardy' },
      { name: 'Naples', lat: 40.8518, lon: 14.2681, region: 'Campania' },
      { name: 'Turin', lat: 45.0703, lon: 7.6869, region: 'Piedmont' },
      { name: 'Florence', lat: 43.7696, lon: 11.2558, region: 'Tuscany' },
      { name: 'Venice', lat: 45.4408, lon: 12.3155, region: 'Veneto' },
      { name: 'Bologna', lat: 44.4949, lon: 11.3426, region: 'Emilia-Romagna' },
      { name: 'Palermo', lat: 38.1157, lon: 13.3615, region: 'Sicily' },
      { name: 'Assisi', lat: 43.0707, lon: 12.6196, region: 'Umbria' },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    cities: [
      { name: 'Paris', lat: 48.8566, lon: 2.3522 },
      { name: 'Marseille', lat: 43.2965, lon: 5.3698 },
      { name: 'Lyon', lat: 45.764, lon: 4.8357 },
      { name: 'Toulouse', lat: 43.6047, lon: 1.4442 },
      { name: 'Nice', lat: 43.7102, lon: 7.262 },
      { name: 'Bordeaux', lat: 44.8378, lon: -0.5792 },
      { name: 'Strasbourg', lat: 48.5734, lon: 7.7521 },
      { name: 'Lille', lat: 50.6292, lon: 3.0573 },
      { name: 'Lourdes', lat: 43.0956, lon: -0.0458 },
    ],
  },
  {
    code: 'ES',
    name: 'Spain',
    cities: [
      { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
      { name: 'Barcelona', lat: 41.3874, lon: 2.1686 },
      { name: 'Valencia', lat: 39.4699, lon: -0.3763 },
      { name: 'Seville', lat: 37.3891, lon: -5.9845 },
      { name: 'Bilbao', lat: 43.263, lon: -2.935 },
      { name: 'Zaragoza', lat: 41.6488, lon: -0.8891 },
      { name: 'Santiago de Compostela', lat: 42.8782, lon: -8.5448 },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    cities: [
      { name: 'Berlin', lat: 52.52, lon: 13.405 },
      { name: 'Munich', lat: 48.1351, lon: 11.582, region: 'Bavaria' },
      { name: 'Cologne', lat: 50.9375, lon: 6.9603, region: 'North Rhine-Westphalia' },
      { name: 'Frankfurt', lat: 50.1109, lon: 8.6821, region: 'Hesse' },
      { name: 'Hamburg', lat: 53.5511, lon: 9.9937 },
      { name: 'Stuttgart', lat: 48.7758, lon: 9.1829, region: 'Baden-Württemberg' },
      { name: 'Münster', lat: 51.9607, lon: 7.6261, region: 'North Rhine-Westphalia' },
      { name: 'Dresden', lat: 51.0504, lon: 13.7373, region: 'Saxony' },
    ],
  },
  {
    code: 'AT',
    name: 'Austria',
    cities: [
      { name: 'Vienna', lat: 48.2082, lon: 16.3738 },
      { name: 'Salzburg', lat: 47.8095, lon: 13.055 },
      { name: 'Graz', lat: 47.0707, lon: 15.4395 },
      { name: 'Innsbruck', lat: 47.2692, lon: 11.4041 },
      { name: 'Linz', lat: 48.3069, lon: 14.2858 },
    ],
  },
  {
    code: 'PL',
    name: 'Poland',
    cities: [
      { name: 'Warsaw', lat: 52.2297, lon: 21.0122 },
      { name: 'Kraków', lat: 50.0647, lon: 19.945 },
      { name: 'Łódź', lat: 51.7592, lon: 19.4559 },
      { name: 'Wrocław', lat: 51.1079, lon: 17.0385 },
      { name: 'Poznań', lat: 52.4064, lon: 16.9252 },
      { name: 'Gdańsk', lat: 54.352, lon: 18.6466 },
      { name: 'Częstochowa', lat: 50.7971, lon: 19.1204 },
    ],
  },
  {
    code: 'PT',
    name: 'Portugal',
    cities: [
      { name: 'Lisbon', lat: 38.7223, lon: -9.1393 },
      { name: 'Porto', lat: 41.1579, lon: -8.6291 },
      { name: 'Braga', lat: 41.5454, lon: -8.4265 },
      { name: 'Fátima', lat: 39.6317, lon: -8.6722 },
    ],
  },
  {
    code: 'BR',
    name: 'Brazil',
    cities: [
      { name: 'São Paulo', lat: -23.5505, lon: -46.6333 },
      { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729 },
      { name: 'Brasília', lat: -15.7939, lon: -47.8828 },
      { name: 'Salvador', lat: -12.9777, lon: -38.5016 },
      { name: 'Belo Horizonte', lat: -19.9167, lon: -43.9345 },
      { name: 'Aparecida', lat: -22.8469, lon: -45.2278 },
    ],
  },
  {
    code: 'MX',
    name: 'Mexico',
    cities: [
      { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
      { name: 'Guadalajara', lat: 20.6597, lon: -103.3496 },
      { name: 'Monterrey', lat: 25.6866, lon: -100.3161 },
      { name: 'Puebla', lat: 19.0414, lon: -98.2063 },
    ],
  },
  {
    code: 'AR',
    name: 'Argentina',
    cities: [
      { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816 },
      { name: 'Córdoba', lat: -31.4201, lon: -64.1888 },
      { name: 'Rosario', lat: -32.9442, lon: -60.6505 },
    ],
  },
  {
    code: 'PH',
    name: 'Philippines',
    cities: [
      { name: 'Manila', lat: 14.5995, lon: 120.9842 },
      { name: 'Quezon City', lat: 14.676, lon: 121.0437 },
      { name: 'Cebu City', lat: 10.3157, lon: 123.8854 },
      { name: 'Davao City', lat: 7.1907, lon: 125.4553 },
    ],
  },
  {
    code: 'IN',
    name: 'India',
    cities: [
      { name: 'Mumbai', lat: 19.076, lon: 72.8777, region: 'Maharashtra' },
      { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, region: 'Karnataka' },
      { name: 'Chennai', lat: 13.0827, lon: 80.2707, region: 'Tamil Nadu' },
      { name: 'Kochi', lat: 9.9312, lon: 76.2673, region: 'Kerala' },
      { name: 'Goa (Panaji)', lat: 15.4909, lon: 73.8278, region: 'Goa' },
      { name: 'Delhi', lat: 28.6139, lon: 77.209, region: 'Delhi' },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    cities: [
      { name: 'Toronto', lat: 43.6532, lon: -79.3832, region: 'Ontario' },
      { name: 'Montreal', lat: 45.5019, lon: -73.5674, region: 'Quebec' },
      { name: 'Vancouver', lat: 49.2827, lon: -123.1207, region: 'British Columbia' },
      { name: 'Quebec City', lat: 46.8139, lon: -71.208, region: 'Quebec' },
      { name: 'Ottawa', lat: 45.4215, lon: -75.6972, region: 'Ontario' },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    cities: [
      { name: 'Sydney', lat: -33.8688, lon: 151.2093, region: 'New South Wales' },
      { name: 'Melbourne', lat: -37.8136, lon: 144.9631, region: 'Victoria' },
      { name: 'Brisbane', lat: -27.4698, lon: 153.0251, region: 'Queensland' },
      { name: 'Perth', lat: -31.9523, lon: 115.8613, region: 'Western Australia' },
      { name: 'Adelaide', lat: -34.9285, lon: 138.6007, region: 'South Australia' },
    ],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    cities: [
      { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
      { name: 'Rotterdam', lat: 51.9244, lon: 4.4777 },
      { name: 'Utrecht', lat: 52.0907, lon: 5.1214 },
      { name: "'s-Hertogenbosch", lat: 51.6978, lon: 5.3037 },
    ],
  },
  {
    code: 'BE',
    name: 'Belgium',
    cities: [
      { name: 'Brussels', lat: 50.8503, lon: 4.3517 },
      { name: 'Antwerp', lat: 51.2194, lon: 4.4025 },
      { name: 'Ghent', lat: 51.0543, lon: 3.7174 },
      { name: 'Bruges', lat: 51.2093, lon: 3.2247 },
    ],
  },
  {
    code: 'KR',
    name: 'South Korea',
    cities: [
      { name: 'Seoul', lat: 37.5665, lon: 126.978 },
      { name: 'Busan', lat: 35.1796, lon: 129.0756 },
      { name: 'Daegu', lat: 35.8714, lon: 128.6014 },
    ],
  },
  {
    code: 'NG',
    name: 'Nigeria',
    cities: [
      { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
      { name: 'Abuja', lat: 9.0765, lon: 7.3986 },
      { name: 'Onitsha', lat: 6.1414, lon: 6.8022 },
    ],
  },
  {
    code: 'KE',
    name: 'Kenya',
    cities: [
      { name: 'Nairobi', lat: -1.2864, lon: 36.8172 },
      { name: 'Mombasa', lat: -4.0435, lon: 39.6682 },
    ],
  },
  {
    code: 'VN',
    name: 'Vietnam',
    cities: [
      { name: 'Ho Chi Minh City', lat: 10.8231, lon: 106.6297 },
      { name: 'Hanoi', lat: 21.0278, lon: 105.8342 },
    ],
  },
  {
    code: 'VA',
    name: 'Vatican City',
    cities: [{ name: 'Vatican City', lat: 41.9022, lon: 12.4539 }],
  },
];

/** Countries in alphabetical order, for the first dropdown. */
export function countriesAlphabetical(): BrowseCountry[] {
  return [...BROWSE_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
}

export function countryByCode(code: string): BrowseCountry | undefined {
  return BROWSE_COUNTRIES.find((c) => c.code === code.toUpperCase());
}

/** Cities grouped by region, so a large country's dropdown stays navigable. */
export function citiesByRegion(
  country: BrowseCountry,
): Array<{ region: string | undefined; cities: BrowseCity[] }> {
  const groups = new Map<string | undefined, BrowseCity[]>();
  for (const city of country.cities) {
    const list = groups.get(city.region) ?? [];
    list.push(city);
    groups.set(city.region, list);
  }
  return Array.from(groups.entries())
    .map(([region, cities]) => ({
      region,
      cities: [...cities].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => (a.region ?? '').localeCompare(b.region ?? ''));
}
