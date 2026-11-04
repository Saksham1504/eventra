export type UserRole = "STUDENT" | "ORGANIZER" | "ADMIN"

export type EventraUser = {
  id: string
  name: string
  email: string
  avatar_url: string | null
  role: UserRole
  college_id: string | null
}

export type TicketTypeItem = {
  id: string
  event_id: string
  name: string
  capacity: number
  sold_count: number
  reserved_count: number
  remaining?: number
  base_price: number
  current_price: number
  increment_percent: number
  capacity_step_percent: number
  currency: string
}

export type EventItem = {
  id: string
  organizer_id: string
  title: string
  description: string | null
  category: string | null
  banner_url: string | null
  venue: string
  start_time: string
  end_time: string
  registration_deadline: string | null
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED"
  ticket_types: TicketTypeItem[]
  organizer_name?: string
  created_at?: string
}

export type BookingItem = {
  id: string
  user_id: string
  ticket_type_id: string
  quantity: number
  unit_price: number
  total_amount: number
  status: "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED" | "CANCELLED"
  created_at: string
  expires_at: string | null
  event_id?: string
  event_title?: string
  ticket_type_name?: string
}

export type TicketItem = {
  id: string
  booking_id: string
  user_id: string
  ticket_type_id: string
  event_id: string
  event_title: string
  venue: string
  start_time: string
  ticket_type_name: string
  qr_token: string
  status: "ACTIVE" | "USED" | "CANCELLED" | "REFUNDED"
  issued_at: string
  used_at: string | null
}

export type PaymentItem = {
  id: string
  booking_id: string
  provider: string | null
  amount: number
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED"
  created_at: string
  paid_at: string | null
}

export type CheckInResult = {
  result: "ADMITTED" | "ALREADY_USED" | "CANCELLED" | "INVALID" | "WRONG_EVENT" | "EVENT_NOT_ACTIVE"
  message: string
  ticket_id?: string
  attendee_name?: string
  ticket_type?: string
  used_at?: string | null
}

export type OrganizerProfile = {
  id: string
  user_id: string
  club_name: string
  description: string | null
  verification_status: "PENDING" | "APPROVED" | "REJECTED"
  created_at: string
  user_name: string
  user_email: string
}

export type NotificationItem = {
  id: string
  user_id: string
  title: string
  message: string
  type: string | null
  is_read: boolean
  created_at: string
}

export type EventAnalytics = {
  event_id: string
  title: string
  status: string
  totals: {
    capacity: number
    tickets_sold: number
    revenue: number
    checked_in: number
    attendance_rate_percent: number
  }
  ticket_types: Array<{
    ticket_type_id: string
    name: string
    capacity: number
    sold: number
    reserved: number
    current_price: number
    revenue: number
    capacity_used_percent: number
  }>
  sales_by_day: Array<{
    date: string
    tickets: number
    revenue: number
  }>
  price_changes: Array<{
    ticket_type_id: string
    old_price: number
    new_price: number
    sold_count: number
    changed_at: string
  }>
}

export type OrganizerSummary = {
  events_total: number
  events_published: number
  tickets_sold: number
  revenue: number
  checked_in: number
}

export type AdminStats = {
  users: number
  organizers_pending: number
  events_published: number
  tickets_sold: number
  revenue: number
}

export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
)

export function getWsBaseUrl(): string {
  return apiBaseUrl.replace(/^http/, "ws")
}

// Request helper with auto token injection
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const res = await fetch(`${apiBaseUrl}${endpoint}`, {
    ...options,
    headers,
  })

  let data: any
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const errorMsg = data?.detail || `API request failed with status ${res.status}`
    throw new Error(errorMsg)
  }

  return data as T
}

// ================================= AUTH =================================
export async function loginToEventra(idToken: string): Promise<EventraUser> {
  return apiFetch<EventraUser>("/auth/login", { method: "POST" }, idToken)
}

export async function getMe(token: string): Promise<EventraUser> {
  return apiFetch<EventraUser>("/auth/me", {}, token)
}

