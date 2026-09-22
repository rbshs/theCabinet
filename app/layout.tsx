import './globals.css';
import Navigation from './Navigation';

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:block focus:p-4">
          Skip to content
        </a>
        <Navigation />
        <main id="main-content" className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
