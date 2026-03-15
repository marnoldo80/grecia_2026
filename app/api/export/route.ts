/**
 * POST /api/export
 *
 * Accepts { results: SearchResult[] } in the body.
 * Generates an Excel (.xlsx) file using the `xlsx` package and
 * streams it back as a downloadable attachment.
 *
 * Columns:
 *   Luogo | Nome Struttura | Descrizione | Tipo | Sito | Prezzo/notte (EUR) |
 *   Prezzo Totale (EUR) | Rating | Servizi | Link
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { SearchResult } from '@/types';

export async function POST(req: NextRequest) {
  let results: SearchResult[];

  try {
    const body = await req.json();
    results = body.results as SearchResult[];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: 'No results provided' }, { status: 400 });
  }

  // Build worksheet rows
  const rows = results.map((r) => ({
    'Luogo': r.location ?? '',
    'Nome Struttura': r.name ?? '',
    'Descrizione': r.description ?? '',
    'Tipo': r.type ?? '',
    'Sito': r.source ?? '',
    'Prezzo/notte (EUR)': r.pricePerNight !== undefined ? Number(r.pricePerNight.toFixed(2)) : '',
    'Prezzo Totale (EUR)': r.totalPrice !== undefined ? Number(r.totalPrice.toFixed(2)) : '',
    'Rating': r.rating !== undefined ? Number(r.rating.toFixed(1)) : '',
    'Servizi': Array.isArray(r.amenities) ? r.amenities.join(', ') : '',
    'Link': r.url ?? '',
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths for readability
  ws['!cols'] = [
    { wch: 16 },  // Luogo
    { wch: 35 },  // Nome Struttura
    { wch: 50 },  // Descrizione
    { wch: 16 },  // Tipo
    { wch: 16 },  // Sito
    { wch: 20 },  // Prezzo/notte
    { wch: 20 },  // Prezzo Totale
    { wch: 10 },  // Rating
    { wch: 50 },  // Servizi
    { wch: 60 },  // Link
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Alloggi Grecia');

  // Generate buffer as Uint8Array for compatibility with NextResponse BodyInit
  const rawBuf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const buf = new Uint8Array(rawBuf);

  const today = new Date().toISOString().slice(0, 10);
  const filename = `alloggi-grecia-${today}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.byteLength),
    },
  });
}
