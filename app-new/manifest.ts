export default function manifest() {
  return {
    name: 'ScriptFlow',
    short_name: 'ScriptFlow',
    description: 'Step through the door. Become anyone.',
    start_url: '/app-flow',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
