/**
 * Airbnb search via RapidAPI (provider: ntd119 / airbnb-search).
 * Host: airbnb-search.p.rapidapi.com
 *
 * If RAPIDAPI_KEY is the placeholder string or missing, this function returns []
 * without making any network request.
 *
 * Server-side only – never import this in client components.
 */

import { SearchParams, SearchResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? '';
const PLACEHOLDER = 'PLACEHOLDER_REPLACE_ME';
const HOST = 'airbnb-search.p.rapidapi.com';

// ---------------------------------------------------------------------------
// searchAirbnb
// ---------------------------------------------------------------------------
export async function searchAirbnb(params: SearchParams): Promise<SearchResult[]> {
  // Skip if key is placeholder or missing
  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === PLACEHOLDER) {
    console.info('[Airbnb/RapidAPI] Key is placeholder – skipping Airbnb search');
    return [];
  }

  const searchParams = new URLSearchParams({
    location: `${params.location}, Greece`,
    checkin: params.checkIn,
    checkout: params.checkOut,
    adults: String(params.numPeople),
    currency: 'EUR',
    // Some providers use 'rooms' param
    rooms: String(params.numRooms),
  });

  try {
    const res = await fetch(
      `https://${HOST}/search?${searchParams.toString()}`,
      {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': HOST,
          Accept: 'application/json',
        },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) {
      console.error(`[Airbnb/RapidAPI] HTTP ${res.status}: ${await res.text()}`);
      return [];
    }

    const data = await res.json();

    // The response shape may vary – try common structures
    const listings: Record<string, unknown>[] = extractListings(data);

    if (listings.length === 0) {
      console.warn('[Airbnb/RapidAPI] No listings returned');
      return [];
    }

    return listings.map((listing): SearchResult => {
      const price = extractAirbnbPrice(listing);
      const nights = nightsBetween(params.checkIn, params.checkOut);

      return {
        id: uuidv4(),
        location: params.location,
        name: String(
          listing.name ??
          listing.title ??
          (listing['listing'] as Record<string, unknown> | undefined)?.name ??
          'Annuncio Airbnb'
        ),
        description: String(
          listing.description ??
          listing.summary ??
          listing.room_type ??
          ''
        ),
        type: normalizeAirbnbType(String(listing.room_type ?? listing.property_type ?? '')),
        pricePerNight: price,
        totalPrice: price !== undefined ? price * nights : undefined,
        currency: 'EUR',
        source: 'Airbnb',
        url: buildAirbnbUrl(listing),
        imageUrl: extractAirbnbImage(listing),
        rating: extractAirbnbRating(listing),
        amenities: extractAirbnbAmenities(listing),
        bedrooms: extractNumber(listing, ['bedrooms', 'beds']),
        maxGuests: extractNumber(listing, ['person_capacity', 'max_guests', 'persons']),
        saved: false,
      };
    });
  } catch (err) {
    console.error('[Airbnb/RapidAPI] Fetch error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers – handle different API response shapes
// ---------------------------------------------------------------------------

function extractListings(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;

  // Common response shapes from various RapidAPI Airbnb providers
  if (Array.isArray(d.results)) return d.results as Record<string, unknown>[];
  if (Array.isArray(d.listings)) return d.listings as Record<string, unknown>[];
  if (Array.isArray(d.data)) return d.data as Record<string, unknown>[];
  if (d.data && typeof d.data === 'object') {
    const inner = d.data as Record<string, unknown>;
    if (Array.isArray(inner.results)) return inner.results as Record<string, unknown>[];
    if (Array.isArray(inner.listings)) return inner.listings as Record<string, unknown>[];
  }
  return [];
}

function extractAirbnbPrice(listing: Record<string, unknown>): number | undefined {
  // Various price field names across different API providers
  const candidates = [
    listing.price,
    listing.price_per_night,
    ((listing.pricing_quote as Record<string, unknown>)?.rate as Record<string, unknown>)?.amount,
    (listing.price_details as Record<string, unknown>)?.price_per_night,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const n = parseFloat(String(c).replace(/[^0-9.]/g, ''));
      if (!isNaN(n)) return n;
    }
  }
  return undefined;
}

function extractAirbnbRating(listing: Record<string, unknown>): number | undefined {
  const candidates = [
    listing.star_rating,
    listing.avg_rating,
    listing.rating,
    (listing.reviews_module as Record<string, unknown>)?.localized_overall_rating,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const n = parseFloat(String(c));
      if (!isNaN(n)) {
        // Normalize 0–5 → 0–10
        return n <= 5 ? n * 2 : n;
      }
    }
  }
  return undefined;
}

function extractAirbnbImage(listing: Record<string, unknown>): string | undefined {
  if (typeof listing.picture_url === 'string') return listing.picture_url;
  if (typeof listing.thumbnail_url === 'string') return listing.thumbnail_url;
  const pics = listing.pictures ?? listing.photos;
  if (Array.isArray(pics) && pics.length > 0) {
    const first = pics[0] as Record<string, unknown>;
    return String(first.url ?? first.picture_url ?? first.large ?? '');
  }
  return undefined;
}

function extractAirbnbAmenities(listing: Record<string, unknown>): string[] | undefined {
  if (Array.isArray(listing.amenities)) {
    return (listing.amenities as unknown[]).map((a) => {
      if (typeof a === 'string') return a;
      const obj = a as Record<string, unknown>;
      return String(obj['name'] ?? a);
    });
  }
  return undefined;
}

function buildAirbnbUrl(listing: Record<string, unknown>): string {
  if (typeof listing.url === 'string') return listing.url;
  const id = listing.id ?? listing.listing_id;
  if (id) return `https://www.airbnb.it/rooms/${id}`;
  return 'https://www.airbnb.it';
}

function normalizeAirbnbType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('villa')) return 'villa';
  if (lower.includes('apartment') || lower.includes('appartamento')) return 'appartamento';
  if (lower.includes('hotel')) return 'hotel';
  if (lower.includes('house') || lower.includes('casa')) return 'casa vacanze';
  if (lower.includes('bungalow')) return 'bungalow';
  if (lower.includes('private room') || lower.includes('b&b')) return 'b&b';
  return raw || 'alloggio';
}

function extractNumber(
  listing: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const val = listing[key];
    if (val !== undefined && val !== null) {
      const n = parseInt(String(val), 10);
      if (!isNaN(n)) return n;
    }
  }
  return undefined;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  const diff = (b - a) / (1000 * 60 * 60 * 24);
  return diff > 0 ? diff : 1;
}
