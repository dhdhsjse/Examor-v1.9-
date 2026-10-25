// Small line icons for the toolbox (18x18, use the current text color).

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const McqIcon = () => (
  <svg {...base}>
    <circle cx="4" cy="5" r="2" />
    <circle cx="4" cy="13" r="2" />
    <path d="M8.5 5h7M8.5 13h7" />
  </svg>
);

export const TrueFalseIcon = () => (
  <svg {...base}>
    <path d="M2.5 9.5l2.5 2.5 4-5" />
    <path d="M11.5 6.5l4 4M15.5 6.5l-4 4" />
  </svg>
);

export const BlankIcon = () => (
  <svg {...base}>
    <path d="M2 7h4M12 7h4M2 12h14" />
    <path d="M7.5 8.5h3" strokeDasharray="1.5 1.5" />
  </svg>
);

export const OpenQuestionIcon = () => (
  <svg {...base}>
    <path d="M3 3.5h12v8H8l-3.5 3v-3H3z" />
  </svg>
);

export const MatchIcon = () => (
  <svg {...base}>
    <circle cx="4" cy="4.5" r="1.4" />
    <circle cx="4" cy="13.5" r="1.4" />
    <circle cx="14" cy="4.5" r="1.4" />
    <circle cx="14" cy="13.5" r="1.4" />
    <path d="M5.5 5l7 8M5.5 13l7-8" />
  </svg>
);

export const OrderIcon = () => (
  <svg {...base}>
    <rect x="2" y="2.5" width="4" height="4" rx="0.8" />
    <rect x="2" y="11.5" width="4" height="4" rx="0.8" />
    <path d="M8.5 4.5h7M8.5 13.5h7M12 7.5v3M10.5 9l1.5 1.5L13.5 9" />
  </svg>
);

export const ClassifyIcon = () => (
  <svg {...base}>
    <rect x="2.5" y="2.5" width="13" height="13" rx="1.5" />
    <path d="M9 2.5v13M2.5 6.5h13" />
    <path d="M4.5 9.5h2.5M4.5 12.5h2.5M11 9.5h2.5" />
  </svg>
);

export const BookmarkIcon = () => (
  <svg {...base} width={14} height={14}>
    <path d="M4.5 2.5h9v13L9 12l-4.5 3.5z" />
  </svg>
);

export const ImageIcon = () => (
  <svg {...base}>
    <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
    <circle cx="6.5" cy="7.5" r="1.3" />
    <path d="M15.5 12l-4-4-6.5 6.5" />
  </svg>
);

export const TableIcon = () => (
  <svg {...base}>
    <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
    <path d="M2.5 7.5h13M2.5 11h13M7 7.5v7" />
  </svg>
);

export const EquationIcon = () => (
  <svg {...base}>
    <path d="M3 4.5h5L5 9l3 4.5H3" />
    <path d="M11 8h4.5M11 11h4.5" />
  </svg>
);

export const DiagramIcon = () => (
  <svg {...base}>
    <path d="M3 15V3M3 15h12" />
    <path d="M5.5 11.5l3-3.5 2.5 2 3.5-4.5" />
  </svg>
);

// --- Subject tools ---

export const GraphIcon = () => (
  <svg {...base}>
    <path d="M2 9h14M9 2v14" />
    <path d="M3 14c3-1 4-9 7-9s3 4 5 3" />
  </svg>
);

export const GeometryIcon = () => (
  <svg {...base}>
    <path d="M9 2.5L15.5 14.5h-13z" />
    <circle cx="9" cy="10.5" r="2" />
  </svg>
);

export const NumberLineIcon = () => (
  <svg {...base}>
    <path d="M1.5 9h15M4 7v4M9 7v4M14 7v4" />
  </svg>
);

export const FractionIcon = () => (
  <svg {...base}>
    <path d="M3.5 9h11M9 3v3M9 12v3" />
  </svg>
);

export const CircuitIcon = () => (
  <svg {...base}>
    <rect x="2.5" y="4.5" width="13" height="9" rx="1" />
    <path d="M7 2.5v4M11 3.5v2" />
  </svg>
);

export const VectorIcon = () => (
  <svg {...base}>
    <path d="M3 15L14 4M9.5 4H14v4.5" />
  </svg>
);

export const RulerIcon = () => (
  <svg {...base}>
    <rect x="1.5" y="6" width="15" height="6" rx="1" />
    <path d="M4.5 6v2.5M7.5 6v1.5M10.5 6v2.5M13.5 6v1.5" />
  </svg>
);

