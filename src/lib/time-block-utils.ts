export interface TimeBlock {
  start: string
  end: string
}

export interface BlockValidationError {
  blockIndex: number
  message: string
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function calcBlockHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const diff = timeToMinutes(end) - timeToMinutes(start)
  return diff > 0 ? diff / 60 : 0
}

export function validateBlocks(blocks: TimeBlock[]): BlockValidationError[] {
  const errors: BlockValidationError[] = []

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (!b.start || !b.end) continue
    if (timeToMinutes(b.start) >= timeToMinutes(b.end)) {
      errors.push({ blockIndex: i, message: 'Startzeit muss vor der Endzeit liegen' })
      continue
    }
    for (let j = 0; j < i; j++) {
      const other = blocks[j]
      if (!other.start || !other.end) continue
      if (
        timeToMinutes(b.start) < timeToMinutes(other.end) &&
        timeToMinutes(b.end) > timeToMinutes(other.start)
      ) {
        errors.push({ blockIndex: i, message: `Überschneidung mit Block ${j + 1}` })
        break
      }
    }
  }

  return errors
}
