interface Props {
  processed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  colorScheme?: 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'orange';
  showPercentage?: boolean;
}

const COLOR_MAP = {
  blue: { stroke: '#3b82f6', bg: '#1f2937' },
  green: { stroke: '#22c55e', bg: '#1f2937' },
  amber: { stroke: '#f59e0b', bg: '#1f2937' },
  red: { stroke: '#ef4444', bg: '#1f2937' },
  gray: { stroke: '#6b7280', bg: '#1f2937' },
  orange: { stroke: '#f97316', bg: '#1f2937' },
};

export function ProgressRing({ 
  processed, 
  total, 
  size = 48, 
  strokeWidth = 4,
  colorScheme = 'blue',
  showPercentage = false
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = total === 0 ? 0 : Math.min(processed / total, 1);
  const offset = circumference * (1 - progress);
  const percentage = Math.round(progress * 100);
  const colors = COLOR_MAP[colorScheme];

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        style={{ transform: "rotate(-90deg)" }}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${percentage}%`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.bg}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.2}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-gray-900 dark:text-white">
            {percentage}%
          </span>
        </div>
      )}
    </div>
  );
}