export const FlaskIcon = () => (
  <svg {...base}>
    <path d="M7 2.5h4M7.5 2.5v5L3.5 14.5a1 1 0 00.9 1.5h9.2a1 1 0 00.9-1.5L10.5 7.5v-5" />
  </svg>
);

export const LabelIcon = () => (
  <svg {...base}>
    <circle cx="6" cy="9" r="3.5" />
    <path d="M9.5 9h4M13.5 9l2-2M13.5 9l2 2" />
  </svg>
);

export const CellIcon = () => (
  <svg {...base}>
    <ellipse cx="9" cy="9" rx="6.5" ry="5.5" />
    <circle cx="10" cy="8.5" r="2" />
  </svg>
);

export const TreeIcon = () => (
  <svg {...base}>
    <path d="M9 3v4M4 11V7h10v4" />
    <rect x="7" y="1.5" width="4" height="2" rx="0.5" />
    <rect x="2" y="11" width="4" height="4" rx="0.5" />
    <rect x="12" y="11" width="4" height="4" rx="0.5" />
  </svg>
);

export const RtlTextIcon = () => (
  <svg {...base}>
    <path d="M3 4.5h12M7 8h8M3 11.5h12M9 15h6" />
  </svg>
);

export const ArabicLetterIcon = () => (
  <span className="text-[15px] font-semibold leading-none">ع</span>
);

export const VerseIcon = () => (
  <svg {...base}>
    <path d="M2 6h5.5M10.5 6H16M2 12h5.5M10.5 12H16" />
  </svg>
);

export const BookIcon = () => (
  <svg {...base}>
    <path d="M9 4.5C7 3 4.5 3 2.5 3.5v11c2-.5 4.5-.5 6.5 1 2-1.5 4.5-1.5 6.5-1v-11C13.5 3 11 3 9 4.5zM9 4.5v11" />
  </svg>
);

export const PenLinesIcon = () => (
  <svg {...base}>
    <path d="M2 15h14M2 11h7" />
    <path d="M11.5 10.5L15 4l-1.5-1-3.5 6.5z" />
  </svg>
);

export const HeadingIcon = () => (
  <svg {...base}>
    <path d="M4 3.5v11M14 3.5v11M4 9h10" />
  </svg>
);

export const HeaderIcon = () => (
  <svg {...base}>
    <rect x="2.5" y="2.5" width="13" height="5" rx="1" />
    <path d="M2.5 11h13M2.5 14.5h8" />
  </svg>
);

// --- Top bar ---

export const UndoIcon = () => (
  <svg {...base} width={15} height={15}>
    <path d="M6.5 4L3 7.5 6.5 11" />
    <path d="M3.5 7.5h7a4 4 0 010 8H8" />
  </svg>
);

export const RedoIcon = () => (
  <svg {...base} width={15} height={15}>
    <path d="M11.5 4L15 7.5 11.5 11" />
    <path d="M14.5 7.5h-7a4 4 0 000 8H10" />
  </svg>
);

export const DownloadIcon = () => (
  <svg {...base} width={14} height={14}>
    <path d="M9 2.5v9M5 7.5l4 4 4-4M3 15h12" />
  </svg>
);

export const FileIcon = () => (
  <svg {...base} width={15} height={15}>
    <path d="M10 2.5H5a1.5 1.5 0 00-1.5 1.5v10A1.5 1.5 0 005 15.5h8a1.5 1.5 0 001.5-1.5V7z" />
    <path d="M10 2.5V7h4.5" />
  </svg>
);

export const TrashIcon = () => (
  <svg {...base} width={14} height={14}>
    <path d="M3 5h12M7 5V3.5h4V5M5 5l.8 10h6.4L13 5" />
  </svg>
);

export const CopyIcon = () => (
  <svg {...base} width={14} height={14}>
    <rect x="6" y="6" width="9" height="9" rx="1.5" />
    <path d="M12 6V4.5A1.5 1.5 0 0010.5 3h-6A1.5 1.5 0 003 4.5v6A1.5 1.5 0 004.5 12H6" />
  </svg>
);

export const MoleculeIcon = () => (
  <svg {...base}>
    <circle cx="4" cy="12.5" r="2" />
    <circle cx="9" cy="5" r="2" />
    <circle cx="14" cy="12.5" r="2" />
    <path d="M5.2 10.9 7.8 6.6M10.2 6.6l2.6 4.3M6 12.5h6" />
  </svg>
);
