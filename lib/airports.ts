// Liste embarquée d'aéroports majeurs (code IATA, nom, ville, pays, lat/lon approx).
// Utilisée pour l'autocomplete, le calcul de distance (€/km) et les alternatives.
export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export const AIRPORTS: Airport[] = [
  { iata: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', country: 'France', lat: 49.01, lon: 2.55 },
  { iata: 'ORY', name: 'Paris Orly', city: 'Paris', country: 'France', lat: 48.72, lon: 2.38 },
  { iata: 'BVA', name: 'Paris Beauvais', city: 'Paris', country: 'France', lat: 49.45, lon: 2.11 },
  { iata: 'NCE', name: 'Nice Côte d\'Azur', city: 'Nice', country: 'France', lat: 43.66, lon: 7.22 },
  { iata: 'LYS', name: 'Lyon Saint-Exupéry', city: 'Lyon', country: 'France', lat: 45.73, lon: 5.08 },
  { iata: 'MRS', name: 'Marseille Provence', city: 'Marseille', country: 'France', lat: 43.44, lon: 5.22 },
  { iata: 'TLS', name: 'Toulouse Blagnac', city: 'Toulouse', country: 'France', lat: 43.63, lon: 1.37 },
  { iata: 'BOD', name: 'Bordeaux Mérignac', city: 'Bordeaux', country: 'France', lat: 44.83, lon: -0.71 },
  { iata: 'NTE', name: 'Nantes Atlantique', city: 'Nantes', country: 'France', lat: 47.15, lon: -1.61 },
  { iata: 'LHR', name: 'London Heathrow', city: 'Londres', country: 'Royaume-Uni', lat: 51.47, lon: -0.45 },
  { iata: 'LGW', name: 'London Gatwick', city: 'Londres', country: 'Royaume-Uni', lat: 51.15, lon: -0.18 },
  { iata: 'STN', name: 'London Stansted', city: 'Londres', country: 'Royaume-Uni', lat: 51.89, lon: 0.24 },
  { iata: 'LTN', name: 'London Luton', city: 'Londres', country: 'Royaume-Uni', lat: 51.87, lon: -0.37 },
  { iata: 'MAN', name: 'Manchester', city: 'Manchester', country: 'Royaume-Uni', lat: 53.35, lon: -2.27 },
  { iata: 'EDI', name: 'Édimbourg', city: 'Édimbourg', country: 'Royaume-Uni', lat: 55.95, lon: -3.37 },
  { iata: 'MAD', name: 'Madrid Barajas', city: 'Madrid', country: 'Espagne', lat: 40.47, lon: -3.57 },
  { iata: 'BCN', name: 'Barcelone El Prat', city: 'Barcelone', country: 'Espagne', lat: 41.30, lon: 2.08 },
  { iata: 'AGP', name: 'Malaga', city: 'Malaga', country: 'Espagne', lat: 36.67, lon: -4.50 },
  { iata: 'PMI', name: 'Palma de Majorque', city: 'Palma', country: 'Espagne', lat: 39.55, lon: 2.74 },
  { iata: 'SVQ', name: 'Séville', city: 'Séville', country: 'Espagne', lat: 37.42, lon: -5.90 },
  { iata: 'FCO', name: 'Rome Fiumicino', city: 'Rome', country: 'Italie', lat: 41.80, lon: 12.25 },
  { iata: 'CIA', name: 'Rome Ciampino', city: 'Rome', country: 'Italie', lat: 41.80, lon: 12.59 },
  { iata: 'MXP', name: 'Milan Malpensa', city: 'Milan', country: 'Italie', lat: 45.63, lon: 8.72 },
  { iata: 'LIN', name: 'Milan Linate', city: 'Milan', country: 'Italie', lat: 45.45, lon: 9.28 },
  { iata: 'BGY', name: 'Milan Bergame', city: 'Milan', country: 'Italie', lat: 45.67, lon: 9.70 },
  { iata: 'VCE', name: 'Venise Marco Polo', city: 'Venise', country: 'Italie', lat: 45.51, lon: 12.35 },
  { iata: 'NAP', name: 'Naples', city: 'Naples', country: 'Italie', lat: 40.89, lon: 14.29 },
  { iata: 'FRA', name: 'Francfort', city: 'Francfort', country: 'Allemagne', lat: 50.03, lon: 8.56 },
  { iata: 'MUC', name: 'Munich', city: 'Munich', country: 'Allemagne', lat: 48.35, lon: 11.79 },
  { iata: 'BER', name: 'Berlin Brandebourg', city: 'Berlin', country: 'Allemagne', lat: 52.36, lon: 13.50 },
  { iata: 'HAM', name: 'Hambourg', city: 'Hambourg', country: 'Allemagne', lat: 53.63, lon: 9.99 },
  { iata: 'DUS', name: 'Düsseldorf', city: 'Düsseldorf', country: 'Allemagne', lat: 51.29, lon: 6.77 },
  { iata: 'AMS', name: 'Amsterdam Schiphol', city: 'Amsterdam', country: 'Pays-Bas', lat: 52.31, lon: 4.76 },
  { iata: 'BRU', name: 'Bruxelles', city: 'Bruxelles', country: 'Belgique', lat: 50.90, lon: 4.48 },
  { iata: 'CRL', name: 'Bruxelles Charleroi', city: 'Bruxelles', country: 'Belgique', lat: 50.46, lon: 4.45 },
  { iata: 'ZRH', name: 'Zurich', city: 'Zurich', country: 'Suisse', lat: 47.46, lon: 8.55 },
  { iata: 'GVA', name: 'Genève', city: 'Genève', country: 'Suisse', lat: 46.24, lon: 6.11 },
  { iata: 'BSL', name: 'Bâle-Mulhouse', city: 'Bâle', country: 'Suisse', lat: 47.59, lon: 7.53 },
  { iata: 'VIE', name: 'Vienne', city: 'Vienne', country: 'Autriche', lat: 48.11, lon: 16.57 },
  { iata: 'PRG', name: 'Prague', city: 'Prague', country: 'Tchéquie', lat: 50.10, lon: 14.26 },
  { iata: 'WAW', name: 'Varsovie Chopin', city: 'Varsovie', country: 'Pologne', lat: 52.17, lon: 20.97 },
  { iata: 'BUD', name: 'Budapest', city: 'Budapest', country: 'Hongrie', lat: 47.44, lon: 19.26 },
  { iata: 'ATH', name: 'Athènes', city: 'Athènes', country: 'Grèce', lat: 37.94, lon: 23.94 },
  { iata: 'LIS', name: 'Lisbonne', city: 'Lisbonne', country: 'Portugal', lat: 38.77, lon: -9.13 },
  { iata: 'OPO', name: 'Porto', city: 'Porto', country: 'Portugal', lat: 41.25, lon: -8.68 },
  { iata: 'DUB', name: 'Dublin', city: 'Dublin', country: 'Irlande', lat: 53.42, lon: -6.27 },
  { iata: 'CPH', name: 'Copenhague', city: 'Copenhague', country: 'Danemark', lat: 55.62, lon: 12.66 },
  { iata: 'OSL', name: 'Oslo Gardermoen', city: 'Oslo', country: 'Norvège', lat: 60.19, lon: 11.10 },
  { iata: 'ARN', name: 'Stockholm Arlanda', city: 'Stockholm', country: 'Suède', lat: 59.65, lon: 17.92 },
  { iata: 'HEL', name: 'Helsinki', city: 'Helsinki', country: 'Finlande', lat: 60.32, lon: 24.96 },
  { iata: 'IST', name: 'Istanbul', city: 'Istanbul', country: 'Turquie', lat: 41.26, lon: 28.74 },
  { iata: 'SAW', name: 'Istanbul Sabiha Gökçen', city: 'Istanbul', country: 'Turquie', lat: 40.90, lon: 29.31 },
  { iata: 'JFK', name: 'New York JFK', city: 'New York', country: 'États-Unis', lat: 40.64, lon: -73.78 },
  { iata: 'EWR', name: 'Newark Liberty', city: 'New York', country: 'États-Unis', lat: 40.69, lon: -74.17 },
  { iata: 'LGA', name: 'New York LaGuardia', city: 'New York', country: 'États-Unis', lat: 40.78, lon: -73.87 },
  { iata: 'BOS', name: 'Boston Logan', city: 'Boston', country: 'États-Unis', lat: 42.36, lon: -71.01 },
  { iata: 'ORD', name: 'Chicago O\'Hare', city: 'Chicago', country: 'États-Unis', lat: 41.97, lon: -87.91 },
  { iata: 'MDW', name: 'Chicago Midway', city: 'Chicago', country: 'États-Unis', lat: 41.79, lon: -87.75 },
  { iata: 'LAX', name: 'Los Angeles', city: 'Los Angeles', country: 'États-Unis', lat: 33.94, lon: -118.41 },
  { iata: 'SFO', name: 'San Francisco', city: 'San Francisco', country: 'États-Unis', lat: 37.62, lon: -122.38 },
  { iata: 'MIA', name: 'Miami', city: 'Miami', country: 'États-Unis', lat: 25.79, lon: -80.29 },
  { iata: 'FLL', name: 'Fort Lauderdale', city: 'Miami', country: 'États-Unis', lat: 26.07, lon: -80.15 },
  { iata: 'ATL', name: 'Atlanta', city: 'Atlanta', country: 'États-Unis', lat: 33.64, lon: -84.43 },
  { iata: 'DFW', name: 'Dallas Fort Worth', city: 'Dallas', country: 'États-Unis', lat: 32.90, lon: -97.04 },
  { iata: 'SEA', name: 'Seattle Tacoma', city: 'Seattle', country: 'États-Unis', lat: 47.45, lon: -122.31 },
  { iata: 'LAS', name: 'Las Vegas', city: 'Las Vegas', country: 'États-Unis', lat: 36.08, lon: -115.15 },
  { iata: 'MCO', name: 'Orlando', city: 'Orlando', country: 'États-Unis', lat: 28.43, lon: -81.31 },
  { iata: 'YUL', name: 'Montréal Trudeau', city: 'Montréal', country: 'Canada', lat: 45.47, lon: -73.74 },
  { iata: 'YYZ', name: 'Toronto Pearson', city: 'Toronto', country: 'Canada', lat: 43.68, lon: -79.63 },
  { iata: 'YVR', name: 'Vancouver', city: 'Vancouver', country: 'Canada', lat: 49.19, lon: -123.18 },
  { iata: 'MEX', name: 'Mexico City', city: 'Mexico', country: 'Mexique', lat: 19.44, lon: -99.07 },
  { iata: 'CUN', name: 'Cancún', city: 'Cancún', country: 'Mexique', lat: 21.04, lon: -86.87 },
  { iata: 'GRU', name: 'São Paulo Guarulhos', city: 'São Paulo', country: 'Brésil', lat: -23.44, lon: -46.47 },
  { iata: 'GIG', name: 'Rio Galeão', city: 'Rio de Janeiro', country: 'Brésil', lat: -22.81, lon: -43.25 },
  { iata: 'EZE', name: 'Buenos Aires Ezeiza', city: 'Buenos Aires', country: 'Argentine', lat: -34.82, lon: -58.54 },
  { iata: 'BOG', name: 'Bogotá', city: 'Bogotá', country: 'Colombie', lat: 4.70, lon: -74.14 },
  { iata: 'LIM', name: 'Lima', city: 'Lima', country: 'Pérou', lat: -12.02, lon: -77.11 },
  { iata: 'SCL', name: 'Santiago', city: 'Santiago', country: 'Chili', lat: -33.39, lon: -70.79 },
  { iata: 'DXB', name: 'Dubaï', city: 'Dubaï', country: 'Émirats', lat: 25.25, lon: 55.36 },
  { iata: 'AUH', name: 'Abou Dabi', city: 'Abou Dabi', country: 'Émirats', lat: 24.43, lon: 54.65 },
  { iata: 'DOH', name: 'Doha Hamad', city: 'Doha', country: 'Qatar', lat: 25.27, lon: 51.61 },
  { iata: 'TLV', name: 'Tel Aviv Ben Gourion', city: 'Tel Aviv', country: 'Israël', lat: 32.01, lon: 34.89 },
  { iata: 'CAI', name: 'Le Caire', city: 'Le Caire', country: 'Égypte', lat: 30.12, lon: 31.41 },
  { iata: 'CMN', name: 'Casablanca Mohammed V', city: 'Casablanca', country: 'Maroc', lat: 33.37, lon: -7.59 },
  { iata: 'RAK', name: 'Marrakech Menara', city: 'Marrakech', country: 'Maroc', lat: 31.61, lon: -8.04 },
  { iata: 'TUN', name: 'Tunis Carthage', city: 'Tunis', country: 'Tunisie', lat: 36.85, lon: 10.23 },
  { iata: 'DSS', name: 'Dakar Diass', city: 'Dakar', country: 'Sénégal', lat: 14.67, lon: -17.07 },
  { iata: 'JNB', name: 'Johannesburg', city: 'Johannesburg', country: 'Afrique du Sud', lat: -26.14, lon: 28.25 },
  { iata: 'NBO', name: 'Nairobi', city: 'Nairobi', country: 'Kenya', lat: -1.32, lon: 36.93 },
  { iata: 'BKK', name: 'Bangkok Suvarnabhumi', city: 'Bangkok', country: 'Thaïlande', lat: 13.69, lon: 100.75 },
  { iata: 'SIN', name: 'Singapour Changi', city: 'Singapour', country: 'Singapour', lat: 1.36, lon: 103.99 },
  { iata: 'KUL', name: 'Kuala Lumpur', city: 'Kuala Lumpur', country: 'Malaisie', lat: 2.75, lon: 101.71 },
  { iata: 'HKG', name: 'Hong Kong', city: 'Hong Kong', country: 'Chine', lat: 22.31, lon: 113.91 },
  { iata: 'PVG', name: 'Shanghai Pudong', city: 'Shanghai', country: 'Chine', lat: 31.14, lon: 121.81 },
  { iata: 'PEK', name: 'Pékin Capitale', city: 'Pékin', country: 'Chine', lat: 40.08, lon: 116.58 },
  { iata: 'ICN', name: 'Séoul Incheon', city: 'Séoul', country: 'Corée du Sud', lat: 37.46, lon: 126.44 },
  { iata: 'NRT', name: 'Tokyo Narita', city: 'Tokyo', country: 'Japon', lat: 35.77, lon: 140.39 },
  { iata: 'HND', name: 'Tokyo Haneda', city: 'Tokyo', country: 'Japon', lat: 35.55, lon: 139.78 },
  { iata: 'KIX', name: 'Osaka Kansai', city: 'Osaka', country: 'Japon', lat: 34.43, lon: 135.24 },
  { iata: 'DEL', name: 'New Delhi', city: 'New Delhi', country: 'Inde', lat: 28.57, lon: 77.10 },
  { iata: 'BOM', name: 'Mumbai', city: 'Mumbai', country: 'Inde', lat: 19.09, lon: 72.87 },
  { iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australie', lat: -33.94, lon: 151.18 },
  { iata: 'MEL', name: 'Melbourne', city: 'Melbourne', country: 'Australie', lat: -37.67, lon: 144.84 },
  { iata: 'AKL', name: 'Auckland', city: 'Auckland', country: 'Nouvelle-Zélande', lat: -37.01, lon: 174.79 },
  { iata: 'KEF', name: 'Reykjavik Keflavik', city: 'Reykjavik', country: 'Islande', lat: 63.99, lon: -22.61 },
  { iata: 'DPS', name: 'Bali Denpasar', city: 'Denpasar', country: 'Indonésie', lat: -8.75, lon: 115.17 },
  { iata: 'HAV', name: 'La Havane', city: 'La Havane', country: 'Cuba', lat: 22.99, lon: -82.41 },
];

// Aéroports alternatifs proches (même métropole ou bassin desservi).
export const ALTERNATE_AIRPORTS: Record<string, string[]> = {
  CDG: ['ORY', 'BVA'], ORY: ['CDG', 'BVA'], BVA: ['CDG', 'ORY'],
  JFK: ['EWR', 'LGA'], EWR: ['JFK', 'LGA'], LGA: ['JFK', 'EWR'],
  LHR: ['LGW', 'STN', 'LTN'], LGW: ['LHR', 'STN'], STN: ['LHR', 'LTN'], LTN: ['STN', 'LHR'],
  FCO: ['CIA'], CIA: ['FCO'],
  MXP: ['LIN', 'BGY'], LIN: ['MXP', 'BGY'], BGY: ['MXP', 'LIN'],
  BRU: ['CRL'], CRL: ['BRU'],
  IST: ['SAW'], SAW: ['IST'],
  NRT: ['HND'], HND: ['NRT'],
  MIA: ['FLL'], FLL: ['MIA'],
  ORD: ['MDW'], MDW: ['ORD'],
  GVA: ['LYS', 'BSL'], LYS: ['GVA'], BSL: ['GVA'],
  DXB: ['AUH'], AUH: ['DXB'],
  LAX: ['SFO'], SFO: ['LAX'],
};

// Hubs courants utilisés pour le split ticketing (escale intermédiaire).
export const SPLIT_HUBS = ['IST', 'DXB', 'DOH', 'LHR', 'FRA', 'AMS', 'MAD', 'KEF', 'LIS', 'CMN', 'HEL', 'VIE'];

const _byIata = new Map(AIRPORTS.map(a => [a.iata, a]));
export function getAirport(iata: string): Airport | undefined { return _byIata.get(iata.toUpperCase()); }

// Distance orthodromique (grand cercle) en km — formule de Haversine.
export function distanceKm(a: string, b: string): number {
  const p1 = getAirport(a); const p2 = getAirport(b);
  if (!p1 || !p2) return 1000;
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(p2.lat - p1.lat), dLon = rad(p2.lon - p1.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p1.lat)) * Math.cos(rad(p2.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function searchAirports(q: string, limit = 8): Airport[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return AIRPORTS.filter(a =>
    a.iata.toLowerCase().startsWith(s) || a.city.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)
  ).slice(0, limit);
}
