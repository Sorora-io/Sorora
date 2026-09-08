export const ADMIN_STEPS = [
  'Add potential Bigs',
  'Add potential Littles',
  'Twin availability',
  'Set ranking rules',
  "Big rankings",
  "Little rankings",
  'Review everything',
  'Matching results',
];

interface ProgressBarProps {
  currentStep: number; // 1-indexed
  totalSteps?: number;
  stepLabel?: string;
  className?: string;
}

const Progressbar = ({
  currentStep,
  totalSteps = ADMIN_STEPS.length,
  stepLabel,
  className = 'max-w-2xl',
}: ProgressBarProps) => {
  const percent = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));

  return (
    <div className={`${className} w-full mb-8`}>
      <div className="flex justify-between mb-2 text-sm text-gray-600">
        <span>Step {currentStep} of {totalSteps}</span>
        <span>{stepLabel ?? ADMIN_STEPS[currentStep - 1]}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-jade-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default Progressbar;
