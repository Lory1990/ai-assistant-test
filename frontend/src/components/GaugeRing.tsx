interface GaugeRingProps {
  percent: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label: string;
  value: string;
  color?: string;
}

export function GaugeRing({ percent, size = 140, strokeWidth = 8, label, value, color = "var(--hud-cyan)" }: GaugeRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="gauge-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(0, 229, 255, 0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="gauge-ring__arc"
        />
      </svg>
      <div className="gauge-ring__center">
        <span className="gauge-ring__value">{value}</span>
        <span className="gauge-ring__label">{label}</span>
      </div>
    </div>
  );
}
