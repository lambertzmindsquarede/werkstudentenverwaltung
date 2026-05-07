export function minutesToHHMM(m: number): string {
  const h = Math.floor(Math.abs(m) / 60)
  const min = Math.abs(m) % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
