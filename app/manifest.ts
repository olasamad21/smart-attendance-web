import type { MetadataRoute } from 'next';

/** Web app manifest: lets students and lecturers install EduVerify to their home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'EduVerify — Smart Attendance',
    short_name: 'EduVerify',
    description: 'Attendance that verifies itself — face, liveness and location checks from any phone.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#00535b',
    theme_color: '#00535b',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Check in',
        short_name: 'Check in',
        description: 'Open your dashboard to check in to a live class',
        url: '/student/dashboard',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Lecturer dashboard',
        short_name: 'Lecturer',
        description: 'Start or monitor an attendance session',
        url: '/lecturer/dashboard',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
