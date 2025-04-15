"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload } from "lucide-react"

const courseSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be at most 100 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"], {
    required_error: "Please select a difficulty level",
  }),
  price: z.number().min(0, "Price must be non-negative"),
  ratings: z.number().min(0, "Rating must be at least 0").max(5, "Rating must be at most 5"),
})

type CourseFormValues = z.infer<typeof courseSchema>

export default function CreateCoursePage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [videoUrls, setVideoUrls] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
  })

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) {
      console.log('No file selected')
      return
    }

    setUploadingVideo(true)
    const file = files[0]
    console.log('Selected file:', file.name)

    try {
      // Create form data
      const formData = new FormData()
      formData.append('file', file)

      // Make direct fetch call to see exact response
      const timestamp = Date.now();
      const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8000'}/upload-video?t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: formData,
      })

      console.log('Upload response status:', response.status)
      const data = await response.json()
      console.log('Upload response:', data)
      console.log('Cloudinary URL:', data.video_url)

      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed')
      }

      console.log('Adding video URL:', data.video_url)
      setVideoUrls((prev) => {
        console.log('Previous URLs:', prev)
        const newUrls = [...prev, data.video_url]
        console.log('New URLs:', newUrls)
        return newUrls
      })
      toast({
        title: "Video uploaded successfully!",
        description: "The video has been added to your course.",
        duration: 3000,
      })
    } catch (error: any) {
      console.error('Upload error:', error)
      toast({
        title: "Video upload failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setUploadingVideo(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const onSubmit = async (data: CourseFormValues) => {
    if (!videoUrls.length) {
      toast({
        title: "Upload required",
        description: "Please upload at least one video for the course.",
        variant: "destructive",
        duration: 5000,
      })
      return
    }

    setIsSubmitting(true)

    try {
      console.log('Submitting course with video URLs:', videoUrls)
      const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8000'}/create-course`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        body: JSON.stringify({
          ...data,
          video_urls: videoUrls,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to create course')
      }

      toast({
        title: "Course created successfully!",
        description: "Your course is now live.",
        duration: 3000,
      })

      router.push("/")
    } catch (error: any) {
      console.error('Course creation error:', error)
      toast({
        title: "Error creating course",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create a New Course</CardTitle>
          <CardDescription>Share your expertise with our community</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Course Title</Label>
              <Input id="title" placeholder="e.g., Advanced Yoga Flow" {...register("title")} />
              {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what students will learn in this course..."
                {...register("description")}
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty Level</Label>
              <Select onValueChange={(value) => setValue("difficulty", value as "beginner" | "intermediate" | "advanced")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              {errors.difficulty && <p className="text-sm text-red-500">{errors.difficulty.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="29.99"
                  {...register("price", { valueAsNumber: true })}
                />
                {errors.price && <p className="text-sm text-red-500">{errors.price.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ratings">Initial Rating</Label>
                <Input
                  id="ratings"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  placeholder="4.5"
                  {...register("ratings", { valueAsNumber: true })}
                />
                {errors.ratings && <p className="text-sm text-red-500">{errors.ratings.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Course Videos</Label>
              <div className="grid gap-4">
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    disabled={uploadingVideo}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary file:text-primary-foreground
                      file:cursor-pointer file:disabled:opacity-50
                      hover:file:bg-primary/90"
                  />
                  {uploadingVideo && (
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Uploading...</span>
                    </div>
                  )}
                </div>
                {videoUrls.length > 0 && (
                  <div className="space-y-2">
                    <Label>Uploaded Videos:</Label>
                    <ul className="list-disc pl-4 space-y-1">
                      {videoUrls.map((url, index) => (
                        <li key={url} className="text-sm text-gray-600">
                          Video {index + 1}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting || uploadingVideo}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating course...
                </>
              ) : (
                "Create Course"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
