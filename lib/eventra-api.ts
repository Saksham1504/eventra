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

function isEventraUser(value: unknown): value is EventraUser {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'email' in value &&
    typeof value.email === 'string' &&
    'avatar_url' in value &&
    (value.avatar_url === null || typeof value.avatar_url === 'string') &&
    'role' in value &&
    (value.role === 'STUDENT' || value.role === 'ORGANIZER' || value.role === 'ADMIN') &&
    'college_id' in value &&
    (value.college_id === null || typeof value.college_id === 'string')
  )
}

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

  if (!isEventraUser(result)) {
    throw new Error('Eventra API returned an unexpected user response.')
  }

  return result
}
