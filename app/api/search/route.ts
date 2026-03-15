/**
 * POST /api/search
 *
 * Accepts SearchParams in the request body.
 * Fans out to all accommodation sources in parallel, deduplicates results,
 * persists to Supabase, and returns { searchId, results }.
 *
 * Individual source failures are swallowed – the others continue normally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { searchGoogleHotels, searchSiteSpecific } from '@/lib/serpapi';
import { searchAirbnb } from '@/lib/rapidapi-airbnb';
import { searchBooking } from '@/lib/rapidapi-booking';
import { enrichResults, nightsBetween } from '@/lib/gemini';
import { SearchParams, SearchResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let params: SearchParams;

  try {
    params = (await req.json()) as SearchParams;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Basic validation
  if (!params.location) {
    return NextResponse.json({ error: 'location is required' }, { status: 400 });
  }

  // 1. Persist the search to Supabase (result_count will be updated later)
  const searchId = uuidv4();

  const { error: insertSearchError } = await supabase.from('searches').insert({
    id: searchId,
    location: params.location,
    accommodation_type: params.accommodationType ?? null,
    num_people: params.numPeople ?? null,
    num_rooms: params.numRooms ?? null,
    check_in: params.checkIn ?? null,
    check_out: params.checkOut ?? null,
    options: params.options ?? [],
    result_count: 0,
  });

  if (insertSearchError) {
    // Non-fatal – we log but continue
    console.error('[Search API] Failed to insert search record:', insertSearchError.message);
  }

  // 2. Fan out to all sources in parallel; catch each individually
  const [
    googleResults,
    airbnbResults,
    bookingResults,
    lastminuteResults,
    hometogoResults,
  ] = await Promise.all([
    safeCall('Google Hotels', () => searchGoogleHotels(params)),
    safeCall('Airbnb', () => searchAirbnb(params)),
    safeCall('Booking.com', () => searchBooking(params)),
    safeCall('Lastminute', () =>
      searchSiteSpecific(params, 'lastminute.com', 'Lastminute')
    ),
    safeCall('HomeToGo', () =>
      searchSiteSpecific(params, 'hometogo.it', 'HomeToGo')
    ),
  ]);

  // 3. Enrich web-search results (Lastminute, HomeToGo) with Gemini
  //    – extracts price, bedrooms, amenities from raw snippets
  const nights = nightsBetween(params.checkIn ?? '2026-08-01', params.checkOut ?? '2026-08-15');
  const [enrichedLastminute, enrichedHometogo] = await Promise.all([
    enrichResults(lastminuteResults, nights),
    enrichResults(hometogoResults, nights),
  ]);

  // 4. Merge all results and tag with searchId
  const all: SearchResult[] = [
    ...googleResults,
    ...airbnbResults,
    ...bookingResults,
    ...enrichedLastminute,
    ...enrichedHometogo,
  ].map((r) => ({ ...r, searchId }));

  // 4. Deduplicate by URL (case-insensitive, strip trailing slash)
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const result of all) {
    const key = normalizeUrl(result.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }

  // 5. Persist results to Supabase
  if (deduped.length > 0) {
    // Insert in batches of 50 to avoid payload limits
    const BATCH = 50;
    for (let i = 0; i < deduped.length; i += BATCH) {
      const batch = deduped.slice(i, i + BATCH);
      const { error: insertResultsError } = await supabase.from('results').insert(
        batch.map((r) => ({
          id: r.id,
          search_id: searchId,
          location: r.location,
          name: r.name,
          description: r.description,
          type: r.type,
          price_per_night: r.pricePerNight ?? null,
          total_price: r.totalPrice ?? null,
          currency: r.currency,
          source: r.source,
          url: r.url,
          image_url: r.imageUrl ?? null,
          rating: r.rating ?? null,
          amenities: r.amenities ?? [],
          bedrooms: r.bedrooms ?? null,
          max_guests: r.maxGuests ?? null,
          saved: false,
        }))
      );
      if (insertResultsError) {
        console.error('[Search API] Failed to insert results batch:', insertResultsError.message);
      }
    }

    // Update result_count on the search row
    await supabase
      .from('searches')
      .update({ result_count: deduped.length })
      .eq('id', searchId);
  }

  return NextResponse.json({
    searchId,
    results: deduped,
    sourceCount: countSources(deduped),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a source-fetch call so failures are logged but never bubble up.
 */
async function safeCall(
  sourceName: string,
  fn: () => Promise<SearchResult[]>
): Promise<SearchResult[]> {
  try {
    const results = await fn();
    console.info(`[Search API] ${sourceName}: ${results.length} results`);
    return results;
  } catch (err) {
    console.error(`[Search API] ${sourceName} failed:`, err);
    return [];
  }
}

function normalizeUrl(url: string): string {
  try {
    return url.toLowerCase().replace(/\/+$/, '').trim();
  } catch {
    return url;
  }
}

function countSources(results: SearchResult[]): number {
  return new Set(results.map((r) => r.source)).size;
}
