/**
 * /api/saved
 *
 * GET  – returns all results where saved = true
 * POST – body: { resultId: string } – toggles the saved flag for that result
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/saved
// ---------------------------------------------------------------------------
export async function GET() {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('saved', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Saved API] GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map DB rows (snake_case) back to SearchResult (camelCase)
  const results = (data ?? []).map(mapRowToResult);

  return NextResponse.json({ results });
}

// ---------------------------------------------------------------------------
// POST /api/saved – toggle saved status
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let resultId: string;

  try {
    const body = await req.json();
    resultId = body.resultId;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!resultId) {
    return NextResponse.json({ error: 'resultId is required' }, { status: 400 });
  }

  // Fetch current saved state
  const { data: existing, error: fetchError } = await supabase
    .from('results')
    .select('saved')
    .eq('id', resultId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 });
  }

  const newSavedState = !existing.saved;

  const { error: updateError } = await supabase
    .from('results')
    .update({ saved: newSavedState })
    .eq('id', resultId);

  if (updateError) {
    console.error('[Saved API] Update error:', updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ resultId, saved: newSavedState });
}

// ---------------------------------------------------------------------------
// Helper – map Supabase row (snake_case) → SearchResult (camelCase)
// ---------------------------------------------------------------------------
function mapRowToResult(row: Record<string, unknown>) {
  return {
    id: row.id,
    location: row.location,
    name: row.name,
    description: row.description,
    type: row.type,
    pricePerNight: row.price_per_night,
    totalPrice: row.total_price,
    currency: row.currency ?? 'EUR',
    source: row.source,
    url: row.url,
    imageUrl: row.image_url,
    rating: row.rating,
    amenities: row.amenities,
    bedrooms: row.bedrooms,
    maxGuests: row.max_guests,
    saved: row.saved,
    searchId: row.search_id,
  };
}
