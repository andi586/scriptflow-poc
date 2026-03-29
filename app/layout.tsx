import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ScriptFlow',
  description: 'From one sentence to a published short drama',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
