import React from 'react';

/**
 * Color-coded 4-axis SVG spider/diamond chart comparing the student's spoken
 * defense scores against an 8.0/10 Distinction benchmark.
 */
export function RubricRadarChart({ criteria }) {
  const size = 220;
  const center = size / 2;
  const radius = 74;

  const axes = [
    { key: 'technicalAccuracy', label: 'Accuracy', angle: -Math.PI / 2, color: '#5B4DF0' },
    { key: 'justificationDepth', label: 'Justification', angle: 0, color: '#0D9488' },
    { key: 'clarityAndStructure', label: 'Clarity', angle: Math.PI / 2, color: '#0284C7' },
    { key: 'confidenceAndConciseness', label: 'Conciseness', angle: Math.PI, color: '#D97706' },
  ];

  const pointAt = (value, angle) => {
    const ratio = Math.max(0, Math.min(10, Number(value) || 0)) / 10;
    const r = ratio * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const toPolygon = (values) =>
    values
      .map((val, idx) => {
        const pt = pointAt(val, axes[idx].angle);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ');

  const studentValues = axes.map((a) => criteria?.[a.key] ?? 0);
  const benchmarkValues = [8, 8, 8, 8];
  const rings = [2.5, 5, 7.5, 10];

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-[#F8F9FF] p-4">
      <div className="mb-1 flex w-full items-center justify-between text-xs text-slate-600">
        <span className="font-semibold text-slate-900">Rubric Shape</span>
        <span>Dashed: 8.0 target</span>
      </div>

      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-52 w-52 overflow-visible"
        role="img"
        aria-label="Four-axis rubric score radar chart"
      >
        <defs>
          <linearGradient id="radarFillGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5B4DF0" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.28" />
          </linearGradient>
        </defs>

        {/* Concentric grid rings */}
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={toPolygon([ring, ring, ring, ring])}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {axes.map((axis) => {
          const outer = pointAt(10, axis.angle);
          return (
            <line
              key={axis.key}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="#CBD5E1"
              strokeWidth="1"
            />
          );
        })}

        {/* 8.0 Distinction target polygon */}
        <polygon
          points={toPolygon(benchmarkValues)}
          fill="none"
          stroke="#64748B"
          strokeWidth="1.25"
          strokeDasharray="4 3"
        />

        {/* Student actual score polygon */}
        <polygon
          points={toPolygon(studentValues)}
          fill="url(#radarFillGradient)"
          stroke="#5B4DF0"
          strokeWidth="2.25"
          strokeLinejoin="round"
        />

        {/* Student color-coded vertices */}
        {studentValues.map((val, idx) => {
          const pt = pointAt(val, axes[idx].angle);
          return (
            <circle
              key={axes[idx].key}
              cx={pt.x}
              cy={pt.y}
              r="4"
              fill={axes[idx].color}
              stroke="#FFFFFF"
              strokeWidth="1.75"
            />
          );
        })}

        {/* Axis labels */}
        {axes.map((axis, idx) => {
          const labelPt = pointAt(12.2, axis.angle);
          const scoreVal = studentValues[idx];
          const textAnchor =
            axis.angle === 0 ? 'start' : axis.angle === Math.PI ? 'end' : 'middle';
          const dy = axis.angle === -Math.PI / 2 ? -2 : axis.angle === Math.PI / 2 ? 10 : 4;
          return (
            <text
              key={axis.key}
              x={labelPt.x}
              y={labelPt.y + dy}
              textAnchor={textAnchor}
              fill={axis.color}
              className="text-[10px] font-bold"
            >
              {axis.label} ({Number(scoreVal).toFixed(1)})
            </text>
          );
        })}
      </svg>
    </div>
  );
}
