"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "@/lib/axios"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload } from "lucide-react"

const courseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  difficulty: z.string().min(1, "Please select a difficulty level"),
  price: z.coerce.number().positive("Price must be a positive number"),
})

type CourseFormValues = z.infer<typeof courseSchema>

export default function InstructorUploadPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const router = useRouter()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: "",
      description: "",
      difficulty: "",
      price: 0,
    },
  })

  useEffect(() => {
    const token = localStorage.getItem("token")
    // temporarily commented to test and open page without loggin in
    // if (!token) {
    //   toast({
    //     title: "Unauthorized",
    //     description: "You must be logged in as an instructor to access this page",
    //     variant: "destructive",
    //   })
    //   router.push("/login")
    //   return
    // }

    // Check if user is an instructor
    const checkAuth = async () => {
      try {
        const response = await axios.get("/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.data.role !== "instructor") {
          toast({
            title: "Unauthorized",
            description: "Only instructors can access this page",
            variant: "destructive",
          })
          // router.push("/")
          return
        }

        setIsAuthenticated(true)
      } catch (error) {
        toast({
          title: "Authentication failed",
          description: "Please log in again",
          variant: "destructive",
        })
        // router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, toast])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0])
    }
  }

  const onSubmit = async (data: CourseFormValues) => {
    if (!videoFile) {
      toast({
        title: "Video required",
        description: "Please upload a video file for your course",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    setIsUploading(true)

    try {
      // Step 1: Upload video
      const formData = new FormData()
      formData.append("video", videoFile)

      const uploadResponse = await axios.post("/upload-video", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100))
          setUploadProgress(percentCompleted)
        },
      })

      setIsUploading(false)

      // Step 2: Create course with video URL
      const courseData = {
        ...data,
        videoUrl: uploadResponse.data.url,
      }

      await axios.post("/create-course", courseData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      toast({
        title: "Course created successfully!",
        description: "Your course has been published",
        duration: 5000,
      })

      router.push("/")
    } catch (error: any) {
      toast({
        title: "Failed to create course",
        description: error.response?.data?.message || "Something went wrong. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
      setIsUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    // return null // Will redirect in useEffect
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Upload New Course</CardTitle>
          <CardDescription>Create and publish a new fitness course for your students</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Course Title</Label>
              <Input id="title" placeholder="e.g., 30-Day Strength Training Program" {...register("title")} />
              {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what students will learn in this course..."
                rows={4}
                {...register("description")}
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty Level</Label>
                <Select onValueChange={(value) => setValue("difficulty", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
                {errors.difficulty && <p className="text-sm text-red-500">{errors.difficulty.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input id="price" type="number" step="0.01" min="0" placeholder="29.99" {...register("price")} />
                {errors.price && <p className="text-sm text-red-500">{errors.price.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="video">Course Video</Label>
              <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  {videoFile ? videoFile.name : "Upload your course video"}
                </p>
                <Input id="video" type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                <Label htmlFor="video" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm">
                    Select Video
                  </Button>
                </Label>
              </div>
              {videoFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Uploading video: {uploadProgress}%</div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUploading ? `Uploading (${uploadProgress}%)` : "Creating course..."}
                </>
              ) : (
                "Publish Course"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
