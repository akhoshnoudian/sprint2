"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { CourseCard } from "@/components/CourseCard"
import { CourseFilterSidebar } from "@/components/CourseFilterSidebar"
import { dummyCourses } from "@/lib/dummy-data"

interface Course {
  id: string
  title: string
  description: string
  price: number
  difficulty: string
  rating: number
  instructor: string
  imageUrl: string
}

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDifficulty, setSelectedDifficulty] = useState("all")
  const [selectedRating, setSelectedRating] = useState([0, 5])

  useEffect(() => {
    fetchCourses()
  }, [selectedDifficulty, selectedRating])

  const fetchCourses = () => {
    setLoading(true)
    setTimeout(() => {
      const filteredCourses = dummyCourses.filter(course => {
        const matchesDifficulty = selectedDifficulty === "all" || course.difficulty === selectedDifficulty;
        const matchesRating = course.rating >= selectedRating[0] && course.rating <= selectedRating[1];
        return matchesDifficulty && matchesRating;
      });
      setCourses(filteredCourses);
      setLoading(false);
    }, 500); // Simulate network delay
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
                  key={course.id}
                  title={course.title}
                  instructor={course.instructor}
                  difficulty={course.difficulty as 'Beginner' | 'Intermediate' | 'Advanced'}
                  rating={course.rating}
                  imageUrl={course.imageUrl}
                  price={course.price}
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
