'use client';

/**
 * SearchForm – main search interface for Greece accommodations.
 *
 * Features:
 * - Location text input with autocomplete dropdown
 * - Accommodation type select
 * - People / rooms number inputs
 * - Check-in / check-out date pickers (default Aug 1–15 2026)
 * - Extra options as checkboxes
 * - Submit with loading state
 */

import React, { useState, useRef, useEffect } from 'react';
import { SearchParams } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LOCATION_SUGGESTIONS = [
  'Santorini',
  'Mykonos',
  'Creta',
  'Rodi',
  'Corfu',
  'Atene',
  'Salonicco',
  'Zante',
  'Lefkada',
  'Cefalonia',
  'Skiathos',
  'Paros',
  'Naxos',
  'Karpathos',
  'Kos',
];

const ACCOMMODATION_TYPES = [
  { value: 'qualsiasi', label: 'Qualsiasi' },
  { value: 'villa', label: 'Villa' },
  { value: 'appartamento', label: 'Appartamento' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'b&b', label: 'B&B' },
  { value: 'casa vacanze', label: 'Casa Vacanze' },
  { value: 'bungalow', label: 'Bungalow' },
];

const EXTRA_OPTIONS = [
  { value: 'piscina', label: 'Piscina' },
  { value: 'vista mare', label: 'Vista mare' },
  { value: 'aria condizionata', label: 'Aria condizionata' },
  { value: 'parcheggio', label: 'Parcheggio' },
  { value: 'animali ammessi', label: 'Animali ammessi' },
  { value: 'cucina attrezzata', label: 'Cucina attrezzata' },
  { value: 'spiaggia privata', label: 'Spiaggia privata' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'barbecue', label: 'Barbecue' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [location, setLocation] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [accommodationType, setAccommodationType] = useState('qualsiasi');
  const [numPeople, setNumPeople] = useState(2);
  const [numRooms, setNumRooms] = useState(1);
  const [checkIn, setCheckIn] = useState('2026-08-01');
  const [checkOut, setCheckOut] = useState('2026-08-15');
  const [options, setOptions] = useState<string[]>([]);

  const locationRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuggestions = LOCATION_SUGGESTIONS.filter((s) =>
    s.toLowerCase().includes(location.toLowerCase())
  );

  function toggleOption(value: string) {
    setOptions((prev) =>
      prev.includes(value) ? prev.filter((o) => o !== value) : [...prev, value]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim()) return;
    onSearch({
      location: location.trim(),
      accommodationType,
      numPeople,
      numRooms,
      checkIn,
      checkOut,
      options,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 md:p-8 space-y-6"
    >
      {/* Row 1 – Location + Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Location */}
        <div ref={locationRef} className="relative">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            📍 Destinazione
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Es. Santorini, Creta, Mykonos…"
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder-gray-400 transition"
          />
          {/* Suggestions dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200
                           rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {filteredSuggestions.map((s) => (
                <li
                  key={s}
                  onMouseDown={() => {
                    setLocation(s);
                    setShowSuggestions(false);
                  }}
                  className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 text-gray-700
                             text-sm flex items-center gap-2"
                >
                  <span className="text-blue-400">🏝</span> {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Accommodation type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            🏠 Tipo di alloggio
          </label>
          <select
            value={accommodationType}
            onChange={(e) => setAccommodationType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       bg-white transition"
          >
            {ACCOMMODATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2 – People + Rooms + Dates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* People */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            👥 Persone
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={numPeople}
            onChange={(e) => setNumPeople(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Rooms */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            🛏 Camere
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={numRooms}
            onChange={(e) => setNumRooms(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Check-in */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            📅 Check-in
          </label>
          <input
            type="date"
            value={checkIn}
            min="2026-01-01"
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Check-out */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            📅 Check-out
          </label>
          <input
            type="date"
            value={checkOut}
            min={checkIn}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
      </div>

      {/* Row 3 – Extra options */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          ✨ Servizi extra
        </label>
        <div className="flex flex-wrap gap-2">
          {EXTRA_OPTIONS.map((opt) => {
            const active = options.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleOption(opt.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                  ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                  }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading || !location.trim()}
          className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold text-base
                     shadow-md hover:bg-blue-700 active:scale-95
                     disabled:opacity-60 disabled:cursor-not-allowed
                     transition-all duration-150 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Ricerca in corso…
            </>
          ) : (
            'Cerca Offerte 🔍'
          )}
        </button>
      </div>
    </form>
  );
}
