import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Werkstudentenverwaltung – mindsquare',
  description: 'Verwaltung von Werkstudenten-Arbeitszeiten bei mindsquare',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}
