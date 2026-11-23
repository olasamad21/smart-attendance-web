import type { Metadata, Viewport } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'EduVerify — Smart Attendance',
  description: 'Attendance that verifies itself — face, liveness and location checks from any phone.',
  applicationName: 'EduVerify',
  appleWebApp: { capable: true, title: 'EduVerify', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f9ff' },
    { media: '(prefers-color-scheme: dark)', color: '#10141a' },
  ],
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-background text-on-background min-h-[100dvh] font-sans antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
