/**
 * Booking.com search via RapidAPI (provider: DataCrawler / booking-com15).
 * Host: booking-com15.p.rapidapi.com
 *
 * Two-step process:
 *  1. searchDestination – resolves a free-text location into a dest_id
 *  2. searchHotels – fetches hotels using that dest_id
 *
 * If RAPIDAPI_KEY is the placeholder string or missing, returns [] immediately.
 *
 * Server-side only – never import this in client components.
 */

import { SearchParams, SearchResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? '';
const PLACEHOLDER = 'PLACEHOLDER_REPLACE_ME';
const HOST = 'booking-com15.p.rapidapi.com';
const BASE_URL = `https://${HOST}/api/v1/hotels`;

// ---------------------------------------------------------------------------
// searchBooking
// ---------------------------------------------------------------------------
export async function searchBooking(params: SearchParams): Promise<SearchResult[]> {
  // Skip if key is placeholder or missing
  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === PLACEHOLDER) {
    console.info('[Booking/RapidAPI] Key is placeholder – skipping Booking.com search');
    return [];
  }

  try {
    // Step 1 – resolve destination
    const destId = await resolveDestination(params.location);
    if (!destId) {
      console.warn(`[Booking/RapidAPI] Could not resolve destination for: ${params.location}`);
      return [];
    }

    // Step 2 – search hotels
    return await fetchHotels(params, destId);
  } catch (err) {
    console.error('[Booking/RapidAPI] Error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Step 1 – resolve destination
// ---------------------------------------------------------------------------
async function resolveDestination(location: string): Promise<string | null> {
  const query = new URLSearchParams({
    query: `${location} greece`,
  });

  const res = await fetch(`${BASE_URL}/searchDestination?${query.toString()}`, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': HOST,
      Accept: 'application/json',
    },
    next: { revalidate: 3600 }, // cache destination lookups for 1 hour
  });

  if (!res.ok) {
    console.error(`[Booking/RapidAPI] searchDestination HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();

  // Response: { status: true, data: [{ dest_id, search_type, name, ... }] }
  const items: Record<string, unknown>[] = Array.isArray(data?.data) ? data.data : [];

  // Prefer city-type results
  const cityMatch = items.find(
    (i) => String(i.search_type).toLowerCase() === 'city'
  );
  const first = cityMatch ?? items[0];

  if (!first) return null;
  return String(first.dest_id ?? first.id ?? '');
}

// ---------------------------------------------------------------------------
// Step 2 – fetch hotels
// ---------------------------------------------------------------------------
async function fetchHotels(
  params: SearchParams,
  destId: string
): Promise<SearchResult[]> {
  const query = new URLSearchParams({
    dest_id: destId,
    search_type: 'city',
    arrival_date: params.checkIn,
    departure_date: params.checkOut,
    adults: String(params.numPeople),
    room_qty: String(params.numRooms),
    currency_code: 'EUR',
    languagecode: 'it',
    page_number: '1',
    units: 'metric',
    ...(params.numBathrooms > 1 ? { min_bathrooms: String(params.numBathrooms) } : {}),
  });

  const res = await fetch(`${BASE_URL}/searchHotels?${query.toString()}`, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': HOST,
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    console.error(`[Booking/RapidAPI] searchHotels HTTP ${res.status}: ${await res.text()}`);
    return [];
  }

  const data = await res.json();

  // Various response shapes – try to locate the hotels array
  const hotels = extractHotels(data);

  if (hotels.length === 0) {
    console.warn('[Booking/RapidAPI] No hotels returned');
    return [];
  }

  const nights = nightsBetween(params.checkIn, params.checkOut);

  return hotels.map((hotel): SearchResult => {
    const pricePerNight = extractBookingPrice(hotel);
    return {
      id: uuidv4(),
      location: params.location,
      name: String(hotel.hotel_name ?? hotel.name ?? 'Struttura Booking.com'),
      description: buildBookingDescription(hotel),
      type: normalizeBookingType(hotel),
      pricePerNight,
      totalPrice:
        pricePerNight !== undefined
          ? pricePerNight * nights
          : extractBookingTotalPrice(hotel),
      currency: 'EUR',
      source: 'Booking.com',
      url: buildBookingUrl(hotel),
      imageUrl: extractBookingImage(hotel),
      rating: extractBookingRating(hotel),
      amenities: extractBookingAmenities(hotel),
      bedrooms: extractNumber(hotel, ['room_count', 'rooms', 'bedrooms']),
      maxGuests: params.numPeople,
      saved: false,
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractHotels(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.data)) return d.data as Record<string, unknown>[];
  if (d.data && typeof d.data === 'object') {
    const inner = d.data as Record<string, unknown>;
    if (Array.isArray(inner.hotels)) return inner.hotels as Record<string, unknown>[];
    if (Array.isArray(inner.result)) return inner.result as Record<string, unknown>[];
  }
  if (Array.isArray(d.result)) return d.result as Record<string, unknown>[];
  if (Array.isArray(d.hotels)) return d.hotels as Record<string, unknown>[];
  return [];
}

function extractBookingPrice(hotel: Record<string, unknown>): number | undefined {
  // Try various price field paths
  const priceInfo = hotel.price_breakdown ?? hotel.composite_price_breakdown ?? hotel.price;
  if (priceInfo && typeof priceInfo === 'object') {
    const pi = priceInfo as Record<string, unknown>;
    const grossPrice = pi.gross_price as Record<string, unknown> | undefined;
    const netPrice = pi.net_price as Record<string, unknown> | undefined;
    const candidates = [
      pi.all_inclusive_price,
      grossPrice?.value,
      netPrice?.value,
      pi.sum_min_price_tm,
    ];
    for (const c of candidates) {
      if (c !== undefined) {
        const n = parseFloat(String(c));
        if (!isNaN(n)) {
          // If this is a total price, divide by nights
          return n;
        }
      }
    }
  }
  // Flat price fields
  for (const key of ['min_total_price', 'price', 'priceBreakdown']) {
    if (hotel[key] !== undefined) {
      const n = parseFloat(String(hotel[key]));
      if (!isNaN(n)) return n;
    }
  }
  return undefined;
}

function extractBookingTotalPrice(hotel: Record<string, unknown>): number | undefined {
  const candidates = [hotel.min_total_price, hotel.totalPrice, hotel.total_price];
  for (const c of candidates) {
    if (c !== undefined) {
      const n = parseFloat(String(c));
      if (!isNaN(n)) return n;
    }
  }
  return undefined;
}

function extractBookingRating(hotel: Record<string, unknown>): number | undefined {
  const candidates = [
    hotel.review_score,
    hotel.rating,
    hotel.score,
    (hotel.review_score_word as number | undefined),
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const n = parseFloat(String(c));
      if (!isNaN(n)) return n;
    }
  }
  return undefined;
}

function extractBookingImage(hotel: Record<string, unknown>): string | undefined {
  if (typeof hotel.main_photo_url === 'string') return hotel.main_photo_url;
  if (typeof hotel.hotel_photo === 'string') return hotel.hotel_photo;
  const photos = hotel.photos ?? hotel.images;
  if (Array.isArray(photos) && photos.length > 0) {
    const first = photos[0] as Record<string, unknown>;
    return String(first.url_original ?? first.url_max ?? first.url ?? '');
  }
  return undefined;
}

function extractBookingAmenities(hotel: Record<string, unknown>): string[] | undefined {
  if (Array.isArray(hotel.facilities)) {
    return (hotel.facilities as Record<string, unknown>[]).map((f) =>
      String(f.name ?? f.facility_name ?? f)
    );
  }
  return undefined;
}

function normalizeBookingType(hotel: Record<string, unknown>): string {
  const raw = String(
    hotel.accommodation_type_name ?? hotel.property_type ?? hotel.type ?? ''
  ).toLowerCase();
  if (raw.includes('villa')) return 'villa';
  if (raw.includes('apartment') || raw.includes('appartamento')) return 'appartamento';
  if (raw.includes('hotel')) return 'hotel';
  if (raw.includes('house') || raw.includes('casa')) return 'casa vacanze';
  if (raw.includes('b&b') || raw.includes('bed')) return 'b&b';
  if (raw.includes('bungalow')) return 'bungalow';
  return raw || 'hotel';
}

function buildBookingDescription(hotel: Record<string, unknown>): string {
  const parts: string[] = [];
  if (hotel.accommodation_type_name) parts.push(String(hotel.accommodation_type_name));
  if (hotel.city) parts.push(String(hotel.city));
  if (hotel.district) parts.push(`quartiere ${hotel.district}`);
  if (hotel.review_score_word) parts.push(`Valutazione: ${hotel.review_score_word}`);
  return parts.join(' – ');
}

function buildBookingUrl(hotel: Record<string, unknown>): string {
  // 1. Use the API-provided URL if available (may be relative)
  if (typeof hotel.url === 'string' && hotel.url.trim().length > 5) {
    const u = hotel.url.trim();
    return u.startsWith('/') ? `https://www.booking.com${u}` : u;
  }

  // 2. Build slug from hotel name (Booking URLs use name-slug, not numeric ID)
  const rawName = String(hotel.hotel_name ?? hotel.name ?? '');
  if (rawName) {
    const slug = rawName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // remove diacritics
      .replace(/[^a-z0-9\s-]/g, '')       // remove special chars
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-');
    if (slug) return `https://www.booking.com/hotel/gr/${slug}.it.html`;
  }

  // 3. Fallback: search results page for this hotel
  const id = hotel.hotel_id ?? hotel.id;
  const name = String(hotel.hotel_name ?? hotel.name ?? 'grecia');
  if (id) {
    return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(name)}&dest_type=hotel&dest_id=${id}`;
  }

  return 'https://www.booking.com/searchresults.html?ss=grecia';
}

function extractNumber(
  obj: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const val = obj[key];
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
