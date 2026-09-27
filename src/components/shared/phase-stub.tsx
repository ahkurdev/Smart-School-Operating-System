import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * A shared "coming online" panel for routes whose domain is built in a later
 * phase. It is honest about status (no fake data, no dead controls) and keeps
 * the navigation coherent while phases are delivered in order.
 */
export function PhaseStub({
  title,
  description,
  phase,
}: {
  title: string;
  description?: string;
  phase?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This area is built in {phase ?? "a later phase"}. It is listed here so
            the navigation reflects the full system, not a partial mockup.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
