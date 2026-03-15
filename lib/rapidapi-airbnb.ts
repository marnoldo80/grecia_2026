/**
 * Airbnb search via RapidAPI – provider: airbnb19
 * Host: airbnb19.p.rapidapi.com
 * Endpoint: /api/v2/searchPropertyByPlaceId
 *
 * This API requires a Google Place ID for the destination.
 * We maintain a map of popular Greek locations → Google Place IDs.
 * For unknown locations we attempt a fuzzy match; if no match is found
 * the function returns [] gracefully.
 *
 * Server-side only – never import in client components.
 */

import { SearchParams, SearchResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? '';
const PLACEHOLDER = 'PLACEHOLDER_REPLACE_ME';
const HOST = 'airbnb19.p.rapidapi.com';

// ---------------------------------------------------------------------------
// Greek destinations → Google Place IDs
// ---------------------------------------------------------------------------
const GREEK_PLACE_IDS: Record<string, string> = {
  santorini:    'ChIJ7cv00DwsDogRAMDACa2m4K8',
  mykonos:      'ChIJh2nWWsFgqhQRwLYqAHQ47-s',
  creta:        'ChIJ_2bDjnGomhQRa3HPoHRR0fE',
  crete:        'ChIJ_2bDjnGomhQRa3HPoHRR0fE',
  rodi:         'ChIJiaME4MgBmhQRGW_VkFsYqCg',
  rhodes:       'ChIJiaME4MgBmhQRGW_VkFsYqCg',
  corfu:        'ChIJ_ROxrgP6XRQRP3UD5A5bABU',
  corfù:        'ChIJ_ROxrgP6XRQRP3UD5A5bABU',
  atene:        'ChIJ8UNwBh-9oRQR3Y1mdkU1Ngs',
  athens:       'ChIJ8UNwBh-9oRQR3Y1mdkU1Ngs',
  salonicco:    'ChIJ7eAoFPQ4qBQRqXTVuBXnugk',
  thessaloniki: 'ChIJ7eAoFPQ4qBQRqXTVuBXnugk',
  zante:        'ChIJIxy0weCkoRQRWFjB82C8B5M',
  zakynthos:    'ChIJIxy0weCkoRQRWFjB82C8B5M',
  lefkada:      'ChIJDUbA4MElqBQRJWzpF15VQCQ',
  cefalonia:    'ChIJMdwJOkQSqBQRq_7Ke7TpC3M',
  kefalonia:    'ChIJMdwJOkQSqBQRq_7Ke7TpC3M',
  skiathos:     'ChIJHZGTpQWVqBQRPGWrDVZPKlM',
  paros:        'ChIJm0t0IqF4mhQRAVy5gIWTHoU',
  naxos:        'ChIJw9AvpP2BmhQROOt8BZ5yCEY',
  karpathos:    'ChIJcYlJDLvImhQRbKpJpQS7V1s',
  kos:          'ChIJW0vlhpGWqhQR4IIQS5VgTls',
  grecia:       'ChIJc2OtDSE3WxMRhFBuBnfGRgE',
  greece:       'ChIJc2OtDSE3WxMRhFBuBnfGRgE',
  halkidiki:    'ChIJu1sPHDp9qBQR3nCLJnJaRQI',
  meteora:      'ChIJkbfOoPAOXhMRSPxMp2N76CE',
  milos:        'ChIJV1SQcMRemhQRKqJXu7y73vg',
  hydra:        'ChIJVXealLU9WhMRRBHXFRZa6rk',
  skopelos:     'ChIJpwDXLVePqBQR8HNX9z2RBHQ',
  thassos:      'ChIJBX3SkqfDqBQRrn8a-FS_O0A',
  lesbos:       'ChIJp1Fzj8OKWxMR0QRMB-IVWFA',
  samos:        'ChIJm0ld7q6UWxMRi5Pjf0KDDNA',
  chios:        'ChIJH9hkAj-EWxMRqPOl10SWQCE',
};

function resolvePlaceId(location: string): string | undefined {
  const key = location.toLowerCase().trim();
  // Direct match
  if (GREEK_PLACE_IDS[key]) return GREEK_PLACE_IDS[key];
  // Partial match (e.g. "Santorini, Greece" → "santorini")
  for (const [name, id] of Object.entries(GREEK_PLACE_IDS)) {
    if (key.includes(name) || name.includes(key)) return id;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// searchAirbnb
// ---------------------------------------------------------------------------
export async function searchAirbnb(params: SearchParams): Promise<SearchResult[]> {
  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === PLACEHOLDER) {
    console.info('[Airbnb19/RapidAPI] Key is placeholder – skipping');
    return [];
  }

  const placeId = resolvePlaceId(params.location);
  if (!placeId) {
    console.warn(`[Airbnb19/RapidAPI] No placeId found for location: "${params.location}" – skipping`);
    return [];
  }

  const nights = nightsBetween(params.checkIn, params.checkOut);

  const searchParams = new URLSearchParams({
    placeId,
    adults:         String(params.numPeople),
    children:       '0',
    infants:        '0',
    pets:           '0',
    checkin:        params.checkIn,
    checkout:       params.checkOut,
    currency:       'EUR',
    guestFavorite:  'false',
    ib:             'false',
    // Additional filters
    minBedrooms:    params.numRooms > 0 ? String(params.numRooms) : '0',
  });

  try {
    const res = await fetch(
      `https://${HOST}/api/v2/searchPropertyByPlaceId?${searchParams.toString()}`,
      {
        headers: {
          'X-RapidAPI-Key':  RAPIDAPI_KEY,
          'X-RapidAPI-Host': HOST,
          'Content-Type':    'application/json',
        },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) {
      console.error(`[Airbnb19/RapidAPI] HTTP ${res.status}: ${await res.text()}`);
      return [];
    }

    const data = await res.json();
    const listings = extractListings(data);

    if (listings.length === 0) {
      console.warn('[Airbnb19/RapidAPI] No listings returned');
      return [];
    }

    return listings.map((listing): SearchResult => {
      const pricePerNight = extractPrice(listing);

      return {
        id:           uuidv4(),
        location:     params.location,
        name:         extractName(listing),
        description:  extractDescription(listing),
        type:         normalizeType(extractRoomType(listing)),
        pricePerNight,
        totalPrice:   pricePerNight !== undefined ? pricePerNight * nights : undefined,
        currency:     'EUR',
        source:       'Airbnb',
        url:          buildUrl(listing),
        imageUrl:     extractImage(listing),
        rating:       extractRating(listing),
        amenities:    extractAmenities(listing),
        bedrooms:     extractNumber(listing, ['bedrooms', 'beds', 'bedroom_label']),
        maxGuests:    extractNumber(listing, ['person_capacity', 'maxGuestCapacity', 'persons', 'guests']),
        saved:        false,
      };
    });
  } catch (err) {
    console.error('[Airbnb19/RapidAPI] Fetch error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Response parsers – airbnb19 wraps data in multiple levels
// ---------------------------------------------------------------------------

function extractListings(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;

  // airbnb19 typical shapes:
  // { data: { list: [...] } }
  // { data: { results: [...] } }
  // { results: [...] }
  // { list: [...] }
  const tryPaths = [
    () => {
      const inner = (d.data as Record<string, unknown>);
      if (inner && Array.isArray(inner.list)) return inner.list as Record<string, unknown>[];
      if (inner && Array.isArray(inner.results)) return inner.results as Record<string, unknown>[];
      return null;
    },
    () => Array.isArray(d.list)    ? d.list    as Record<string, unknown>[] : null,
    () => Array.isArray(d.results) ? d.results as Record<string, unknown>[] : null,
    () => Array.isArray(d.data)    ? d.data    as Record<string, unknown>[] : null,
  ];

  for (const fn of tryPaths) {
    const result = fn();
    if (result && result.length > 0) return result;
  }
  return [];
}

function extractName(l: Record<string, unknown>): string {
  const listing = (l.listing ?? l) as Record<string, unknown>;
  return String(
    listing.name ??
    listing.title ??
    l.name ??
    l.title ??
    'Annuncio Airbnb'
  );
}

function extractDescription(l: Record<string, unknown>): string {
  const listing = (l.listing ?? l) as Record<string, unknown>;
  return String(
    listing.description ??
    listing.summary ??
    listing.room_and_property_type ??
    listing.room_type_category ??
    l.description ??
    ''
  );
}

function extractRoomType(l: Record<string, unknown>): string {
  const listing = (l.listing ?? l) as Record<string, unknown>;
  return String(
    listing.room_type ??
    listing.property_type ??
    listing.room_type_category ??
    l.room_type ??
    ''
  );
}

function extractPrice(l: Record<string, unknown>): number | undefined {
  const pq = l.pricingQuote ?? l.pricing_quote;
  if (pq && typeof pq === 'object') {
    const p = pq as Record<string, unknown>;
    const rate = p.rate ?? p.rate_with_service_fee;
    if (rate && typeof rate === 'object') {
      const r = rate as Record<string, unknown>;
      const amount = r.amount ?? r.base_price;
      if (amount !== undefined) {
        const n = parseFloat(String(amount));
        if (!isNaN(n)) return n;
      }
    }
    if (p.rate_type === 'nightly' && p.price !== undefined) {
      const n = parseFloat(String(p.price));
      if (!isNaN(n)) return n;
    }
  }
  // Fallback flat fields
  const candidates = [l.price, l.price_per_night, l.nightly_price];
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const n = parseFloat(String(c).replace(/[^0-9.]/g, ''));
      if (!isNaN(n)) return n;
    }
  }
  return undefined;
}

function extractRating(l: Record<string, unknown>): number | undefined {
  const listing = (l.listing ?? l) as Record<string, unknown>;
  const candidates = [
    listing.avg_rating,
    listing.star_rating,
    l.avg_rating,
    l.star_rating,
    l.rating,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const n = parseFloat(String(c));
      if (!isNaN(n)) return n <= 5 ? Math.round(n * 2 * 10) / 10 : n;
    }
  }
  return undefined;
}

function extractImage(l: Record<string, unknown>): string | undefined {
  const listing = (l.listing ?? l) as Record<string, unknown>;
  if (typeof listing.picture_url === 'string') return listing.picture_url;
  if (typeof listing.thumbnail_url === 'string') return listing.thumbnail_url;
  if (typeof l.picture_url === 'string') return l.picture_url;

  const pics = listing.pictures ?? listing.photos ?? l.pictures;
  if (Array.isArray(pics) && pics.length > 0) {
    const first = pics[0] as Record<string, unknown>;
    return String(first.picture ?? first.url ?? first.large ?? first.x_large ?? '');
  }
  return undefined;
}

function extractAmenities(l: Record<string, unknown>): string[] | undefined {
  const listing = (l.listing ?? l) as Record<string, unknown>;
  const raw = listing.amenities ?? l.amenities;
  if (Array.isArray(raw)) {
    return (raw as unknown[]).slice(0, 10).map((a) => {
      if (typeof a === 'string') return a;
      const obj = a as Record<string, unknown>;
      return String(obj.name ?? obj.title ?? a);
    });
  }
  return undefined;
}

function buildUrl(l: Record<string, unknown>): string {
  if (typeof l.url === 'string') return l.url;
  const listing = (l.listing ?? l) as Record<string, unknown>;
  const id = listing.id ?? l.id ?? l.listing_id;
  if (id) return `https://www.airbnb.it/rooms/${id}`;
  return 'https://www.airbnb.it';
}

function normalizeType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('villa'))                             return 'villa';
  if (lower.includes('apartment') || lower.includes('appartamento')) return 'appartamento';
  if (lower.includes('entire home') || lower.includes('casa')) return 'casa vacanze';
  if (lower.includes('hotel'))                             return 'hotel';
  if (lower.includes('bungalow'))                          return 'bungalow';
  if (lower.includes('private room') || lower.includes('b&b')) return 'b&b';
  if (lower.includes('boat') || lower.includes('barca'))   return 'barca';
  return raw || 'alloggio';
}

function extractNumber(l: Record<string, unknown>, keys: string[]): number | undefined {
  const listing = (l.listing ?? l) as Record<string, unknown>;
  for (const key of keys) {
    for (const src of [listing, l]) {
      const val = src[key];
      if (val !== undefined && val !== null) {
        const n = parseInt(String(val), 10);
        if (!isNaN(n)) return n;
      }
    }
  }
  return undefined;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  const diff = (b - a) / (1000 * 60 * 60 * 24);
  return diff > 0 ? Math.round(diff) : 1;
}
