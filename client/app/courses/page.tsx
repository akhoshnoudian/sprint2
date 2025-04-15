'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Course {
  _id: string
  title: string
  description: string
  instructor: string
  difficulty: string
  rating: number
  price: number
  thumbnail: string
  instructorVerified: boolean
}

export default function CoursesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await api.getCourses()
        setCourses(data)
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to fetch courses',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchCourses()
  }, [toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Available Courses</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Card
            key={course._id}
            className="cursor-pointer transition-transform hover:scale-105"
            onClick={() => router.push(`/courses/${course._id}`)}
          >
            <CardHeader>
              <CardTitle className="text-xl mb-2">{course.title}</CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary">{course.difficulty}</Badge>
                <Badge variant="outline">Rating: {course.rating}/5</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4 line-clamp-3">{course.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">${course.price}</span>
                <span className="text-sm text-gray-500">By {course.instructor}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
