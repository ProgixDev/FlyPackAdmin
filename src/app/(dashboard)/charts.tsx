'use client';

import { useMemo, useState } from 'react';

const GRID = '#E7EFF4';

/* ------------------------------------------------------------------ */
/* Line chart — single series, evolution over time.                    */
/* ------------------------------------------------------------------ */
export function LineChart({
  data,
  color = '#35B8FC',
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const width = 560;
  const height = 200;
  const padL = 28;
  const padR = 12;
  const padT = 16;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padL + i * step,
    y: padT + innerH - (d.value / maxVal) * innerH,
    ...d,
  }));

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${points[points.length - 1]?.x ?? padL} ${padT + innerH} L ${padL} ${padT + innerH} Z`;

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxVal * f));

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setHoverIdx(closest);
  };

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        {yTicks.map((t, i) => {
          const y = padT + innerH - (t / maxVal) * innerH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={GRID} strokeWidth={1} />
              <text x={4} y={y + 3} fontSize={9} fill="#93A0AA">
                {t}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={color} opacity={0.1} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.length > 0 && (
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={4} fill={color} stroke="#fff" strokeWidth={2} />
        )}

        {hovered && (
          <>
            <line x1={hovered.x} y1={padT} x2={hovered.x} y2={padT + innerH} stroke={GRID} strokeWidth={1} />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill={color} stroke="#fff" strokeWidth={2} />
          </>
        )}

        {points.map((p, i) => {
          if (i % Math.ceil(points.length / 6 || 1) !== 0 && i !== points.length - 1) return null;
          return (
            <text key={i} x={p.x} y={height - 4} fontSize={9} fill="#93A0AA" textAnchor="middle">
              {p.label}
            </text>
          );
        })}

        <rect
          x={padL}
          y={0}
          width={innerW}
          height={height}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
        />
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs shadow-[0_10px_25px_-10px_rgba(32,94,131,0.4)]"
          style={{
            left: `${(hovered.x / width) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -110%)',
          }}
        >
          <p className="font-bold text-ink">{hovered.value}</p>
          <p className="text-muted">{hovered.label}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bar chart — nominal categorical, one hue, comparing categories.     */
/* ------------------------------------------------------------------ */
export function BarChart({
  data,
  color = '#35B8FC',
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex flex-col gap-3">
      {data.map((d, i) => (
        <div
          key={d.label}
          className="group flex items-center gap-3"
          onMouseEnter={() => setHoverIdx(i)}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <span className="w-24 flex-shrink-0 truncate text-sm font-semibold text-ink">{d.label}</span>
          <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-brand-mist">
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${Math.max(4, (d.value / max) * 100)}%`,
                backgroundColor: color,
                opacity: hoverIdx === null || hoverIdx === i ? 1 : 0.45,
              }}
            />
          </div>
          <span className="w-6 flex-shrink-0 text-right text-xs font-semibold text-muted">{d.value}</span>
        </div>
      ))}
      {data.length === 0 && <p className="text-sm text-muted">Aucune donnée.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Doughnut chart — proportions across a fixed status scale.           */
/* ------------------------------------------------------------------ */
export function DoughnutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);

  const size = 140;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const segments = useMemo(
    () =>
      data.map((d, i) => {
        const fraction = total > 0 ? d.value / total : 0;
        // Décalage = somme des fractions précédentes, calculée sans accumulateur muté.
        const offset =
          total > 0 ? data.slice(0, i).reduce((sum, prev) => sum + prev.value, 0) / total : 0;
        return { ...d, fraction, offset };
      }),
    [data, total],
  );

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {total === 0 ? (
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GRID} strokeWidth={stroke} />
          ) : (
            segments.map((s, i) => {
              const gap = 2; // surface gap between segments, in px along the circumference
              const len = Math.max(0, s.fraction * circumference - gap);
              const dashoffset = -s.offset * circumference;
              return (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${circumference - len}`}
                  strokeDashoffset={dashoffset}
                  opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.4}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-ink">{hoverIdx !== null ? segments[hoverIdx].value : total}</span>
          <span className="text-[10px] font-medium text-muted">{hoverIdx !== null ? segments[hoverIdx].label : 'Total'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex items-center gap-2 text-xs"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ opacity: hoverIdx === null || hoverIdx === i ? 1 : 0.5 }}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="font-semibold text-ink">{d.value}</span>
            <span className="text-slate">{d.label}</span>
          </div>
        ))}
        {total === 0 && <p className="text-xs text-muted">Aucun signalement.</p>}
      </div>
    </div>
  );
}
