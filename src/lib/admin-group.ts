// PROJ-18: Admin-Erkennung über Entra-Gruppenmitgliedschaft.
//
// Das provider_token von Supabase ist ein Access Token für Microsoft Graph
// (Standard-Scopes openid/profile/email). Access Tokens werden aus dem Manifest
// der Ressource (Graph) erzeugt, nicht aus dem der eigenen App Registration —
// ein dort konfigurierter `groups`-Claim taucht in diesem Token daher NIE auf.
// Die Mitgliedschaft muss stattdessen direkt bei Graph abgefragt werden.
// `/me/checkMemberGroups` prüft transitiv, umgeht das 200-Gruppen-Limit
// (Groups Overage) und benötigt nur die Delegated Permission User.Read.

const GRAPH_CHECK_MEMBER_GROUPS_URL =
  'https://graph.microsoft.com/v1.0/me/checkMemberGroups'

/**
 * Prüft, ob der angemeldete Nutzer Mitglied der Admin-Gruppe ist.
 *
 * @returns `true`/`false` bei erfolgreicher Prüfung, `null` wenn die Prüfung
 * nicht möglich war (fehlende Konfiguration, fehlendes Token oder Graph-Fehler).
 * Bei `null` soll der Aufrufer den bisherigen `is_admin`-Wert beibehalten,
 * statt den Nutzer fälschlich zu degradieren.
 */
export async function checkAdminGroupMembership(
  providerToken: string | null | undefined,
  adminGroupId: string | undefined
): Promise<boolean | null> {
  if (!adminGroupId || !providerToken) {
    return null
  }

  try {
    const response = await fetch(GRAPH_CHECK_MEMBER_GROUPS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groupIds: [adminGroupId] }),
    })

    if (!response.ok) {
      console.error(
        `checkMemberGroups failed: ${response.status} ${response.statusText}`
      )
      return null
    }

    const result = (await response.json()) as { value?: unknown }
    const memberGroups = Array.isArray(result.value) ? result.value : []
    return memberGroups.includes(adminGroupId)
  } catch (error) {
    console.error('checkMemberGroups request error:', error)
    return null
  }
}
