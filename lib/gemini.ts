/**
 * Google Gemini integration for enriching raw web-search snippets.
 *
 * When SerpAPI returns unstructured text snippets (e.g. from lastminute.com,
 * hometogo.it, greeka.com) Gemini extracts structured fields:
 *   – pricePerNight, totalPrice
 *   – bedrooms, maxGuests
 *   – amenities[]
 *   – description (cleaned / translated to Italian)
 *
 * Model: gemini-2.0-flash (free tier: 1500 req/day, 15 RPM)
 * All calls are server-side only.
 */

import { SearchResult } from '@/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GeminiExtracted {
  pricePerNight?: number;
  totalPrice?: number;
  bedrooms?: number;
  maxGuests?: number;
  amenities?: string[];
  description?: string;
}

// ---------------------------------------------------------------------------
// Core call – single prompt → JSON
// ---------------------------------------------------------------------------
async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
}

// ---------------------------------------------------------------------------
// extractFromSnippet – parse one search result's title + snippet
// ---------------------------------------------------------------------------
async function extractFromSnippet(
  title: string,
  snippet: string,
  nights: number
): Promise<GeminiExtracted> {
  const prompt = `
Sei un assistente per l'estrazione di dati su alloggi turistici in Grecia.
Dato questo titolo e snippet di un risultato di ricerca web, estrai le informazioni disponibili.

Titolo: "${title}"
Snippet: "${snippet}"
Numero notti soggiorno: ${nights}

Restituisci SOLO un oggetto JSON valido con questi campi (ometti i campi non trovati):
{
  "pricePerNight": <numero intero in EUR, solo se esplicitamente indicato>,
  "totalPrice": <numero intero in EUR, solo se esplicitamente indicato, oppure calcolato da pricePerNight * ${nights}>,
  "bedrooms": <numero camere da letto, solo se indicato>,
  "maxGuests": <numero massimo ospiti, solo se indicato>,
  "amenities": ["servizio1", "servizio2"],
  "description": "<descrizione pulita in italiano, max 120 caratteri>"
}

Regole:
- I prezzi devono essere numeri interi, senza simboli di valuta
- Se il prezzo è per settimana, dividilo per 7 per ottenere il prezzo per notte
- amenities: includi solo servizi confermati (piscina, wifi, aria condizionata, ecc.)
- Se non ci sono dati sufficienti per un campo, omettilo
- Rispondi SOLO con il JSON, nessun testo aggiuntivo
`;

  try {
    const raw = await callGemini(prompt);
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned) as GeminiExtracted;
  } catch (err) {
    console.warn('[Gemini] Failed to parse extraction:', err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// enrichResults – enrich an array of SearchResult[] with Gemini
// ---------------------------------------------------------------------------
export async function enrichResults(
  results: SearchResult[],
  nights: number
): Promise<SearchResult[]> {
  if (!GEMINI_API_KEY) {
    console.warn('[Gemini] GEMINI_API_KEY not set – skipping enrichment');
    return results;
  }

  if (results.length === 0) return results;

  // Process in parallel with a concurrency limit of 5 to respect rate limits
  const CONCURRENCY = 5;
  const enriched: SearchResult[] = [];

  for (let i = 0; i < results.length; i += CONCURRENCY) {
    const batch = results.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (r): Promise<SearchResult> => {
        // Skip enrichment if we already have good structured data
        if (r.pricePerNight !== undefined && r.description && r.description.length > 30) {
          return r;
        }

        const extracted = await extractFromSnippet(r.name, r.description ?? '', nights);

        return {
          ...r,
          pricePerNight: r.pricePerNight ?? extracted.pricePerNight,
          totalPrice:
            r.totalPrice ??
            extracted.totalPrice ??
            (extracted.pricePerNight ? extracted.pricePerNight * nights : undefined),
          bedrooms: r.bedrooms ?? extracted.bedrooms,
          maxGuests: r.maxGuests ?? extracted.maxGuests,
          amenities:
            r.amenities && r.amenities.length > 0
              ? r.amenities
              : extracted.amenities ?? [],
          description:
            r.description && r.description.length > 30
              ? r.description
              : (extracted.description ?? r.description),
        };
      })
    );

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        enriched.push(result.value);
      } else {
        console.warn('[Gemini] Enrichment failed for one result:', result.reason);
        // Push original unenriched
        enriched.push(batch[settled.indexOf(result)]);
      }
    }
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// nightsBetween helper
// ---------------------------------------------------------------------------
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  const diff = (b - a) / (1000 * 60 * 60 * 24);
  return diff > 0 ? Math.round(diff) : 1;
}
