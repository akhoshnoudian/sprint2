import CourseDetails from '@/components/CourseDetails'

interface PageProps {
  params: { id: string }
}

export default function CourseDetailsPage({ params }: PageProps) {
  return <CourseDetails courseId={params.id} />
}
