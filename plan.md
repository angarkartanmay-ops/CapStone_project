# OmniMetrics AI — implementation plan

## Product scope
Build a high-density enterprise Data Analytics SaaS workspace with seeded Healthcare/COVID-19, E-Commerce Sales, and Infrastructure Telemetry datasets. The UI should support simulated dataset ingestion and CRUD, schema/quality inspection, transformations, interactive SVG analytics, SQL/NL query simulation, saved dashboards, and export feedback. The experience is a dark, glassy operator console for Analyst/Admin roles.

## Design direction

### Candidate styles
- **0.06 — Orbital Control Plane:** dense observability console with instrument-like labels, thin rules, cyan/emerald signal lights, and layered translucent surfaces.
- **0.04 — Neo-Brutalist Ledger:** stark blocks, high-contrast typography, and hard-edged data tables.
- **0.08 — Soft Financial Terminal:** muted navy, rounded cards, and conservative trading-terminal density.

### Selected movement: Orbital Control Plane

- **Core principles:** Make the active dataset and next action obvious; use data density as a feature without visual noise; treat status/health as first-class information; keep every surface responsive and inspectable.
- **Color philosophy:** Near-black blue-gray backgrounds provide a calm control-room canvas. Emerald signals healthy data and completed actions; cyan marks analytic focus and interactive affordances; amber/red are reserved for quality warnings and anomaly states.
- **Layout paradigm:** A persistent instrument rail anchors the left side while the main canvas uses asymmetric telemetry panels, an oversized lead chart, and smaller diagnostic modules rather than a symmetrical marketing grid.
- **Signature elements:** Lime/cyan edge glows, compact uppercase section labels with tracking, and thin rules with tiny live-status dots.
- **Interaction philosophy:** Hover states reveal context and detail instead of decoration. Switching datasets, roles, filters, or views should update adjacent metrics immediately and leave a visible feedback trace.
- **Animation:** Use short 160–240ms transitions for panel changes, subtle pulse on live indicators, and animated chart dots/progress bars; avoid looping motion outside status lights.
- **Typography system:** Use system sans for compact UI legibility with `ui-monospace` for metrics, SQL, timestamps, and identifiers. Headlines are sentence case with tight tracking and restrained weight.
- **Brand essence:** A control plane for teams that need to move from raw signals to trusted decisions quickly. Personality: precise, alert, grounded.
- **Brand voice:** Direct and operational. Example lines: “Trace the signal before it becomes a ticket.” and “Health is good; one anomaly needs a closer look.”
- **Wordmark & logo:** “OM” monogram formed from two offset telemetry brackets, paired with a small pulse line; rendered as a compact mark in the sidebar.
- **Signature brand color:** `#B7F34A` acid-lime, used sparingly for active state and strong health signals.

## Implementation approach

- Use the existing React/Vite/Tailwind scaffold and Lucide React icon package.
- Keep the first release front-end driven with local seeded state: the managed server/database remain enabled for future persistence, while ingestion, CRUD, queries, dashboard saves, and exports are simulated so the UI is immediately usable in Preview.
- Implement chart primitives as SVG components in `client/src/pages/Home.tsx` to keep interaction state close to the dashboard: line, bar, donut, scatter, and radar.
- Store seeded datasets and query result rows in typed constants. Use `useState` for active dataset, page, role, filters, import state, saved dashboards, and toast feedback.
- Keep the application route surface intentionally small: `/` is the working console and `/404` remains the starter not-found route.

## Project structure

- `client/src/pages/Home.tsx` — primary OmniMetrics console, typed seed data, layout, charts, interactive panels, modals.
- `client/src/index.css` — dark theme tokens, atmospheric background, glass surfaces, scrollbar and utility styles.
- `client/src/App.tsx` — route shell with dark theme default.
- `public/manus-routes.json` — route manifest for `/` and `/404`.
- `app.config.ts` — project-logo metadata.
- `plan.md` / `TODO.md` — source-of-truth product decisions and outcomes.

## Runtime / validation

- Use `pnpm dev` on the configured port 3000.
- Type-check with `pnpm check` and build with `pnpm build` after implementation.
- Use the Webdev preview screenshot only if needed to investigate rendering defects; primary validation is diagnostics, build output, and code inspection.
