'use client';

/**
 * ResultsTable – displays search results with filtering, sorting and export.
 *
 * Features:
 * - Stats bar (count / sources / time)
 * - Filter by source (checkbox pills)
 * - Sort by price / rating / name
 * - Max price filter
 * - Desktop: full table
 * - Mobile: card list
 * - Per-row: "Visita offerta" link + Save toggle
 * - Export all visible results as Excel
 */

import React, { useState, useMemo, useCallback } from 'react';
import { SearchResult } from '@/types';

// ---------------------------------------------------------------------------
// Source badge colours
// ---------------------------------------------------------------------------
const SOURCE_COLOURS: Record<string, string> = {
  'Google Hotels': 'bg-blue-100 text-blue-800 border-blue-200',
  Airbnb: 'bg-red-100 text-red-800 border-red-200',
  'Booking.com': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Lastminute: 'bg-orange-100 text-orange-800 border-orange-200',
  HomeToGo: 'bg-green-100 text-green-800 border-green-200',
  Demo: 'bg-gray-100 text-gray-600 border-gray-200',
};

function sourceBadge(source: string) {
  const cls = SOURCE_COLOURS[source] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {source}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ResultsTableProps {
  results: SearchResult[];
  elapsedSeconds: number;
  onToggleSave: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ResultsTable({
  results,
  elapsedSeconds,
  onToggleSave,
}: ResultsTableProps) {
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'price' | 'total' | 'rating' | 'name'>('price');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Unique sources
  const allSources = useMemo(
    () => Array.from(new Set(results.map((r) => r.source))).sort(),
    [results]
  );

  const sourceCount = allSources.length;
  const totalResults = results.length;

  function toggleSource(src: string) {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  }

  // Filtered + sorted results
  const visible = useMemo(() => {
    let filtered = [...results];

    // Source filter (if any selected)
    if (selectedSources.size > 0) {
      filtered = filtered.filter((r) => selectedSources.has(r.source));
    }

    // Max price filter
    const maxPriceNum = parseFloat(maxPrice);
    if (!isNaN(maxPriceNum) && maxPriceNum > 0) {
      filtered = filtered.filter(
        (r) => r.pricePerNight === undefined || r.pricePerNight <= maxPriceNum
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'price') {
        const pa = a.pricePerNight ?? Infinity;
        const pb = b.pricePerNight ?? Infinity;
        return pa - pb;
      }
      if (sortBy === 'total') {
        const pa = a.totalPrice ?? Infinity;
        const pb = b.totalPrice ?? Infinity;
        return pa - pb;
      }
      if (sortBy === 'rating') {
        const ra = a.rating ?? 0;
        const rb = b.rating ?? 0;
        return rb - ra; // descending
      }
      // name
      return a.name.localeCompare(b.name, 'it');
    });

    return filtered;
  }, [results, selectedSources, maxPrice, sortBy]);

  // Export visible results as Excel
  const handleExport = useCallback(async () => {
    if (visible.length === 0) return;
    setIsExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: visible }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alloggi-grecia-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Errore durante l\'esportazione. Riprova.');
    } finally {
      setIsExporting(false);
    }
  }, [visible]);

  if (results.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-gray-700 font-medium">
          <span className="text-blue-700 font-bold text-lg">{visible.length}</span>
          {visible.length !== totalResults && (
            <span className="text-gray-500 text-sm"> (di {totalResults})</span>
          )}{' '}
          risultati trovati da{' '}
          <span className="text-blue-700 font-bold">{sourceCount}</span>{' '}
          {sourceCount === 1 ? 'sorgente' : 'sorgenti'} in{' '}
          <span className="text-blue-700 font-bold">{elapsedSeconds.toFixed(1)}s</span>
        </p>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={isExporting || visible.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700
                     text-white text-sm font-semibold rounded-lg shadow transition
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Esportazione…
            </>
          ) : (
            <>📊 Esporta Excel ({visible.length})</>
          )}
        </button>
      </div>

      {/* Filter / sort bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        {/* Source filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Sorgenti:
          </span>
          {allSources.map((src) => {
            const active = selectedSources.has(src);
            const colourBase = SOURCE_COLOURS[src] ?? 'bg-gray-100 text-gray-600 border-gray-200';
            return (
              <button
                key={src}
                onClick={() => toggleSource(src)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition
                  ${active ? colourBase + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-400'}`}
              >
                {src} ({results.filter((r) => r.source === src).length})
              </button>
            );
          })}
          {selectedSources.size > 0 && (
            <button
              onClick={() => setSelectedSources(new Set())}
              className="text-xs text-gray-400 hover:text-red-500 underline ml-1"
            >
              Rimuovi filtri
            </button>
          )}
        </div>

        {/* Sort + max price */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Ordina:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'price' | 'total' | 'rating' | 'name')}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="price">Prezzo/notte (crescente)</option>
              <option value="total">Prezzo totale (crescente)</option>
              <option value="rating">Rating (decrescente)</option>
              <option value="name">Nome (A–Z)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Prezzo max:
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
              <input
                type="number"
                min={0}
                placeholder="Nessun limite"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm text-gray-700
                           focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-blue-50 text-gray-600 uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome / Luogo</th>
              <th className="px-4 py-3 font-semibold">Descrizione</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Sito</th>
              <th className="px-4 py-3 font-semibold text-right">Prezzo/notte</th>
              <th className="px-4 py-3 font-semibold text-right">Prezzo Totale</th>
              <th className="px-4 py-3 font-semibold text-center">Rating</th>
              <th className="px-4 py-3 font-semibold">Servizi</th>
              <th className="px-4 py-3 font-semibold text-center">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((r) => (
              <TableRow key={r.id} result={r} onToggleSave={onToggleSave} />
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="text-center text-gray-400 py-10">
            Nessun risultato corrisponde ai filtri selezionati.
          </p>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {visible.map((r) => (
          <MobileCard key={r.id} result={r} onToggleSave={onToggleSave} />
        ))}
        {visible.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            Nessun risultato corrisponde ai filtri selezionati.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop table row
// ---------------------------------------------------------------------------
function TableRow({
  result,
  onToggleSave,
}: {
  result: SearchResult;
  onToggleSave: (id: string) => void;
}) {
  return (
    <tr className="bg-white hover:bg-blue-50/40 transition-colors">
      {/* Name + location */}
      <td className="px-4 py-3 max-w-[200px]">
        {result.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.imageUrl}
            alt={result.name}
            className="w-16 h-12 object-cover rounded-lg mb-1"
          />
        )}
        <p className="font-semibold text-gray-800 leading-tight">{result.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{result.location}</p>
      </td>

      {/* Description */}
      <td className="px-4 py-3 max-w-[240px]">
        <p className="text-gray-600 text-xs line-clamp-3">{result.description || '—'}</p>
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        <span className="capitalize text-gray-700 text-xs bg-gray-100 px-2 py-1 rounded">
          {result.type}
        </span>
      </td>

      {/* Source */}
      <td className="px-4 py-3">{sourceBadge(result.source)}</td>

      {/* Price/night */}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {result.pricePerNight !== undefined ? (
          <span className="font-bold text-blue-700">
            €{result.pricePerNight.toFixed(0)}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">N/D</span>
        )}
      </td>

      {/* Total price */}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {result.totalPrice !== undefined ? (
          <div className="flex flex-col items-end">
            <span className="font-bold text-green-700">
              €{result.totalPrice.toFixed(0)}
            </span>
            <span className="text-xs text-gray-400">totale soggiorno</span>
          </div>
        ) : result.pricePerNight !== undefined ? (
          <span className="text-gray-400 text-xs">N/D</span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>

      {/* Rating */}
      <td className="px-4 py-3 text-center">
        {result.rating !== undefined ? (
          <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
            ⭐ {result.rating.toFixed(1)}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>

      {/* Amenities */}
      <td className="px-4 py-3 max-w-[180px]">
        {result.amenities && result.amenities.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {result.amenities.slice(0, 4).map((a) => (
              <span
                key={a}
                className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded"
              >
                {a}
              </span>
            ))}
            {result.amenities.length > 4 && (
              <span className="text-xs text-gray-400">+{result.amenities.length - 4}</span>
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5 items-center">
          {result.url ? (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700
                         px-3 py-1.5 rounded-lg transition whitespace-nowrap"
            >
              Visita offerta ↗
            </a>
          ) : null}
          <button
            onClick={() => onToggleSave(result.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition whitespace-nowrap
              ${
                result.saved
                  ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400 hover:text-amber-600'
              }`}
          >
            {result.saved ? '⭐ Salvata' : '💾 Salva'}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------
function MobileCard({
  result,
  onToggleSave,
}: {
  result: SearchResult;
  onToggleSave: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {result.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.imageUrl}
          alt={result.name}
          className="w-full h-44 object-cover"
        />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-gray-800 leading-tight">{result.name}</h3>
            <p className="text-xs text-gray-500">{result.location}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {sourceBadge(result.source)}
            {result.pricePerNight !== undefined && (
              <span className="font-bold text-blue-700 text-lg">
                €{result.pricePerNight.toFixed(0)}
                <span className="text-xs font-normal text-gray-400">/notte</span>
              </span>
            )}
            {result.totalPrice !== undefined && (
              <span className="font-semibold text-green-700 text-sm">
                €{result.totalPrice.toFixed(0)}
                <span className="text-xs font-normal text-gray-400"> totale</span>
              </span>
            )}
          </div>
        </div>

        {result.description && (
          <p className="text-xs text-gray-600 line-clamp-2">{result.description}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">
              {result.type}
            </span>
            {result.rating !== undefined && (
              <span className="text-xs font-semibold text-amber-600">
                ⭐ {result.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {result.amenities && result.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {result.amenities.slice(0, 5).map((a) => (
              <span key={a} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                {a}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-sm font-semibold text-white
                         bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition"
            >
              Visita offerta ↗
            </a>
          )}
          <button
            onClick={() => onToggleSave(result.id)}
            className={`flex-1 text-sm font-semibold px-3 py-2 rounded-lg border transition
              ${
                result.saved
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
          >
            {result.saved ? '⭐ Salvata' : '💾 Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
