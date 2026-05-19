/**
 * Strips large Azure AD claims from Supabase session cookies before storage.
 *
 * Root cause of Vercel 494 REQUEST_HEADER_TOO_LARGE:
 *  - provider_token:  Azure AD JWT (~3 KB)
 *  - user_metadata.custom_claims.groups: ~100 group UUIDs duplicated in
 *    both user_metadata and identities[].identity_data (~4 KB each)
 * Combined with chunked cookies (@supabase/ssr splits at 3180 chars) this
 * easily exceeds Vercel's 16 KB request-header limit.
 *
 * Wrap every createServerClient's setAll with withCleanSession() to keep
 * each stored session under ~3 KB (1–2 chunks).
 */

type Cookie = { name: string; value: string; options?: Record<string, unknown> }

// Matches auth-token cookies (with or without chunk suffix .N) but NOT
// auth-token-code-verifier or other sb-* cookies.
const AUTH_TOKEN_RE = /^sb-[^-]+-auth-token(?:\.\d+)?$/

function stripSession(raw: Record<string, unknown>): Record<string, unknown> {
  const user = raw.user as Record<string, unknown> | undefined
  if (!user) return raw

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>

  return {
    ...raw,
    provider_token: undefined,
    provider_refresh_token: undefined,
    user: {
      ...user,
      user_metadata: {
        full_name: meta.full_name ?? meta.name ?? null,
        email: user.email,
        email_verified: meta.email_verified ?? true,
      },
      identities: (Array.isArray(user.identities) ? user.identities : []).map(
        (id: Record<string, unknown>) => {
          const d = (id.identity_data ?? {}) as Record<string, unknown>
          return {
            ...id,
            identity_data: {
              email: d.email,
              email_verified: d.email_verified,
              sub: d.sub,
              provider_id: d.provider_id,
            },
          }
        }
      ),
    },
  }
}

function b64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function utf8ToB64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function withCleanSession(
  setAll: (cookies: Cookie[]) => void | Promise<void>
): (cookies: Cookie[]) => void | Promise<void> {
  return (cookiesToSet: Cookie[]) => {
    const authChunks = cookiesToSet.filter(c => AUTH_TOKEN_RE.test(c.name))
    if (authChunks.length === 0) return setAll(cookiesToSet)

    const others = cookiesToSet.filter(c => !AUTH_TOKEN_RE.test(c.name))

    const sorted = [...authChunks].sort((a, b) => {
      const ai = parseInt(a.name.match(/\.(\d+)$/)?.[1] ?? '-1', 10)
      const bi = parseInt(b.name.match(/\.(\d+)$/)?.[1] ?? '-1', 10)
      return ai - bi
    })

    const fullB64 = sorted
      .map(({ value }) => (value.startsWith('base64-') ? value.slice(7) : value))
      .join('')

    let cleaned = authChunks
    try {
      const session = JSON.parse(b64ToUtf8(fullB64)) as Record<string, unknown>
      const stripped = stripSession(session)
      const strippedB64 = 'base64-' + utf8ToB64(JSON.stringify(stripped))

      const CHUNK = 3180
      const baseName = sorted[0].name.replace(/\.\d+$/, '')
      const opts = sorted[0].options
      const total = Math.ceil(strippedB64.length / CHUNK)

      cleaned = Array.from({ length: total }, (_, i) => ({
        name: total === 1 ? baseName : `${baseName}.${i}`,
        value: strippedB64.slice(i * CHUNK, (i + 1) * CHUNK),
        options: opts,
      }))

      // Expire any old chunks that no longer exist after stripping
      const newNames = new Set(cleaned.map(c => c.name))
      for (const { name, options: o } of sorted) {
        if (!newNames.has(name)) {
          others.push({ name, value: '', options: { ...(o ?? {}), maxAge: 0 } })
        }
      }
    } catch {
      // On any parse error keep the original cookies unchanged
    }

    return setAll([...others, ...cleaned])
  }
}
