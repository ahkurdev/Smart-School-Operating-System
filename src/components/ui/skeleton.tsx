import { cn } from "@/lib/cn";

/**
 * Loading placeholder. Size it to the real layout (a table row, a card line) so
 * the loading state matches the loaded state instead of a bare spinner (R-27).
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
