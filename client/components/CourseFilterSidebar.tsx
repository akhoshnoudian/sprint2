import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

interface CourseFilterSidebarProps {
  onDifficultyChange: (difficulty: string) => void;
  onRatingChange: (rating: number[]) => void;
  selectedDifficulty: string;
  selectedRating: number[];
}

export function CourseFilterSidebar({
  onDifficultyChange,
  onRatingChange,
  selectedDifficulty,
  selectedRating,
}: CourseFilterSidebarProps) {
  return (
    <div className="w-64 p-4 space-y-6 bg-white rounded-lg shadow-sm text-black max-h-[fit-content]">
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Difficulty Level</h3>
        <RadioGroup
          value={selectedDifficulty}
          onValueChange={onDifficultyChange}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="all" />
            <Label htmlFor="all">All Levels</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="beginner" id="beginner" />
            <Label htmlFor="beginner">Beginner</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="intermediate" id="intermediate" />
            <Label htmlFor="intermediate">Intermediate</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="advanced" id="advanced" />
            <Label htmlFor="advanced">Advanced</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Instructor Rating</h3>
        <div className="space-y-2">
          <Slider
            value={selectedRating}
            onValueChange={onRatingChange}
            max={5}
            step={0.5}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-600">
            <span>{selectedRating[0]} stars</span>
            <span>{selectedRating[1]} stars</span>
          </div>
        </div>
      </div>
    </div>
  );
} 