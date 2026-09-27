import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Root 404. Keeps the user oriented and offers real next steps. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="tabular text-sm font-medium text-muted-foreground">404</p>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        We could not find that page
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The link may be broken or the page may have moved. Try the home page or
        sign in to your school account.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
