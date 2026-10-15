// Static bar heights (px) matching the approved Figma Waveform spec — not derived
// from real audio, since nothing in this app records audio yet.
const BAR_HEIGHTS = [
  10, 18, 28, 14, 36, 22, 12, 30, 40, 16, 24, 34, 12, 20, 38, 26, 14, 32, 18, 10, 28, 22, 36,
];

export type WaveformProps = {
  active?: boolean;
};

/** Presentational only — a static illustration, not a live audio visualization. */
export function Waveform({ active = false }: WaveformProps) {
  return (
    <div
      role="img"
      aria-label={active ? "Audio waveform (preview only)" : "Audio waveform, idle"}
      className="flex h-11 items-center gap-[3px]"
    >
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className={`w-[3px] shrink-0 rounded-sm ${active ? "bg-accent" : "bg-icon-muted"}`}
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}
