import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Star } from 'lucide-react';

interface CourseCardProps {
  title: string;
  instructor: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  rating: number;
  imageUrl: string;
  price: number;
}

export function CourseCard({
  title,
  instructor,
  difficulty,
  rating,
  imageUrl,
  price,
}: CourseCardProps) {
  return (
    <Card className="w-full max-w-sm hover:shadow-lg transition-shadow">
      <CardHeader className="p-0">
        <div className="relative w-full h-48">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover rounded-t-lg"
          />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-2">by {instructor}</p>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={difficulty === 'Beginner' ? 'default' : difficulty === 'Intermediate' ? 'secondary' : 'destructive'}>
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