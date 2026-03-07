"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthSession } from "@/components/providers"

export default function OnboardingPage() {
  const { user } = useAuthSession()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push("/connect-wallet")
    }
  }, [user, router])

  if (!user) return null

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <h1 className="text-2xl font-bold">Welcome to Alertly</h1>
    </div>
  )
}
