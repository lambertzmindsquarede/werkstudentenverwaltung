import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkAdminGroupMembership } from './admin-group'

const ADMIN_GROUP_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const TOKEN = 'graph-access-token'

function mockGraphResponse(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  })
}

describe('checkAdminGroupMembership', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns null when no admin group id is configured', async () => {
    const fetchMock = mockGraphResponse({ value: [] })
    vi.stubGlobal('fetch', fetchMock)

    expect(await checkAdminGroupMembership(TOKEN, undefined)).toBeNull()
    expect(await checkAdminGroupMembership(TOKEN, '')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when no provider token is available', async () => {
    const fetchMock = mockGraphResponse({ value: [] })
    vi.stubGlobal('fetch', fetchMock)

    expect(await checkAdminGroupMembership(null, ADMIN_GROUP_ID)).toBeNull()
    expect(await checkAdminGroupMembership(undefined, ADMIN_GROUP_ID)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls the Graph checkMemberGroups endpoint with the provider token', async () => {
    const fetchMock = mockGraphResponse({ value: [] })
    vi.stubGlobal('fetch', fetchMock)

    await checkAdminGroupMembership(TOKEN, ADMIN_GROUP_ID)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/checkMemberGroups',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ groupIds: [ADMIN_GROUP_ID] }),
      })
    )
  })

  it('returns true when the user is a member of the admin group', async () => {
    vi.stubGlobal('fetch', mockGraphResponse({ value: [ADMIN_GROUP_ID] }))

    expect(await checkAdminGroupMembership(TOKEN, ADMIN_GROUP_ID)).toBe(true)
  })

  it('returns false when the user is not a member of the admin group', async () => {
    vi.stubGlobal('fetch', mockGraphResponse({ value: [] }))

    expect(await checkAdminGroupMembership(TOKEN, ADMIN_GROUP_ID)).toBe(false)
  })

  it('returns false when Graph returns an unexpected body shape', async () => {
    vi.stubGlobal('fetch', mockGraphResponse({}))

    expect(await checkAdminGroupMembership(TOKEN, ADMIN_GROUP_ID)).toBe(false)
  })

  it('returns null when Graph responds with an error status', async () => {
    vi.stubGlobal('fetch', mockGraphResponse({ error: 'InvalidAuthenticationToken' }, false, 401))

    expect(await checkAdminGroupMembership(TOKEN, ADMIN_GROUP_ID)).toBeNull()
  })

  it('returns null when the Graph request throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')))

    expect(await checkAdminGroupMembership(TOKEN, ADMIN_GROUP_ID)).toBeNull()
  })
})
