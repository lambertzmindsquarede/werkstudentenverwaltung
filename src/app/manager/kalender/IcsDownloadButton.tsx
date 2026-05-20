'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  weekStr: string
  bereichFilter?: string | null
}

export default function IcsDownloadButton({ weekStr, bereichFilter }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ week: weekStr })
      if (bereichFilter) params.set('bereich', bereichFilter)
      const res = await fetch(`/api/ics/download?${params.toString()}`)
      if (!res.ok) {
        console.error('[IcsDownloadButton] Download failed:', res.status)
        return
      }
      const blob = await res.blob()
      const kw = weekStr.replace('-W', '-kw').replace(/^(\d{4})-kw(\d+)$/, 'kw$2-$1')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wochenplan-${kw}.ics`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs gap-1.5"
      onClick={handleDownload}
      disabled={loading}
      aria-label="ICS-Datei für diese Woche herunterladen"
    >
      {loading ? 'Lädt…' : '↓ ICS herunterladen'}
    </Button>
  )
}
