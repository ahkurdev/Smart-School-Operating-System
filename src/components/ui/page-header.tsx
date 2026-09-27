import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Page-level header with the ruled-column motif: a hairline vertical rule beside
 * the label block (DESIGN.md identity motif).
 */
function RuledHeading({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("ruled", className)} {...props}>
      {children}
    </div>
  );
}

const pageHeaderVariants = cva("flex flex-col gap-4", {
  variants: {
    variant: {
      default: "",
      bordered: "border-b border-border pb-4",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface PageHeaderProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof pageHeaderVariants> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

function PageHeader({
  className,
  variant,
  title,
  description,
  actions,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn(pageHeaderVariants({ variant }), className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <RuledHeading>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </RuledHeading>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export { PageHeader, RuledHeading, pageHeaderVariants };
