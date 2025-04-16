"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "@/lib/axios"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

interface Course {
  _id: string
  title: string
  description: string
  instructor: string
  price: number
  imageUrl: string
}

export default function MyCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    const fetchPurchasedCourses = async () => {
      try {
        console.log('Fetching purchased courses with token:', token)
        const response = await axios.get("/api/users/purchased-courses", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        console.log('Response from server:', response.data)
        setCourses(response.data.purchasedCourses)
      } catch (error: any) {
        console.error("Error fetching purchased courses:", error)
        if (error.response) {
          console.error('Response data:', error.response.data)
          console.error('Response status:', error.response.status)
        }
        toast({
          title: "Error fetching courses",
          description: "Please try again later",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchPurchasedCourses()
  }, [router, toast])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">My Courses</h1>
      {courses.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">You haven't purchased any courses yet.</p>
          <Button onClick={() => router.push("/")}>Browse Courses</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course._id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{course.title}</CardTitle>
                <CardDescription>By {course.instructor}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="w-full h-48 bg-gray-100 rounded-t-lg flex items-center justify-center overflow-hidden">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(course.title)}&size=200&background=random`}
                    alt={course.title}
                    className="rounded-t-lg w-full h-48 object-cover"
                  />
                </div>
                <p className="text-sm text-gray-600">{course.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
