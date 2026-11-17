# Project memory

## Product intent & audience

- Customer-facing web application (React + Vite + TypeScript)
- Likely a customer portal/dashboard — has a `CustomerHome.tsx` page component

## Brand personality & voice

- Not yet inferred — no user-facing copy or branding decisions encountered yet

## Visual design & UX direction

- UI built with Tailwind CSS classes and Lucide React icons
- Project uses `@/` path alias for imports (maps to `src/`)
- No additional UI theme or icon packages installed

## Decisions, constraints & rationale

- TypeScript strict — type errors block preview/build
- Production build validated via `npm run build` in a prior session
- Known remaining bug: `col` variable in `CustomerHome.tsx` (~line 239) referenced inside a `useEffect` but defined in a different scope; needs to be moved inside the effect or computed before the filter string is built
- Type mismatches in a types file were previously fixed

## Open questions & assumptions

- Exact app domain and feature set not yet clear — only `CustomerHome.tsx` is known
- Sandbox/platform connectivity can intermittently block shell commands and file ops; not a code issue
- User was unable to see preview/code output — root cause may be type error blocking build or platform instability; needs confirmation once sandbox is available