import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Star } from 'lucide-react';

interface CourseCardProps {
  id: string;
  title: string;
  instructor: string;
  difficulty: string;
  rating: number;
  imageUrl: string;
  price: number;
  duration: string;
  description: string;
}

export function CourseCard({
  id,
  title,
  instructor,
  difficulty,
  rating,
  imageUrl,
  price,
  duration,
  description,
}: CourseCardProps) {
  const router = useRouter();

  return (
    <Card 
      className="w-full max-w-sm hover:shadow-lg cursor-pointer transform hover:scale-105 transition-all duration-200"
      onClick={() => router.push(`/courses/${id}`)}
    >
      <CardHeader className="p-0">
        <div className="w-full h-48 bg-gray-100 rounded-t-lg flex items-center justify-center overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-2">by {instructor}</p>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={difficulty.toLowerCase() === 'beginner' ? 'default' : difficulty.toLowerCase() === 'intermediate' ? 'secondary' : 'destructive'}>
            {difficulty}
          </Badge>
          <div className="flex items-center">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="ml-1 text-sm">{rating.toFixed(1)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <p className="text-lg font-bold">${price}</p>
      </CardFooter>
    </Card>
  );
} 