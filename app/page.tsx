'use client';

/**
 * Main page – Greece Vacation Accommodation Search
 *
 * Flow:
 * 1. User fills SearchForm → POST /api/search
 * 2. Loading spinner shown while request is in flight
 * 3. ResultsTable renders with results
 * 4. SavedOffersPanel floats in corner; user can bookmark/export
 */

import React, { useState, useCallback } from 'react';
import SearchForm from '@/components/SearchForm';
import ResultsTable from '@/components/ResultsTable';
import SavedOffersPanel from '@/components/SavedOffersPanel';
import { SearchParams, SearchResult } from '@/types';

// ---------------------------------------------------------------------------
// Source labels for the loading animation
// ---------------------------------------------------------------------------
const SEARCH_SOURCES = [
  'Google Hotels',
  'Airbnb',
  'Booking.com',
  'Lastminute',
  'HomeToGo',
];

export default function HomePage() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cycle through source names during loading for animated feedback
  const startLoadingAnimation = useCallback(() => {
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % SEARCH_SOURCES.length;
      setLoadingSource(idx);
    }, 800);
    return interval;
  }, []);

  const handleSearch = useCallback(
    async (params: SearchParams) => {
      setIsLoading(true);
      setError(null);
      setResults([]);
      setHasSearched(false);

      const startTime = Date.now();
      const interval = startLoadingAnimation();

      // Track elapsed time
      const timer = setInterval(() => {
        setElapsedSeconds((Date.now() - startTime) / 1000);
      }, 200);

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Errore HTTP ${res.status}`);
        }

        const data: { results: SearchResult[]; searchId: string } = await res.json();

        setResults(data.results ?? []);
        setElapsedSeconds((Date.now() - startTime) / 1000);
        setHasSearched(true);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Errore sconosciuto durante la ricerca';
        setError(message);
        setHasSearched(true);
      } finally {
        clearInterval(interval);
        clearInterval(timer);
        setIsLoading(false);
      }
    },
    [startLoadingAnimation]
  );

  // Toggle save locally (optimistic) and sync to server
  const handleToggleSave = useCallback(async (id: string) => {
    // Optimistic update
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, saved: !r.saved } : r))
    );

    // Sync to server (non-blocking, best-effort)
    try {
      await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId: id }),
      });
    } catch (err) {
      console.error('Failed to sync saved state:', err);
    }
  }, []);

  const savedResults = results.filter((r) => r.saved);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-white">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header className="bg-white shadow-sm border-b border-blue-100">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-blue-800 flex items-center gap-2">
              🇬🇷 🏖️ Trova Alloggi in Grecia
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Cerca tra Booking, Airbnb, Google Hotels e molto altro
            </p>
          </div>
          <div className="text-right text-xs text-gray-400 leading-relaxed">
            <p>Estate 2026 · Prezzi in EUR</p>
            <p>Aggiornato in tempo reale</p>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                         */}
      {/* ------------------------------------------------------------------ */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Search form */}
        <SearchForm onSearch={handleSearch} isLoading={isLoading} />

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative">
              {/* Outer ring */}
              <div className="w-20 h-20 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              {/* Inner emoji */}
              <div className="absolute inset-0 flex items-center justify-center text-2xl">
                🏝
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-700 font-semibold text-lg">
                Sto cercando su{' '}
                <span className="text-blue-600 font-bold transition-all">
                  {SEARCH_SOURCES[loadingSource]}
                </span>
                …
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Interrogo {SEARCH_SOURCES.length} sorgenti in parallelo
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                {elapsedSeconds.toFixed(1)}s trascorsi
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
            <p className="font-semibold">❌ Errore durante la ricerca</p>
            <p className="text-sm mt-1">{error}</p>
            <p className="text-xs text-red-400 mt-2">
              Riprova oppure controlla la tua connessione internet.
            </p>
          </div>
        )}

        {/* Empty state after search */}
        {!isLoading && hasSearched && !error && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center text-gray-500">
            <span className="text-5xl">🔍</span>
            <p className="font-semibold text-lg">Nessun risultato trovato</p>
            <p className="text-sm max-w-md">
              Prova a modificare la destinazione, le date o il tipo di alloggio.
            </p>
          </div>
        )}

        {/* Results */}
        {!isLoading && results.length > 0 && (
          <ResultsTable
            results={results}
            elapsedSeconds={elapsedSeconds}
            onToggleSave={handleToggleSave}
          />
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-gray-400 space-y-1">
          <p>
            I prezzi e la disponibilità sono forniti da sorgenti esterne (Google Hotels, Airbnb,
            Booking.com, Lastminute, HomeToGo) e potrebbero non essere aggiornati in tempo reale.
          </p>
          <p>
            Verifica sempre i dettagli direttamente sul sito del fornitore prima di prenotare.
          </p>
          <p className="text-gray-300">
            Vacanze Grecia 2026 · Strumento di ricerca non commerciale
          </p>
        </div>
      </footer>

      {/* Saved offers floating panel */}
      <SavedOffersPanel savedResults={savedResults} onRemove={handleToggleSave} />
    </div>
  );
}
