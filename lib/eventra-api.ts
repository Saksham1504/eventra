export type EventraUser = {
  id: string
  name: string
  email: string
  avatar_url: string | null
  role: 'STUDENT' | 'ORGANIZER' | 'ADMIN'
  college_id: string | null
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000').replace(
  /\/+$/,
  '',
)

export async function loginToEventra(idToken: string): Promise<EventraUser> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: 'no-store',
  })

  let result: unknown
  try {
    result = await response.json()
  } catch {
    throw new Error(`Eventra API returned an invalid response (HTTP ${response.status}).`)
  }

  if (!response.ok) {
    const detail =
      typeof result === 'object' &&
      result !== null &&
      'detail' in result &&
      typeof result.detail === 'string'
        ? result.detail
        : `Eventra API request failed (HTTP ${response.status}).`
    throw new Error(detail)
  }

  return result as EventraUser
}
