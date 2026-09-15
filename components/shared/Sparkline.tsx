interface SparklineProps {
  values: number[];
  warn: boolean;
  width?: number;
  height?: number;
}

/** Minimal inline trend line for a metric buffered client-side since page
 *  load (see Service.sessionLatencyTrend). Not a charting library — just
 *  enough to show "is this getting worse" at a glance in a small card. */
export function Sparkline({
  values,
  warn,
  width = 64,
  height = 20,
}: SparklineProps) {
  if (values.length < 2) {
    return <span className="text-xs text-ink-faint">—</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        className={warn ? "stroke-warning" : "stroke-ink-faint"}
      />
    </svg>
  );
}
