import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import TeamKalenderZelle from './TeamKalenderZelle'
import type { PlannedEntry, AbsenceWithType } from '@/lib/database.types'

function plan(start: string, end: string, arbeitsortName?: string): PlannedEntry {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    date: '2026-10-02',
    planned_start: start,
    planned_end: end,
    block_index: 0,
    arbeitsort_id: arbeitsortName ? 'ao-1' : null,
    arbeitsort: arbeitsortName ? { id: 'ao-1', name: arbeitsortName, is_active: true } : null,
    created_at: '',
    updated_at: '',
  }
}

const krankAbsence: AbsenceWithType = {
  id: 'abs-1',
  user_id: 'me',
  bereich_id: 'b1',
  absence_type_id: 'krank-id',
  absence_type_override_id: null,
  date: '2026-10-02',
  note: null,
  created_at: '',
  absence_type: { id: 'krank-id', name: 'Krank', color: '#ef4444', abbreviation: 'K' },
  absence_type_override: null,
}

afterEach(cleanup)

describe('TeamKalenderZelle', () => {
  it('shows a dash for an empty day', () => {
    render(<TeamKalenderZelle plans={[]} absent={false} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows plan times, hours and arbeitsort for a single block', () => {
    render(<TeamKalenderZelle plans={[plan('08:00:00', '12:00:00', 'Büro Bielefeld')]} absent={false} />)
    expect(screen.getByText('08:00 – 12:00')).toBeInTheDocument()
    expect(screen.getByText('4h')).toBeInTheDocument()
    expect(screen.getByText('Büro Bielefeld')).toBeInTheDocument()
  })

  it('summarizes multiple blocks', () => {
    render(
      <TeamKalenderZelle
        plans={[plan('08:00:00', '12:00:00'), plan('13:00:00', '17:00:00')]}
        absent={false}
      />
    )
    expect(screen.getByText('2 Bl. · 8h')).toBeInTheDocument()
  })

  it('renders a NEUTRAL badge for an absent colleague — never the absence type', () => {
    render(<TeamKalenderZelle plans={[]} absent={true} />)
    expect(screen.getByText('Abwesend')).toBeInTheDocument()
    expect(screen.queryByText('Krank')).not.toBeInTheDocument()
    expect(screen.queryByText('Urlaub')).not.toBeInTheDocument()
  })

  it('renders the typed badge for the own absence', () => {
    render(<TeamKalenderZelle plans={[]} absent={false} ownAbsence={krankAbsence} />)
    expect(screen.getByText('Krank')).toBeInTheDocument()
    expect(screen.getByText('K')).toBeInTheDocument()
    expect(screen.queryByText('Abwesend')).not.toBeInTheDocument()
  })

  it('prefers the typed own absence over the neutral badge when both flags are set', () => {
    render(<TeamKalenderZelle plans={[]} absent={true} ownAbsence={krankAbsence} />)
    expect(screen.getByText('Krank')).toBeInTheDocument()
    expect(screen.queryByText('Abwesend')).not.toBeInTheDocument()
  })

  it('shows the holiday badge', () => {
    render(<TeamKalenderZelle plans={[]} absent={false} holidayName="Tag der Deutschen Einheit" />)
    expect(screen.getByText(/Tag der Deutschen Einheit/)).toBeInTheDocument()
  })

  it('is not interactive (no button, no click handler)', () => {
    const { container } = render(<TeamKalenderZelle plans={[]} absent={true} />)
    expect(container.querySelector('button')).toBeNull()
  })
})
