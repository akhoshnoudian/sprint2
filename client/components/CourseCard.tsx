import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Star } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface CourseCardProps {
  _id: string;
  title: string;
  instructor: { username: string; isVerified: boolean };
  rating: number
  thumbnail: string
  description: string
  price: number
  duration: string
  level: string
  onClick?: () => void;
}

export default function CourseCard({
  _id,
  title,
  instructor,
  level,
  rating,
  thumbnail,
  price,
  description,
  duration,
  onClick,
}: CourseCardProps) {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <Card 
      className="w-full max-w-sm hover:shadow-lg cursor-pointer transform hover:scale-105 transition-all duration-200"
      onClick={() => {
        const token = localStorage.getItem('token');
        if (!token) {
          toast({
            title: "Login Required",
            description: "Please login to view course details",
            variant: "destructive",
          });
          return;
        }
        router.push(`/courses/${_id}`);
      }}
    >
      <CardHeader className="p-0">
        <div className="w-full h-48 bg-gray-100 rounded-t-lg flex items-center justify-center overflow-hidden">
          <Image
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&size=200&background=random`}
            alt={title}
            width={300}
            height={200}
            className="rounded-t-lg w-full h-48 object-cover"
          />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{title}</h3>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500">{instructor.username}</p>
            {(() => { console.log('Instructor data:', instructor); return null; })()}
            {instructor?.isVerified === true ? (
              <Badge variant="outline" className="bg-green-100 text-green-800">
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary">
                Not Verified
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={level === "Beginner" ? "default" : level === "Intermediate" ? "secondary" : "destructive"}>
              {level}
            </Badge>
            <div className="flex items-center">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="ml-1 text-sm">{(rating || 0).toFixed(1)}</span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <p className="text-lg font-bold">${price}</p>
      </CardFooter>
    </Card>
  );
} 
