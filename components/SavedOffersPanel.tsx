'use client';

/**
 * SavedOffersPanel – sliding drawer showing saved/bookmarked accommodations.
 *
 * Features:
 * - Toggle button showing count of saved offers
 * - Slide-in panel from the right
 * - List of saved offers with name, source, price, remove button
 * - Export saved offers as Excel
 * - Backdrop click to close
 */

import React, { useState, useCallback } from 'react';
import { SearchResult } from '@/types';

interface SavedOffersPanelProps {
  savedResults: SearchResult[];
  onRemove: (id: string) => void;
}

export default function SavedOffersPanel({
  savedResults,
  onRemove,
}: SavedOffersPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const count = savedResults.length;

  const handleExport = useCallback(async () => {
    if (savedResults.length === 0) return;
    setIsExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: savedResults }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `offerte-salvate-grecia-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Errore durante l\'esportazione. Riprova.');
    } finally {
      setIsExporting(false);
    }
  }, [savedResults]);

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2
          px-5 py-3 rounded-full shadow-lg text-sm font-bold transition-all
          ${
            count > 0
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
          }`}
      >
        ⭐ Offerte Salvate
        {count > 0 && (
          <span className="bg-white text-amber-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">
            {count}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50
          transform transition-transform duration-300 flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-amber-50">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">⭐ Offerte Salvate</h2>
            <p className="text-xs text-gray-500">
              {count === 0
                ? 'Nessuna offerta salvata'
                : `${count} offert${count === 1 ? 'a' : 'e'} in lista`}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-700 transition text-xl font-bold"
            aria-label="Chiudi pannello"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {count === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-3">
              <span className="text-5xl">🏖️</span>
              <p className="text-sm">
                Salva le offerte che ti interessano<br />usando il pulsante 💾 nei risultati.
              </p>
            </div>
          ) : (
            savedResults.map((r) => (
              <SavedCard key={r.id} result={r} onRemove={onRemove} />
            ))
          )}
        </div>

        {/* Footer */}
        {count > 0 && (
          <div className="border-t border-gray-200 px-4 py-4">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2
                px-4 py-3 bg-green-600 hover:bg-green-700 text-white
                font-semibold rounded-xl transition disabled:opacity-50"
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
                <>📊 Esporta {count} {count === 1 ? 'offerta' : 'offerte'} in Excel</>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Single saved offer card inside the drawer
// ---------------------------------------------------------------------------
function SavedCard({
  result,
  onRemove,
}: {
  result: SearchResult;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex gap-3 shadow-sm">
      {result.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.imageUrl}
          alt={result.name}
          className="w-16 h-16 object-cover rounded-lg shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">{result.name}</p>
        <p className="text-xs text-gray-500">{result.location}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">{result.source}</span>
          {result.pricePerNight !== undefined && (
            <span className="text-xs font-bold text-blue-700">
              €{result.pricePerNight.toFixed(0)}/notte
            </span>
          )}
          {result.rating !== undefined && (
            <span className="text-xs text-amber-600">⭐ {result.rating.toFixed(1)}</span>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Visita ↗
            </a>
          )}
          <button
            onClick={() => onRemove(result.id)}
            className="text-xs font-semibold text-red-500 hover:text-red-700 transition"
          >
            Rimuovi
          </button>
        </div>
      </div>
    </div>
  );
}
