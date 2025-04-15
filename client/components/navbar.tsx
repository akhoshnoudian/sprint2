"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dumbbell } from "lucide-react"
import axios from "@/lib/axios"
import { useToast } from "@/components/ui/use-toast"

export default function Navbar() {
  const [user, setUser] = useState<{ username: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const { toast } = useToast()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      fetchUserInfo(token)
    } else {
      setLoading(false)
    }
  }, [pathname])

  const fetchUserInfo = async (token: string) => {
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      setUser({
        username: tokenData.sub,
        role: tokenData.role || 'user'
      })
    } catch (error) {
      console.error("Failed to parse token:", error)
      localStorage.removeItem("token")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    setUser(null)
    toast({
      title: "Logged out successfully",
      duration: 3000,
    })
  }

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Dumbbell className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">FitForge</span>
        </Link>

        <nav className="flex items-center space-x-4">
          <div>{user?.role}</div>
          {!loading && (
            <>
              {user ? (
                <>
                  <span className="text-sm">Welcome, {user.username}</span>
                  {user.role === "instructor" && (
                    <Link href="/create-course">
                      <Button variant="outline" size="sm">
                        Instructor Panel
                      </Button>
                    </Link>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm">
                      Login
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button variant="default" size="sm">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
