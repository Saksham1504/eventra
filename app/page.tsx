"use client"

import { EventraLoginPage } from "@/components/eventra-login-page"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function Page() {
  const { token } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (token) {
      router.replace("/events")
    }
  }, [token, router])

  return <EventraLoginPage />
}
