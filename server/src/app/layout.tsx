import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Screen Recording Visualizer',
  description: 'Visualize screen recordings with synchronized mouse and keyboard events',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-primary-600 text-white p-4 shadow-md">
            <div className="container mx-auto">
              <h1 className="text-2xl font-bold">Screen Recording Visualizer</h1>
            </div>
          </header>
          <main className="container mx-auto py-6 px-4">{children}</main>
        </div>
      </body>
    </html>
  );
} 