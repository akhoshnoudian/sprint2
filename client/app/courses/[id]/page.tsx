"use client";

import CourseDetails from '@/components/CourseDetails'
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

interface PageProps {
  params: { id: string }
}

export default function CourseDetailsPage({ params }: PageProps) {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast({
        title: "Login Required",
        description: "Please login to view course details",
        variant: "destructive",
      });
      router.push('/login');
    }
  }, [router, toast]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return null;

  return <CourseDetails courseId={params.id} />
}
