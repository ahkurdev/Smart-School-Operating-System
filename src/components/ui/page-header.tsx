import * as React from "react";
import Link from "next/link";
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

export type Crumb = { label: string; href?: string };

function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground hover:underline underline-offset-4">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            )}
            {i < items.length - 1 ? (
              <span aria-hidden className="text-border">
                /
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
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
  breadcrumbs?: Crumb[];
}

function PageHeader({
  className,
  variant,
  title,
  description,
  actions,
  breadcrumbs,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn(pageHeaderVariants({ variant }), className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <RuledHeading>
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <Breadcrumbs items={breadcrumbs} />
          ) : null}
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
