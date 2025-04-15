"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2 } from "lucide-react"

interface Instructor {
  _id: string
  username: string
  email: string
  isVerified: boolean
}

export default function AdminPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const isAdmin = localStorage.getItem('isAdmin')
    if (!token || !isAdmin) {
      router.push('/login')
      return
    }

    // Fetch instructors
    fetchInstructors()
  }, [router])

  const fetchInstructors = async () => {
    try {
      const response = await api.getInstructors()
      setInstructors(response)
    } catch (error) {
      console.error("Error fetching instructors:", error)
      toast({
        title: "Error",
        description: "Failed to fetch instructors",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (instructorId: string, currentStatus: boolean) => {
    try {
      const updatedInstructor = await api.verifyInstructor(instructorId, !currentStatus)
      // Update local state with the response from server
      setInstructors(prev =>
        prev.map(instructor =>
          instructor._id === instructorId
            ? { ...instructor, isVerified: updatedInstructor.isVerified }
            : instructor
        )
      )
      toast({
        title: "Success",
        description: "Instructor verification status updated.",
      })
      // Refresh instructor list
      fetchInstructors()
    } catch (error) {
      console.error('Error verifying instructor:', error)
      toast({
        title: "Error",
        description: "Failed to update instructor verification status.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
          <CardDescription>Manage instructor verifications</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {instructors.map((instructor) => (
              <TableRow key={instructor._id}>
                <TableCell>{instructor.username}</TableCell>
                <TableCell>{instructor.email}</TableCell>
                <TableCell>
                  <Button
                    variant={instructor.isVerified ? "destructive" : "default"}
                    onClick={() => handleVerify(instructor._id, instructor.isVerified)}
                  >
                    {instructor.isVerified ? "Unverify" : "Verify"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {instructors.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <p className="text-center text-gray-500">No instructors found</p>
                </TableCell>
              </TableRow>
            )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
