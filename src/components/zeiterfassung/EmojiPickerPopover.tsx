'use client'

import { useEffect, useRef, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const FAVORITES = [
  { emoji: '🚀', label: 'Motiviert' },
  { emoji: '😊', label: 'Gut' },
  { emoji: '😐', label: 'Neutral' },
  { emoji: '😴', label: 'Müde' },
  { emoji: '😤', label: 'Gestresst' },
  { emoji: '🤒', label: 'Krank' },
]

function EmojiMartPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    let mounted = true
    const container = containerRef.current
    if (!container) return

    Promise.all([
      import('emoji-mart'),
      import('@emoji-mart/data'),
    ]).then(([{ Picker }, { default: data }]) => {
      if (!mounted || !container) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const picker = new (Picker as any)({
        data,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onEmojiSelect: (emojiData: any) => onSelectRef.current(emojiData.native as string),
        locale: 'de',
        theme: 'light',
        set: 'native',
        previewPosition: 'none',
        skinTonePosition: 'none',
      }) as HTMLElement
      container.appendChild(picker)
    })

    return () => {
      mounted = false
      while (container?.firstChild) container.removeChild(container.firstChild)
    }
  }, [])

  return <div ref={containerRef} />
}

interface Props {
  selected: string | null
  onSelect: (emoji: string | null) => void
  trigger: React.ReactNode
}

export default function EmojiPickerPopover({ selected, onSelect, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [showFullPicker, setShowFullPicker] = useState(false)

  function handleFavorite(emoji: string) {
    onSelect(selected === emoji ? null : emoji)
    setOpen(false)
    setShowFullPicker(false)
  }

  function handlePickerSelect(emoji: string) {
    onSelect(emoji)
    setOpen(false)
    setShowFullPicker(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setShowFullPicker(false)
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        {!showFullPicker ? (
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Stimmung</p>
            <div className="grid grid-cols-3 gap-1.5">
              {FAVORITES.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  onClick={() => handleFavorite(emoji)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-center hover:bg-slate-100 transition-colors ${
                    selected === emoji ? 'bg-blue-50 ring-1 ring-blue-300' : ''
                  }`}
                  title={label}
                >
                  <span className="text-2xl leading-none">{emoji}</span>
                  <span className="text-xs text-slate-500 leading-tight">{label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              {selected && (
                <button
                  onClick={() => {
                    onSelect(null)
                    setOpen(false)
                  }}
                  className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Entfernen
                </button>
              )}
              <button
                onClick={() => setShowFullPicker(true)}
                className="ml-auto text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                Alle Emojis →
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setShowFullPicker(false)}
              className="mb-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Zurück
            </button>
            <EmojiMartPicker onSelect={handlePickerSelect} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
