// Icon components — simple inline SVGs, stroke-based, 24×24 viewBox by default
const Icon = ({ d, size = 18, fill = "none", stroke = "currentColor", sw = 1.8, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  Search: (p) => <Icon {...p} d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35" />,
  Plus: (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  Minus: (p) => <Icon {...p} d="M5 12h14" />,
  Close: (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />,
  Check: (p) => <Icon {...p} d="M5 12.5l4.5 4.5L19 7.5" />,
  Layers: (p) => <Icon {...p}><path d="M12 3 2 8.5 12 14l10-5.5L12 3Z" /><path d="m2 14 10 5.5L22 14" /><path d="m2 19 10 5.5L22 19" opacity=".5"/></Icon>,
  Locate: (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></Icon>,
  Ruler: (p) => <Icon {...p}><path d="M3 17 17 3l4 4L7 21l-4-4Z" /><path d="M7 13l2 2M10 10l2 2M13 7l2 2" /></Icon>,
  Legend: (p) => <Icon {...p}><circle cx="6" cy="7" r="2" /><path d="M11 7h9" /><circle cx="6" cy="12" r="2" /><path d="M11 12h9" /><circle cx="6" cy="17" r="2" /><path d="M11 17h9" /></Icon>,
  Move: (p) => <Icon {...p}><path d="M12 3v18M3 12h18M8 7l4-4 4 4M16 17l-4 4-4-4M7 8l-4 4 4 4M17 16l4-4-4-4" /></Icon>,
  Trash: (p) => <Icon {...p} d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />,
  Download: (p) => <Icon {...p} d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
  Upload: (p) => <Icon {...p} d="M12 21V9m0 0 4 4m-4-4-4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />,
  Share: (p) => <Icon {...p}><circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="m9 11 6-3M9 13l6 3" /></Icon>,
  Pin: (p) => <Icon {...p}><path d="M12 21s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></Icon>,
  Doc: (p) => <Icon {...p} d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6" />,
  Clock: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>,
  Activity: (p) => <Icon {...p} d="M3 12h4l3-9 4 18 3-9h4" />,
  Sun: (p) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6 6l1.5 1.5M16.5 16.5 18 18M6 18l1.5-1.5M16.5 7.5 18 6" /></Icon>,
  Moon: (p) => <Icon {...p} d="M21 13a8 8 0 1 1-9-10 6 6 0 0 0 9 10Z" />,
  Auto: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none" /></Icon>,
  Compass: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="m15 9-2 6-4 1 2-6 4-1Z" fill="currentColor" stroke="none" opacity=".15"/><path d="m15 9-2 6-4 1 2-6 4-1Z" /></Icon>,
  Settings: (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Icon>,
  User: (p) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>,
  Logout: (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></Icon>,
  Bell: (p) => <Icon {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z" /><path d="M10 21a2 2 0 0 0 4 0" /></Icon>,
  Help: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r="0.5" fill="currentColor" /></Icon>,
  Pipeline: (p) => <Icon {...p}><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h6a4 4 0 0 1 4 4v6" /></Icon>,
  Filter: (p) => <Icon {...p} d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" />,
  Eye: (p) => <Icon {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Icon>,
  Globe: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon>,
  ArrowLeft: (p) => <Icon {...p} d="M19 12H5m0 0 6-6m-6 6 6 6" />,
};

window.Icons = Icons;
