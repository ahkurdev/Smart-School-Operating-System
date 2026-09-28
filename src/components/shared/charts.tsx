import { cn } from "@/lib/cn";

/**
 * Minimal, dependency-free, accessible charts.
 *
 * These render as inline SVG on the server (no client JS) and always pair the
 * visual with a screen-reader table so the data is available non-visually. This
 * is deliberate: a charting library would ship tens of KB and usually drops an
 * accessible fallback. The marks use `currentColor` so they adapt to the theme.
 */

export type Point = { label: string; value: number };

export function BarChart({
  data,
  max,
  valueSuffix = "",
  ariaLabel,
  className,
}: {
  data: Point[];
  max?: number;
  valueSuffix?: string;
  ariaLabel: string;
  className?: string;
}) {
  if (data.length === 0) return null;
  const ceiling = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className={cn("space-y-2", className)}>
      <div className="flex h-40 items-end gap-1.5" role="img" aria-label={ariaLabel}>
        {data.map((d) => (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-primary/80"
              style={{ height: `${Math.max(2, (d.value / ceiling) * 100)}%` }}
              aria-hidden
            />
            <span className="tabular text-[10px] text-muted-foreground">{d.value}{valueSuffix}</span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th scope="row">{d.label}</th>
                <td>
                  {d.value}
                  {valueSuffix}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
      <div className="flex gap-1.5">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground" aria-hidden>
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function Sparkline({ data, ariaLabel, className }: { data: Point[]; ariaLabel: string; className?: string }) {
  if (data.length < 2) return null;
  const width = 240;
  const height = 48;
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = Math.max(1, max - min);
  const step = width / (data.length - 1);
  const points = data.map((d, i) => `${i * step},${height - ((d.value - min) / range) * height}`).join(" ");
  return (
    <figure className={className}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full text-primary" role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="sr-only">{ariaLabel}</figcaption>
    </figure>
  );
}
