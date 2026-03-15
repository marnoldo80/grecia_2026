/**
 * Core type definitions for the Greece Vacation Accommodation Search app.
 * These types are shared between client components, server components, and API routes.
 */

export interface SearchParams {
  location: string;
  /** 'villa' | 'appartamento' | 'hotel' | 'b&b' | 'qualsiasi' | 'casa vacanze' | 'bungalow' */
  accommodationType: string;
  numPeople: number;
  numRooms: number;
  numBathrooms: number;
  /** YYYY-MM-DD format */
  checkIn: string;
  /** YYYY-MM-DD format */
  checkOut: string;
  /** e.g. ['piscina', 'aria condizionata', 'parcheggio', 'vista mare', 'animali ammessi'] */
  options: string[];
}

export interface SearchResult {
  id: string;
  location: string;
  name: string;
  description: string;
  type: string;
  pricePerNight?: number;
  totalPrice?: number;
  /** ISO 4217 currency code, default 'EUR' */
  currency: string;
  /** e.g. 'Google Hotels' | 'Airbnb' | 'Booking.com' | 'Lastminute' | 'HomeToGo' */
  source: string;
  url: string;
  imageUrl?: string;
  /** 0–10 or 0–5 scale depending on source, normalized to 0–10 */
  rating?: number;
  amenities?: string[];
  bedrooms?: number;
  maxGuests?: number;
  /** Whether the user has saved/bookmarked this result */
  saved: boolean;
  /** UUID of the parent search that produced this result */
  searchId?: string;
}

export interface SavedSearch {
  id: string;
  created_at: string;
  location: string;
  accommodation_type: string;
  num_people: number;
  num_rooms: number;
  num_bathrooms: number;
  check_in: string;
  check_out: string;
  options: string[];
  result_count: number;
}
