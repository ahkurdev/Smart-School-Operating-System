import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Accordion on native `<details>`/`<summary>`: open/close, Enter/Space, and
 * screen-reader semantics come from the platform with no dependency. `name`
 * groups items so only one is open at a time.
 */
const Accordion = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("w-full divide-y divide-border", className)} {...props} />
));
Accordion.displayName = "Accordion";

export interface AccordionItemProps
  extends React.DetailsHTMLAttributes<HTMLDetailsElement> {
  /** Groups sibling items so opening one closes the others. */
  name?: string;
}

const AccordionItem = React.forwardRef<HTMLDetailsElement, AccordionItemProps>(
  ({ className, ...props }, ref) => (
    <details
      ref={ref}
      className={cn("group py-3", className)}
      {...props}
    />
  ),
);
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, children, ...props }, ref) => (
  <summary
    ref={ref}
    className={cn(
      "flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180" />
  </summary>
));
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("pt-2 text-sm text-muted-foreground", className)}
    {...props}
  />
));
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
