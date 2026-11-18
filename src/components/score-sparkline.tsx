export function ScoreSparkline({ points, className }: { points: { date: string; score: number }[]; className?: string }) {
  if (points.length < 2) {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
        Run another analysis to see your score trend.
      </div>
    );
  }
  const width = 240;
  const height = 64;
  const padding = 4;
  const values = points.map((p) => p.score);
  const min = Math.min(...values, 40) - 4;
  const max = Math.max(...values, 90) + 4;
  const stepX = (width - padding * 2) / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = padding + index * stepX;
    const y = height - padding - ((point.score - min) / (max - min)) * (height - padding * 2);
    return { x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${path} L${coords[coords.length - 1].x},${height - padding} L${coords[0].x},${height - padding} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={`Score trend from ${points[0].score} to ${points[points.length - 1].score}`}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a907b" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0a907b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={path} fill="none" stroke="#0a907b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={points[i].date + i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 3.5 : 2} fill={i === coords.length - 1 ? "#0a907b" : "#ffffff"} stroke="#0a907b" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
