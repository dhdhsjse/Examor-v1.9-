// A window outline with one side shaded: shows which side panel the button controls.
// Filled side = the panel is shown.
export function PanelIcon({ side, open }: { side: "left" | "right"; open: boolean }) {
  const x = side === "left" ? 1.5 : 9;
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <rect x={x} y="2.5" width="5.5" height="11" fill={open ? "currentColor" : "none"} stroke="none" opacity={open ? 0.35 : 0} />
    </svg>
  );
}
