import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Image from 'next/image';

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
        <div className="min-h-screen bg-dark-300">
          <header className="bg-dark-100 text-white p-4 shadow-md border-b border-primary-700/30">
            <div className="w-full px-4">
              <Image 
                src="/wordmark.svg" 
                alt="GeneralAgents Logo" 
                width={200} 
                height={30} 
                priority
                className="h-8 w-auto invert brightness-200 filter"
              />
            </div>
          </header>
          <main className="w-full px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
} 