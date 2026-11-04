"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { getAdminStats, getAllUsers, getPendingOrganizers, adminUpdateUserRole, adminApproveOrganizer, adminRejectOrganizer, AdminStats, UserInfo, OrganizerInfo } from "@/lib/eventra-api"
import { Loader2, Users, ShieldCheck, ShieldX, BarChart2, Plus, Check, X } from "lucide-react"

export default function AdminConsole() {
  const { token } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<UserInfo[]>([])
  const [organizers, setOrganizers] = useState<OrganizerInfo[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!token) return
    try {
      const [s, u, o] = await Promise.all([
        getAdminStats(token),
        getAllUsers(token),
        getPendingOrganizers(token),
      ])
      setStats(s)
      setUsers(u)
      setOrganizers(o)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [token])

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!token) return
    await adminUpdateUserRole(userId, newRole, token)
    await fetchData()
  }

  const handleOrganizerDecision = async (orgId: string, approve: boolean) => {
    if (!token) return
    if (approve) await adminApproveOrganizer(orgId, token)
    else await adminRejectOrganizer(orgId, token)
    await fetchData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Admin Console</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage users, organizers, and view platform statistics.</p>

        {/* Stats */}
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Total Users</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">{stats?.total_users ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Approved Organizers</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">{stats?.approved_organizers ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BarChart2 className="size-5 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Events Hosted</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">{stats?.total_events ?? 0}</p>
          </div>
        </div>

        {/* Users table */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-foreground">User Management</h2>
          <table className="mt-4 w-full border-collapse">
            <thead className="bg-muted">
              <tr>
                <th className="border px-3 py-2 text-left">Email</th>
                <th className="border px-3 py-2 text-left">Role</th>
                <th className="border px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="odd:bg-muted">
                  <td className="border px-3 py-2">{u.email}</td>
                  <td className="border px-3 py-2">{u.role}</td>
                  <td className="border px-3 py-2 space-x-2">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="STUDENT">Student</option>
                      <option value="ORGANIZER">Organizer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Organizer approvals */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-foreground">Pending Organizer Applications</h2>
          {organizers.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No pending applications.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {organizers.map(org => (
                <li key={org.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <p className="font-medium text-foreground">{org.club_name}</p>
                    <p className="text-xs text-muted-foreground">{org.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOrganizerDecision(org.id, true)}
                      className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                    >
                      <Check className="size-3" /> Approve
                    </button>
                    <button
                      onClick={() => handleOrganizerDecision(org.id, false)}
                      className="flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive/90"
                    >
                      <X class="size-3" /> Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
