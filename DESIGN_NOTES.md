# Redesign notes

## Brainstorm and critique

The initial routes considered were a modular bento portfolio, a collider-analysis notebook, and a detector event-display identity. The UI/UX Pro Max search suggested the familiar bento-grid/Orbitron/blue-accent combination. That route was rejected because it could describe almost any technical portfolio and repeats the generic sci-fi framing this redesign is meant to remove.

The chosen direction combines the latter two ideas: editorial analysis-note typography for the content system, and a simplified ATLAS transverse cross-section for the signature visual. Fraunces gives page titles and the name an authored, academic character; Inter remains the reading face; JetBrains Mono carries dates, measurements, labels, and live data.

## Visual decisions

- The global canvas is warm paper (`#F6F0E5`) with near-black ink, visible 32px cyan notebook squares, and subtle fiber speckle. Cards use a slightly raised warm white instead of dark glass surfaces.
- The old starfield canvas, aurora overlay, spinning portrait orbits, and five-way cosmic accent system were removed.
- The hero portrait now sits at the detector interaction point. Four finite track paths draw through tracker, calorimeter, and muon-system arcs, then stop. There is no continuous decorative animation.
- Track Cyan, Track Amber, and Track Crimson are assigned by surface instead of mixed into rainbow gradients. Signal Violet appears only on the dark-matter thesis marker.
- Badges are compact detector readouts with small signal dots. Cards use restrained square geometry and a track-colour underline on hover.
- Experience and education now share one route and one progressive-disclosure pattern. Every role, degree, and research project uses a restrained flat SVG symbol; the first item in each group starts open and details remain readable when JavaScript is unavailable.
- Repository and publication pages show the timestamp of the dataset or API fetch that produced the visible data.
- The travel globe and detail map use the same paper, ink, cyan, amber, and crimson tokens as the rest of the interface instead of the previous dark neon canvas palette.
- Section numbering and the detector-caption text behind the portrait were removed to keep the notebook presentation quiet.

## Motion and accessibility

- The hero detector sequence is the one signature motion moment. The existing `IntersectionObserver` reveal system remains responsible for restrained scroll entry.
- `prefers-reduced-motion` renders the detector and page content immediately in their settled state.
- Keyboard focus uses a high-contrast ink/crimson ring. Mobile navigation reports `aria-expanded`, closes with Escape, and globe/video controls retain at least 44px targets.

## Protected integrations

GitLab activity/projects and Semantic Scholar publications retain their data contracts, with additive fetch-time metadata for freshness labels. Three legacy CSS custom-property aliases remain solely because the publication renderer emits those names inline; each resolves directly to the new track palette.
