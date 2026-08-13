import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Mass Finder — when and where is the next Mass?',
  description:
    'Find the next Catholic Mass near you: the time, the church, what is being celebrated, and how to get there.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never block zoom. Some readers rely on it entirely.
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="masthead">
          <div className="masthead-inner">
            <a className="wordmark" href="/">
              Mass Finder
            </a>
            <span className="masthead-note">Catholic Mass times, anywhere</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
