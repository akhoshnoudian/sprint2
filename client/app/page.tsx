"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import CourseCard from "@/components/CourseCard"
import { CourseFilterSidebar } from "@/components/CourseFilterSidebar"
import { api } from "@/lib/api"

interface Course {
  _id: string
  title: string
  instructor: { username: string; isVerified: boolean }
  description: string
  price: number
  rating: number
  thumbnail: string
  duration: string
  level: string
  difficulty?: string // For backward compatibility
}

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDifficulty, setSelectedDifficulty] = useState("all")
  const [selectedRating, setSelectedRating] = useState([0, 5])

  useEffect(() => {
    fetchCourses()
  }, [selectedDifficulty, selectedRating])

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const response = await api.getCourses()
      console.log('Fetched courses:', response)
      
      const filteredCourses = response.filter((course: Course) => {
        const courseLevel = (course.level || '').toLowerCase()
        const matchesDifficulty = selectedDifficulty === "all" || courseLevel === selectedDifficulty.toLowerCase()
        
        const courseRating = course.rating || 0
        const matchesRating = courseRating >= selectedRating[0] && courseRating <= selectedRating[1]
        
        return matchesDifficulty && matchesRating
      })
      
      console.log('Filtered courses:', filteredCourses)
      setCourses(filteredCourses)
    } catch (error) {
      console.error('Error fetching courses:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">Discover Fitness Courses</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <CourseFilterSidebar
          selectedDifficulty={selectedDifficulty}
          selectedRating={selectedRating}
          onDifficultyChange={setSelectedDifficulty}
          onRatingChange={setSelectedRating}
        />

        <div className="flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : courses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {courses.map((course) => (
                <CourseCard
                  key={course._id}
                  _id={course._id}
                  title={course.title}
                  instructor={course.instructor}
                  level={course.level}
                  rating={course.rating}
                  thumbnail={course.thumbnail}
                  price={course.price}
                  description={course.description}
                  duration={course.duration}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-xl font-medium mb-2">No courses found</h3>
              <p className="text-muted-foreground">Try adjusting your filters to find more courses.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
