"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [isAdminLogin, setIsAdminLogin] = useState(false)
  const [adminFormData, setAdminFormData] = useState({
    username: "",
    password: ""
  })
  const [userFormData, setUserFormData] = useState({
    email: "",
    password: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>('')
  const router = useRouter()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async () => {
    setIsSubmitting(true)
    setError('') // Clear any previous errors

    try {

      const response = await api.login({
        email: userFormData.email,
        password: userFormData.password
      })

      if (response.token) {
        // Store the token
        localStorage.setItem("token", response.token)
        toast({
          title: "Login successful!",
          description: "Welcome back to FitForge!",
          duration: 3000,
        })

        router.push("/")
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Invalid email or password')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container max-w-md mx-auto px-4 py-12">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Login</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => {
            e.preventDefault()
            setIsSubmitting(true)
            setError('')
            try {
              if (isAdminLogin) {
                // Handle admin login
                if (adminFormData.username === "sample" && adminFormData.password === "123") {
                  const token = "admin-token-123" // Simple hardcoded token
                  localStorage.setItem('isAdmin', 'true')
                  localStorage.setItem('token', token)
                  router.push('/admin')
                } else {
                  setError('Invalid admin credentials')
                }
              } else {
                // Handle regular user login
                onSubmit()
              }
            } catch (error: any) {
              console.error('Login error:', error)
              setError(error.message || 'Invalid credentials')
            } finally {
              setIsSubmitting(false)
            }
          }} className="space-y-4">
            {isAdminLogin ? (
              <div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input 
                    id="username" 
                    type="text" 
                    value={adminFormData.username} 
                    onChange={(e) => setAdminFormData(prev => ({ ...prev, username: e.target.value }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={adminFormData.password}
                    onChange={(e) => setAdminFormData(prev => ({ ...prev, password: e.target.value }))} 
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="john@example.com" 
                    value={userFormData.email}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                  {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={userFormData.password}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                  />
                  {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setIsAdminLogin(prev => !prev)
                  setError("")
                  setAdminFormData({ username: "", password: "" })
                }}
              >
                {isAdminLogin ? 'Back to User Login' : 'Admin Login'}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-center text-sm text-muted-foreground w-full">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
