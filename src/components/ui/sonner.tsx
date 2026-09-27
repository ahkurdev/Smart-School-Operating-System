"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host. Sonner reads the theme from the document class set by next-themes;
 * it is rendered once at the app root.
 */
function Toaster({ className, ...props }: ToasterProps) {
  return (
    <Sonner
      className={className}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group rounded-lg border border-border bg-surface-raised text-foreground shadow-md",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