// ================================= EVENTS =================================
export async function listEvents(params?: {
  q?: string
  category?: string
  include_past?: boolean
}): Promise<EventItem[]> {
  const sp = new URLSearchParams()
  if (params?.q) sp.set("q", params.q)
  if (params?.category) sp.set("category", params.category)
  if (params?.include_past) sp.set("include_past", "true")
  const query = sp.toString() ? `?${sp.toString()}` : ""
  return apiFetch<EventItem[]>(`/events${query}`)
}

export async function getCategories(): Promise<string[]> {
  return apiFetch<string[]>("/events/categories")
}

export async function getEvent(id: string, token?: string | null): Promise<EventItem> {
  return apiFetch<EventItem>(`/events/${id}`, {}, token)
}

export async function getMyEvents(token: string): Promise<EventItem[]> {
  return apiFetch<EventItem[]>("/events/mine", {}, token)
}

export async function createEvent(
  data: {
    title: string
    description?: string
    category?: string
    venue: string
    start_time: string
    end_time: string
    banner_url?: string
  },
  token: string
): Promise<EventItem> {
  return apiFetch<EventItem>("/events", {
    method: "POST",
    body: JSON.stringify(data),
  }, token)
}

export async function createTicketType(
  eventId: string,
  data: {
    name: string
    capacity: number
    base_price: number
    increment_percent?: number
    capacity_step_percent?: number
  },
  token: string
): Promise<TicketTypeItem> {
  return apiFetch<TicketTypeItem>(`/events/${eventId}/ticket-types`, {
    method: "POST",
    body: JSON.stringify(data),
  }, token)
}

export async function publishEvent(eventId: string, token: string): Promise<EventItem> {
  return apiFetch<EventItem>(`/events/${eventId}/publish`, { method: "POST" }, token)
}

export async function cancelEvent(eventId: string, token: string): Promise<EventItem> {
  return apiFetch<EventItem>(`/events/${eventId}/cancel`, { method: "POST" }, token)
}

// ================================= BOOKINGS =================================
export async function createBooking(
  ticketTypeId: string,
  quantity: number,
  idempotencyKey: string,
  token: string
): Promise<BookingItem> {
  return apiFetch<BookingItem>(
    "/bookings",
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ ticket_type_id: ticketTypeId, quantity }),
    },
    token
  )
}

export async function getBooking(id: string, token: string): Promise<BookingItem> {
  return apiFetch<BookingItem>(`/bookings/${id}`, {}, token)
}

export async function getMyBookings(token: string, statusFilter?: string): Promise<BookingItem[]> {
  const query = statusFilter ? `?status_filter=${statusFilter}` : ""
  return apiFetch<BookingItem[]>(`/bookings/mine${query}`, {}, token)
}

export async function cancelBooking(id: string, token: string): Promise<BookingItem> {
  return apiFetch<BookingItem>(`/bookings/${id}/cancel`, { method: "POST" }, token)
}

// ================================= PAYMENTS =================================
export async function checkoutPayment(bookingId: string, token: string): Promise<PaymentItem> {
  return apiFetch<PaymentItem>(
    "/payments/checkout",
    {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId }),
    },
    token
  )
}

export async function mockConfirmPayment(
  paymentId: string,
  token: string
): Promise<{ payment: PaymentItem; booking: BookingItem }> {
  return apiFetch<{ payment: PaymentItem; booking: BookingItem }>(
    `/payments/${paymentId}/mock-confirm`,
    { method: "POST" },
    token
  )
}

export async function mockFailPayment(
  paymentId: string,
  token: string
): Promise<{ payment: PaymentItem; booking: BookingItem }> {
  return apiFetch<{ payment: PaymentItem; booking: BookingItem }>(
    `/payments/${paymentId}/mock-fail`,
    { method: "POST" },
    token
  )
}

