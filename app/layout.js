import './globals.css';
import { AppProvider } from '@/lib/store';

export const metadata = {
  title: 'FluentRead — AI Reading Feedback',
  description:
    'Read any text aloud and get AI-powered feedback on your English pronunciation.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
