import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

async function getCourses() {
  const response = await fetch(`${process.env.API_BASE_URL}/courses`, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    cache: 'no-store'
  })
  return response.json()
}

export default async function CoursesPage() {
  const courses = await getCourses()
  return { courses }
}
