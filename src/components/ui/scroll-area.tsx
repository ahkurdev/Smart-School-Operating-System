import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Scrollable region. Built on the native overflow container rather than Radix
 * ScrollArea (not installed); custom scrollbar styling is scoped to this element
 * so it reads as part of the surface, and keyboard scrolling comes from the
 * platform. Add `tabIndex={0}` only when the region is the sole way to reach
 * content, so it becomes keyboard-focusable (R-32).
 */
const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative overflow-y-auto overflow-x-hidden [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
      className,
    )}
    {...props}
  >
    {children}
  </div>
));
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
