import { describe, it, expect } from 'vitest'

// Mirrors UUID_REGEX from route.ts
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateUserId(userId: unknown): { valid: boolean; error?: string } {
  if (typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
    return { valid: false, error: 'Ungültige userId (kein gültiges UUID-Format)' }
  }
  return { valid: true }
}

describe('dev-login UUID validation', () => {
  it('accepts valid lowercase UUID', () => {
    expect(validateUserId('00000000-0000-0000-0000-000000000001').valid).toBe(true)
  })

  it('accepts valid uppercase UUID', () => {
    expect(validateUserId('00000000-0000-0000-0000-000000000002').valid).toBe(true)
  })

  it('accepts mixed-case UUID', () => {
    expect(validateUserId('A1B2C3D4-E5F6-7890-ABCD-EF1234567890').valid).toBe(true)
  })

  it('rejects non-string', () => {
    expect(validateUserId(12345).valid).toBe(false)
    expect(validateUserId(null).valid).toBe(false)
    expect(validateUserId(undefined).valid).toBe(false)
    expect(validateUserId({}).valid).toBe(false)
  })

  it('rejects UUID without hyphens', () => {
    expect(validateUserId('00000000000000000000000000000001').valid).toBe(false)
  })

  it('rejects UUID with wrong segment lengths', () => {
    expect(validateUserId('0000000-0000-0000-0000-000000000001').valid).toBe(false)
    expect(validateUserId('000000000-0000-0000-0000-000000000001').valid).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateUserId('').valid).toBe(false)
  })

  it('rejects UUID with invalid characters', () => {
    expect(validateUserId('gggggggg-0000-0000-0000-000000000001').valid).toBe(false)
  })

  it('returns correct error message on invalid input', () => {
    const result = validateUserId('not-a-uuid')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Ungültige userId (kein gültiges UUID-Format)')
  })
})
