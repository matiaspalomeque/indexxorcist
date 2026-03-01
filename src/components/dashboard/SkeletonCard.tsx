export function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <div 
      className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-900 shadow-lg"
      style={{
        animation: `fadeInUp 0.4s ease-out ${delay}ms backwards, pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
      }}
    >
      {/* Header Section */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0">
          <div className="w-9 h-9 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded-md w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md w-1/2" />
        </div>
      </div>

      {/* Progress Section */}
      <div className="flex items-center justify-center mb-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-[72px] h-[72px] rounded-full bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded-md w-24" />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md" />
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md" />
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md" />
      </div>

      {/* Duration Footer */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded-md w-16" />
      </div>
    </div>
  );
}
