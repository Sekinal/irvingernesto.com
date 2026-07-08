export const SITE = {
  name: 'Irving Ernesto Quezada Ramírez',
  shortName: 'Irving Ernesto',
  title: 'Irving Ernesto Quezada Ramírez · AI Engineer & Physicist',
  description:
    'AI engineer & physicist. CTO of RoomIQ, main developer of SteelEye. I build ML systems, data pipelines and the infrastructure that keeps them alive in production.',
  url: 'https://irvingernesto.com',
  email: 'business@irvingernesto.com',
  location: 'Xalapa, Veracruz, MX',
  coords: '19.5438° N, 96.9102° W',
} as const;

export const SOCIALS = [
  { label: 'GitHub', handle: 'Sekinal', href: 'https://github.com/Sekinal' },
  { label: 'HuggingFace', handle: 'Thermostatic', href: 'https://huggingface.co/Thermostatic' },
  { label: 'X', handle: '@ieqr_', href: 'https://x.com/ieqr_' },
  { label: 'LinkedIn', handle: 'ieqr', href: 'https://www.linkedin.com/in/ieqr' },
  { label: 'Email', handle: 'business@irvingernesto.com', href: 'mailto:business@irvingernesto.com' },
] as const;

export const STATS = [
  { value: '62', label: 'Models on HuggingFace' },
  { value: '68', label: 'Open datasets published' },
  { value: '80K+', label: 'Listings ingested daily at RoomIQ' },
  { value: '0.95', label: 'End-to-end F1, SteelEye detector' },
] as const;

export const MARQUEE = [
  'LLM fine-tuning',
  'Data engineering',
  'Reverse engineering',
  'Python',
  'Rust',
  'TypeScript',
  'Dagster',
  'PostgreSQL',
  'PyTorch',
  'XGBoost',
  'FastAPI',
  'Next.js',
  'Docker',
  'CUDA',
] as const;

export const EXPERIENCE = [
  {
    period: '2023 → Now',
    role: 'CTO & Co-founder',
    org: 'RoomIQ',
    note: 'Market intelligence for room-rental investors across 600+ US cities.',
    href: 'https://roomiq.io',
  },
  {
    period: '2025 → Now',
    role: 'Main Developer',
    org: 'SteelEye',
    note: 'The operating system for steel contractors: estimating, job costing, AIA billing.',
    href: 'https://steeleye.ai',
  },
  {
    period: '2025 → Now',
    role: 'Data Engineer',
    org: 'FindMyFlight.ai',
    note: 'Airline-data infrastructure. Recruited after winning a scraper performance contest.',
    href: null,
  },
  {
    period: '2025 → Now',
    role: 'Software Engineer',
    org: 'Portals (UK)',
    note: 'Real-time LLM localization for enterprise live streaming in 20+ languages.',
    href: null,
  },
  {
    period: '2024 → 2025',
    role: 'Research Assistant',
    org: 'Universidad Veracruzana · CEICAH',
    note: 'GPU-accelerated time-series analysis over YOLO detection pipelines.',
    href: null,
  },
] as const;
