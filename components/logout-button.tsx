'use client'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await authClient.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <Button onClick={handleLogout} variant="destructive" className="gap-2">
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  )
}
