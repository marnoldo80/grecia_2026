import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Vacanze Grecia 2026 – Cerca Alloggi',
  description:
    'Trova villa, appartamento, hotel o B&B in Grecia per l\'estate 2026. ' +
    'Cerca su Booking.com, Airbnb, Google Hotels, Lastminute e HomeToGo ' +
    'in un\'unica schermata. Filtra per prezzo, servizi e scarica i risultati in Excel.',
  keywords: [
    'vacanze grecia 2026',
    'alloggi grecia',
    'villa grecia affitto',
    'hotel grecia',
    'santorini mykonos creta',
    'booking airbnb grecia',
  ],
  openGraph: {
    title: 'Vacanze Grecia 2026 – Cerca Alloggi',
    description: 'Cerca tra centinaia di offerte per alloggi in Grecia estate 2026.',
    type: 'website',
    locale: 'it_IT',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
