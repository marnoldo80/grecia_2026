/**
 * SerpAPI integration for Greece accommodation search.
 *
 * Two functions:
 *  1. searchGoogleHotels – uses engine=google_hotels for structured hotel data with pricing.
 *  2. searchSiteSpecific – uses engine=google to scrape a specific site (lastminute, hometogo, etc.)
 *     for organic listing links and snippets.
 *
 * All calls are server-side only (SERPAPI_KEY is never exposed to the browser).
 */

import { SearchParams, SearchResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const SERPAPI_KEY = process.env.SERPAPI_KEY ?? '';
const SERPAPI_BASE = 'https://serpapi.com/search.json';

// ---------------------------------------------------------------------------
// Helper – parse price strings like "$120", "€ 95", "120 EUR" → number | undefined
// ---------------------------------------------------------------------------
function parsePrice(raw: string | number | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw).replace(/[^0-9.,]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

// ---------------------------------------------------------------------------
// Mock fallback data – shown when all real API calls fail (dev / demo mode)
// ---------------------------------------------------------------------------
export const MOCK_RESULTS: SearchResult[] = [
  {
    id: uuidv4(),
    location: 'Santorini',
    name: 'Villa Caldera Santorini',
    description: 'Splendida villa con vista sulla caldera, piscina privata e terrazza panoramica. Ideale per famiglie o gruppi.',
    type: 'villa',
    pricePerNight: 320,
    totalPrice: 4480,
    currency: 'EUR',
    source: 'Demo',
    url: 'https://www.airbnb.it/rooms/demo-1',
    imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400',
    rating: 9.4,
    amenities: ['Piscina', 'Vista mare', 'Aria condizionata', 'WiFi', 'Cucina'],
    bedrooms: 3,
    maxGuests: 6,
    saved: false,
  },
  {
    id: uuidv4(),
    location: 'Mykonos',
    name: 'Mykonos Luxury Suites',
    description: 'Hotel boutique nel cuore di Mykonos Town, a due passi dalle spiagge più belle.',
    type: 'hotel',
    pricePerNight: 210,
    totalPrice: 2940,
    currency: 'EUR',
    source: 'Demo',
    url: 'https://www.booking.com/hotel/demo-2',
    imageUrl: 'https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?w=400',
    rating: 8.8,
    amenities: ['Colazione inclusa', 'Aria condizionata', 'WiFi', 'Parcheggio'],
    bedrooms: 1,
    maxGuests: 2,
    saved: false,
  },
  {
    id: uuidv4(),
    location: 'Creta',
    name: 'Appartamento Elounda',
    description: 'Accogliente appartamento fronte mare con spiaggia privata e accesso diretto al mare cristallino.',
    type: 'appartamento',
    pricePerNight: 145,
    totalPrice: 2030,
    currency: 'EUR',
    source: 'Demo',
    url: 'https://www.lastminute.com/demo-3',
    imageUrl: 'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=400',
    rating: 8.2,
    amenities: ['Spiaggia privata', 'Vista mare', 'Cucina attrezzata', 'WiFi'],
    bedrooms: 2,
    maxGuests: 4,
    saved: false,
  },
  {
    id: uuidv4(),
    location: 'Corfu',
    name: 'B&B Olive Garden Corfu',
    description: 'Piccolo B&B a conduzione familiare immerso negli ulivi. Colazione con prodotti locali ogni mattina.',
    type: 'b&b',
    pricePerNight: 85,
    totalPrice: 1190,
    currency: 'EUR',
    source: 'Demo',
    url: 'https://www.hometogo.it/demo-4',
    imageUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400',
    rating: 9.1,
    amenities: ['Colazione inclusa', 'Giardino', 'WiFi', 'Animali ammessi'],
    bedrooms: 1,
    maxGuests: 2,
    saved: false,
  },
  {
    id: uuidv4(),
    location: 'Rodi',
    name: 'Casa Vacanze Rhodes Old Town',
    description: 'Casa storica nel centro medievale di Rodi. Architettura originale con arredi moderni.',
    type: 'casa vacanze',
    pricePerNight: 175,
    totalPrice: 2450,
    currency: 'EUR',
    source: 'Demo',
    url: 'https://www.airbnb.it/rooms/demo-5',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    rating: 7.9,
    amenities: ['Aria condizionata', 'WiFi', 'Terrazza', 'Barbecue'],
    bedrooms: 2,
    maxGuests: 5,
    saved: false,
  },
];

// ---------------------------------------------------------------------------
// searchGoogleHotels
// ---------------------------------------------------------------------------
export async function searchGoogleHotels(params: SearchParams): Promise<SearchResult[]> {
  if (!SERPAPI_KEY) {
    console.warn('[SerpAPI] SERPAPI_KEY not set – returning mock data');
    return MOCK_RESULTS.map((r) => ({ ...r, id: uuidv4() }));
  }

  const query = new URLSearchParams({
    engine: 'google_hotels',
    q: `${params.location} grecia`,
    check_in_date: params.checkIn,
    check_out_date: params.checkOut,
    adults: String(params.numPeople),
    rooms: String(params.numRooms),
    currency: 'EUR',
    gl: 'it',
    hl: 'it',
    api_key: SERPAPI_KEY,
  });

  // Add accommodation type as keyword if not 'qualsiasi'
  if (params.accommodationType && params.accommodationType !== 'qualsiasi') {
    query.set('q', `${params.location} grecia ${params.accommodationType}`);
  }

  try {
    const res = await fetch(`${SERPAPI_BASE}?${query.toString()}`, {
      next: { revalidate: 0 }, // always fresh
    });

    if (!res.ok) {
      console.error(`[SerpAPI Hotels] HTTP ${res.status}: ${await res.text()}`);
      return MOCK_RESULTS.map((r) => ({ ...r, id: uuidv4() }));
    }

    const data = await res.json();

    // SerpAPI returns an error object when key is invalid / quota exceeded
    if (data.error) {
      console.error('[SerpAPI Hotels] API error:', data.error);
      return MOCK_RESULTS.map((r) => ({ ...r, id: uuidv4() }));
    }

    const properties: Record<string, unknown>[] = Array.isArray(data.properties)
      ? data.properties
      : [];

    if (properties.length === 0) {
      console.warn('[SerpAPI Hotels] No properties returned – falling back to mock data');
      return MOCK_RESULTS.map((r) => ({ ...r, id: uuidv4() }));
    }

    return properties.map((p): SearchResult => {
      // Extract the cheapest price from the prices array
      const prices = Array.isArray(p.prices) ? (p.prices as Record<string, unknown>[]) : [];
      let pricePerNight: number | undefined;
      let source = 'Google Hotels';

      if (prices.length > 0) {
        const firstPrice = prices[0] as Record<string, unknown>;
        const rateObj = firstPrice.rate_per_night as Record<string, unknown> | undefined;
        pricePerNight = parsePrice(rateObj?.lowest as string | number | undefined);
        if (firstPrice.source) source = String(firstPrice.source);
      }

      // Compute total price from check-in to check-out
      let totalPrice: number | undefined;
      if (pricePerNight !== undefined) {
        const nights = nightsBetween(params.checkIn, params.checkOut);
        totalPrice = pricePerNight * nights;
      }

      const images = Array.isArray(p.images) ? (p.images as Record<string, unknown>[]) : [];
      const amenities = Array.isArray(p.amenities) ? (p.amenities as string[]) : [];

      return {
        id: uuidv4(),
        location: params.location,
        name: String(p.name ?? 'Struttura senza nome'),
        description: String(p.description ?? ''),
        type: params.accommodationType !== 'qualsiasi' ? params.accommodationType : 'hotel',
        pricePerNight,
        totalPrice,
        currency: 'EUR',
        source: source || 'Google Hotels',
        url: String(p.link ?? ''),
        imageUrl: images[0]?.thumbnail as string | undefined,
        rating: p.overall_rating !== undefined ? Number(p.overall_rating) : undefined,
        amenities,
        bedrooms: undefined,
        maxGuests: params.numPeople,
        saved: false,
      };
    });
  } catch (err) {
    console.error('[SerpAPI Hotels] Fetch error:', err);
    return MOCK_RESULTS.map((r) => ({ ...r, id: uuidv4() }));
  }
}

// ---------------------------------------------------------------------------
// searchSiteSpecific – generic Google search targeting a specific site
// ---------------------------------------------------------------------------
export async function searchSiteSpecific(
  params: SearchParams,
  site: string,
  siteName: string
): Promise<SearchResult[]> {
  if (!SERPAPI_KEY) {
    console.warn(`[SerpAPI Site:${siteName}] SERPAPI_KEY not set – skipping`);
    return [];
  }

  const typeStr =
    params.accommodationType && params.accommodationType !== 'qualsiasi'
      ? params.accommodationType
      : 'alloggio';

  // Use concise query: too many terms → 0 Google results
  // Priority: location + type. Options only if ≤ 2 selected.
  const optionKeywords = params.options.slice(0, 2).join(' ');

  const q = [
    `site:${site}`,
    params.location,
    'grecia',
    typeStr,
    optionKeywords,
  ]
    .filter(Boolean)
    .join(' ');

  const query = new URLSearchParams({
    engine: 'google',
    q,
    gl: 'it',
    hl: 'it',
    num: '10',
    api_key: SERPAPI_KEY,
  });

  try {
    const res = await fetch(`${SERPAPI_BASE}?${query.toString()}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error(`[SerpAPI Site:${siteName}] HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();

    if (data.error) {
      console.error(`[SerpAPI Site:${siteName}] API error:`, data.error);
      return [];
    }

    const organic: Record<string, unknown>[] = Array.isArray(data.organic_results)
      ? data.organic_results
      : [];

    return organic.slice(0, 10).map((item): SearchResult => {
      return {
        id: uuidv4(),
        location: params.location,
        name: String(item.title ?? 'Annuncio senza titolo'),
        description: String(item.snippet ?? ''),
        type: params.accommodationType !== 'qualsiasi' ? params.accommodationType : 'alloggio',
        pricePerNight: undefined,
        totalPrice: undefined,
        currency: 'EUR',
        source: siteName,
        url: String(item.link ?? ''),
        imageUrl: undefined,
        rating: undefined,
        amenities: params.options.length > 0 ? [...params.options] : undefined,
        bedrooms: undefined,
        maxGuests: params.numPeople,
        saved: false,
      };
    });
  } catch (err) {
    console.error(`[SerpAPI Site:${siteName}] Fetch error:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  const diff = (b - a) / (1000 * 60 * 60 * 24);
  return diff > 0 ? diff : 1;
}
