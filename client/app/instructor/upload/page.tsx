"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload } from "lucide-react"

export default function InstructorUploadPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: '',
    price: ''
  })

  const router = useRouter()
  const { toast } = useToast()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleDifficultyChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      difficulty: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.description || !formData.difficulty || !formData.price) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (!videoFile) {
      toast({
        title: "Video required",
        description: "Please upload a video file for your course",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      // First upload the video
      const videoFormData = new FormData()
      videoFormData.append('file', videoFile)
      
      console.log('Uploading video:', videoFile.name)
      const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/upload-video`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: videoFormData,
      })
      console.log('Upload response status:', uploadResponse.status)

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload video')
      }

      const result = await uploadResponse.json()
      console.log('Upload response:', result)
      
      if (!result.video_url) {
        throw new Error('No video URL in response')
      }
      
      const video_url = result.video_url
      console.log('Video URL:', video_url)

      // Then create the course
      await api.createCourse({
        title: formData.title,
        description: formData.description,
        difficulty: formData.difficulty.toLowerCase() as 'beginner' | 'intermediate' | 'advanced',
        price: parseFloat(formData.price),
        ratings: 0,
        video_urls: [video_url]
      })

      toast({
        title: "Success",
        description: "Course created successfully",
      })
      router.push('/')
    } catch (error) {
      console.error('Error creating course:', error)
      toast({
        title: "Error",
        description: "Failed to create course",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      // Check file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a video file smaller than 100MB",
          variant: "destructive",
        })
        return
      }
      // Check file type
      if (!file.type.startsWith('video/')) {
        toast({
          title: "Invalid file type",
          description: "Please upload a video file",
          variant: "destructive",
        })
        return
      }
      setVideoFile(file)
      setUploadProgress(0)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    // Check if user is an instructor
    const checkAuth = async () => {
      try {
        const response = await api.getCurrentUser()
        if (response.role !== 'instructor') {
          toast({
            title: "Unauthorized",
            description: "You must be an instructor to access this page",
            variant: "destructive",
          })
          router.push("/")
          return
        }
        setIsAuthenticated(true)
      } catch (error) {
        console.error('Auth error:', error)
        toast({
          title: "Authentication failed",
          description: "Please log in again",
          variant: "destructive",
        })
        router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, toast])

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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Course Title</Label>
              <Input 
                id="title"
                name="title"
                type="text"
                placeholder="e.g., 30-Day Strength Training Program"
                value={formData.title}
                onChange={handleInputChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe what students will learn in this course..."
                rows={4}
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty Level</Label>
                <Select 
                  value={formData.difficulty}
                  onValueChange={handleDifficultyChange}
                >
                  <SelectTrigger id="difficulty">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input 
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="29.99"
                  value={formData.price}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="video">Course Video</Label>
              <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  {videoFile ? videoFile.name : "Upload your course video"}
                </p>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => document.getElementById('video-upload')?.click()}
                >
                  Select Video
                </Button>
                <Input 
                  id="video-upload" 
                  type="file" 
                  accept="video/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </div>
              {videoFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating course...
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