// ================================= TICKETS =================================
export async function getMyTickets(token: string): Promise<TicketItem[]> {
  return apiFetch<TicketItem[]>("/tickets/mine", {}, token)
}

export async function getTicket(id: string, token: string): Promise<TicketItem> {
  return apiFetch<TicketItem>(`/tickets/${id}`, {}, token)
}

export function getTicketQrUrl(id: string): string {
  return `${apiBaseUrl}/tickets/${id}/qr.png`
}

// ================================= CHECKIN =================================
export async function checkInTicket(
  eventId: string,
  tokenStr: string,
  gateName: string,
  token: string
): Promise<CheckInResult> {
  return apiFetch<CheckInResult>(
    "/checkin",
    {
      method: "POST",
      body: JSON.stringify({ event_id: eventId, token: tokenStr, gate_name: gateName }),
    },
    token
  )
}

// ================================= ORGANIZER =================================
export async function applyOrganizer(
  clubName: string,
  description: string,
  token: string
): Promise<OrganizerProfile> {
  return apiFetch<OrganizerProfile>(
    "/organizers/apply",
    {
      method: "POST",
      body: JSON.stringify({ club_name: clubName, description }),
    },
    token
  )
}

export async function getMyOrganizerProfile(token: string): Promise<OrganizerProfile> {
  return apiFetch<OrganizerProfile>("/organizers/me", {}, token)
}

export async function getOrganizerSummary(token: string): Promise<OrganizerSummary> {
  return apiFetch<OrganizerSummary>("/analytics/summary", {}, token)
}

export async function getEventAnalytics(eventId: string, token: string): Promise<EventAnalytics> {
  return apiFetch<EventAnalytics>(`/analytics/events/${eventId}`, {}, token)
}

// ================================= NOTIFICATIONS =================================
export async function getNotifications(token: string, unreadOnly = false): Promise<NotificationItem[]> {
  return apiFetch<NotificationItem[]>(
    `/notifications?unread_only=${unreadOnly ? "true" : "false"}`,
    {},
    token
  )
}

export async function getUnreadNotificationCount(token: string): Promise<number> {
  const res = await apiFetch<{ unread: number }>("/notifications/unread-count", {}, token)
  return res.unread
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await apiFetch<{ ok: boolean }>("/notifications/read-all", { method: "POST" }, token)
}

// ================================= ADMIN =================================
export async function getAdminStats(token: string): Promise<AdminStats> {
  return apiFetch<AdminStats>("/admin/stats", {}, token)
}

export async function getAdminUsers(token: string, q?: string, role?: string): Promise<EventraUser[]> {
  const sp = new URLSearchParams()
  if (q) sp.set("q", q)
  if (role) sp.set("role", role)
  const query = sp.toString() ? `?${sp.toString()}` : ""
  return apiFetch<EventraUser[]>(`/admin/users${query}`, {}, token)
}

export async function updateUserRole(userId: string, role: UserRole, token: string): Promise<EventraUser> {
  return apiFetch<EventraUser>(
    `/admin/users/${userId}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
    token
  )
}

export async function getAdminOrganizers(
  token: string,
  status?: "PENDING" | "APPROVED" | "REJECTED"
): Promise<OrganizerProfile[]> {
  const query = status ? `?status=${status}` : ""
  return apiFetch<OrganizerProfile[]>(`/admin/organizers${query}`, {}, token)
}

export async function approveOrganizer(profileId: string, token: string): Promise<OrganizerProfile> {
  return apiFetch<OrganizerProfile>(`/admin/organizers/${profileId}/approve`, { method: "POST" }, token)
}

export async function rejectOrganizer(profileId: string, token: string): Promise<OrganizerProfile> {
  return apiFetch<OrganizerProfile>(`/admin/organizers/${profileId}/reject`, { method: "POST" }, token)
}

export async function getAdminEvents(token: string, status?: string): Promise<EventItem[]> {
  const query = status ? `?status=${status}` : ""
  return apiFetch<EventItem[]>(`/admin/events${query}`, {}, token)
}
