import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Biotech Screener',
  description: 'FDA catalyst stock screener with LLM-driven NPV analysis',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-neutral-200 antialiased">
        <Providers>
          <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-sm">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                Biotech Screener
              </Link>
              <nav className="flex items-center gap-6 text-sm">
                <Link href="/" className="text-neutral-400 hover:text-neutral-100 transition">Screener</Link>
                <Link href="/watchlist" className="text-neutral-400 hover:text-neutral-100 transition">Watchlist</Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-8">
            {children}
          </main>
          <footer className="border-t border-border mt-16">
            <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-neutral-600">
              FDA catalyst screener · LLM NPV analysis · Data: Finnhub, yfinance, NewsAPI, SEC
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
