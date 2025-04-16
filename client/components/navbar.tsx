"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { Button } from "./ui/button"
import Link from "next/link"
import { Dumbbell } from "lucide-react"
import axios from "@/lib/axios"
import { useToast } from "@/components/ui/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Avatar, AvatarFallback } from "./ui/avatar"

export default function Navbar() {
  const router = useRouter()
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
      // Handle admin token separately
      if (token === 'admin-token-123') {
        setUser({
          username: 'Admin',
          role: 'admin'
        });
        return;
      }

      // Handle regular JWT tokens
      try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        setUser({
          username: tokenData.sub,
          role: tokenData.role || 'user'
        });
      } catch (error) {
        console.error('Error parsing token:', error);
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      localStorage.removeItem('token');
      setUser(null);
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
        {user?.role === 'admin' ? (
          <div className="flex items-center space-x-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">FitForge Admin</span>
          </div>
        ) : (
          <Link href="/" className="flex items-center space-x-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">FitForge</span>
          </Link>
        )}

        <nav className="flex items-center space-x-4">
          <div>{user?.role}</div>
          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-4">
                  {user.role !== 'admin' && (
                    <Button
                      variant="outline"
                      onClick={() => router.push('/my-courses')}
                      className="hidden md:flex"
                    >
                      My Courses
                    </Button>
                  )}
                  {user.role === 'admin' && (
                    <Button
                      variant="outline"
                      onClick={() => router.push('/admin')}
                      className="hidden md:flex"
                    >
                      Admin Panel
                    </Button>
                  )}
                  {user.role === 'instructor' && (
                    <Button
                      variant="outline"
                      onClick={() => router.push('/instructor/upload')}
                      className="hidden md:flex"
                    >
                      Instructor Panel
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Avatar>
                        <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      
                      <DropdownMenuItem
                        onClick={() => {
                          localStorage.removeItem('token')
                          localStorage.removeItem('isAdmin')
                          setUser(null)
                          router.push(user?.role === 'admin' ? '/login' : '/')
                        }}
                      >
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="flex items-center gap-4">
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
                </div>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
