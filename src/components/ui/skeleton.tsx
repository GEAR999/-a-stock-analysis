import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

// Shimmer effect skeleton with animated gradient
function SkeletonShimmer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-shimmer"
      className={cn(
        "relative overflow-hidden rounded",
        "bg-[#1a1f2e]",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.5s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-[#252b3b] before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

// K-line chart skeleton
function KLineSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <SkeletonShimmer className="h-8 w-full" />
      <SkeletonShimmer className="h-48 w-full" />
      <SkeletonShimmer className="h-16 w-full" />
    </div>
  )
}

// List skeleton
function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonShimmer className="h-4 w-16" />
          <SkeletonShimmer className="h-4 flex-1" />
          <SkeletonShimmer className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

// Card skeleton
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <SkeletonShimmer className="h-5 w-32 mb-3" />
      <SkeletonShimmer className="h-4 w-full mb-2" />
      <SkeletonShimmer className="h-4 w-3/4 mb-2" />
      <SkeletonShimmer className="h-4 w-1/2" />
    </div>
  )
}

export { Skeleton, SkeletonShimmer, KLineSkeleton, ListSkeleton, CardSkeleton }
