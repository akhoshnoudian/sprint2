'use client'

import { useEffect, useState } from 'react'
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { api } from "@/lib/api"

interface Course {
  _id: string
  title: string
  description: string
  instructor: string
  difficulty: string
  price: number
  video_urls?: string[]
}

interface User {
  username: string
  email: string
  role: string
  balance: number
  purchased_courses: string[]
}

export default function CourseDetails({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const { toast } = useToast();

  const isPurchased = user?.purchased_courses?.includes(courseId);

  const [showPayment, setShowPayment] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [cvv, setCvv] = useState('')
  const [processing, setProcessing] = useState(false)

  const handlePurchase = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'Please log in to purchase this course',
        variant: 'destructive',
      })
      return
    }
    setShowPayment(true)
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcessing(true)

    try {
      if (!course) {
        throw new Error('Course not found')
      }

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Purchase course
      const result = await api.purchaseCourse(course._id)
      toast({
        title: 'Purchase Successful!',
        description: `You have purchased "${result.course_title}" for $${result.price}`,
      })
      
      // Update user data to reflect purchase
      const updatedUser = await api.getCurrentUser()
      setUser(updatedUser)
      setShowPayment(false)
      setCardNumber('')
      setExpiryDate('')
      setCvv('')
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to purchase course',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!courseId) return;
      
      setLoading(true);
      setError("");
      
      try {
        // Fetch course data
        const courseData = await api.getCourse(courseId);
        if (!mounted) return;
        setCourse(courseData);

        // Fetch user data
        const userData = await api.getCurrentUser();
        if (!mounted) return;
        setUser(userData);
      } catch (error) {
        if (!mounted) return;
        console.error('Error fetching data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch course details';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [courseId, toast])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <div className="text-red-500">{error}</div>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <div>Course not found</div>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-2xl font-bold mb-4">Payment Details</h2>
            <p className="text-gray-600 mb-4">Amount: ${course?.price}</p>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardNumber(e.target.value)}
                  required
                  maxLength={19}
                  pattern="[0-9 ]{13,19}"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    placeholder="MM/YY"
                    value={expiryDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpiryDate(e.target.value)}
                    required
                    maxLength={5}
                    pattern="(0[1-9]|1[0-2])/[0-9]{2}"
                  />
                </div>
                <div>
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    placeholder="123"
                    value={cvv}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCvv(e.target.value)}
                    required
                    maxLength={3}
                    pattern="[0-9]{3}"
                  />
                </div>
              </div>
              <div className="flex gap-4 justify-end">
                <Button variant="outline" onClick={() => setShowPayment(false)} type="button">
                  Cancel
                </Button>
                <Button type="submit" disabled={processing}>
                  {processing ? (
                    <>
                      <span className="animate-spin mr-2">⭮</span>
                      Processing...
                    </>
                  ) : (
                    'Pay Now'
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl mb-2">{course.title}</CardTitle>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant={course.difficulty.toLowerCase() === 'beginner' ? 'default' : course.difficulty.toLowerCase() === 'intermediate' ? 'secondary' : 'destructive'}>
                  {course.difficulty}
                </Badge>
              </div>
            </div>
            <Button onClick={() => window.history.back()}>Back to Courses</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Description</h3>
              <p className="text-gray-600">{course.description}</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Instructor</h3>
              <p className="text-gray-600">{course.instructor}</p>
            </div>

            <div className="mt-8 border-t pt-8">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Course Content</h3>
                  <p className="text-gray-600">{course.video_urls?.length || 0} videos in this course</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold mb-2">${course.price}</p>
                  {user && typeof user.balance === 'number' && (
                    <p className="text-sm text-gray-600 mb-2">
                      Your balance: ${user.balance.toFixed(2)}
                    </p>
                  )}
                  <Button 
                    size="lg"
                    onClick={handlePurchase}
                    disabled={loading || isPurchased}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing
                      </>
                    ) : isPurchased ? (
                      "Purchased"
                    ) : (
                      "Buy Course"
                    )}
                  </Button>
                </div>
              </div>
              <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">What you'll learn:</h4>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Full access to {course.video_urls?.length || 0} course videos</li>
                  <li>Lifetime access to course materials</li>
                  <li>Certificate of completion</li>
                  <li>24/7 support</li>
                </ul>
              </div>

              {isPurchased && course.video_urls && course.video_urls.length > 0 && (
                <div className="mt-8 border-t pt-8">
                  <h3 className="text-xl font-semibold mb-4">Course Content</h3>
                  <div className="space-y-4">
                    {course.video_urls.map((url, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2">Video {index + 1}</h4>
                        <video
                          controls
                          className="w-full rounded-lg"
                          src={url}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
