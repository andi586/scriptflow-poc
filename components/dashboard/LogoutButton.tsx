'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch (err: unknown) {
      // Keep error shape unknown; only log.
      console.error("Logout error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      onClick={() => void handleLogout()}
      disabled={isLoading}
      className="gap-2 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <LogOut size={16} />
      )}
      <span>退出登录</span>
    </Button>
  )
}

