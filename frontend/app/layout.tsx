import type { Metadata } from 'next';
import './globals.css';
import '@aejkatappaja/phantom-ui/ssr.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'ByteCommerce | Online Shop & Flash Sale',
  description: 'Flash Sale Engine - Belanja cepat, harga terbaik',
};

// Anti-flicker: runs before paint to set theme from localStorage.
// Default is light — only sets dark if user explicitly chose it.
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    // t === 'light' or null → do nothing, default is light
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
