---
name: Cyber-Forensic Protocol
colors:
  surface: '#0f1418'
  surface-dim: '#0f1418'
  surface-bright: '#343a3e'
  surface-container-lowest: '#0a0f12'
  surface-container-low: '#171c20'
  surface-container: '#1b2024'
  surface-container-high: '#252b2e'
  surface-container-highest: '#303539'
  on-surface: '#dee3e8'
  on-surface-variant: '#bdc8d1'
  inverse-surface: '#dee3e8'
  inverse-on-surface: '#2c3135'
  outline: '#87929a'
  outline-variant: '#3e484f'
  surface-tint: '#7bd0ff'
  primary: '#8ed5ff'
  on-primary: '#00354a'
  primary-container: '#38bdf8'
  on-primary-container: '#004965'
  inverse-primary: '#00668a'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffc176'
  on-tertiary: '#472a00'
  tertiary-container: '#f1a02b'
  on-tertiary-container: '#613b00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c4e7ff'
  primary-fixed-dim: '#7bd0ff'
  on-primary-fixed: '#001e2c'
  on-primary-fixed-variant: '#004c69'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb960'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0f1418'
  on-background: '#dee3e8'
  surface-variant: '#303539'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  gutter: 16px
  margin-desktop: 24px
  column-count: '12'
  container-max: 1440px
---

## Brand & Style
The design system is engineered for high-stakes technical environments where precision and speed of interpretation are paramount. The brand personality is **authoritative, analytical, and impenetrable**. It evokes the feeling of a sophisticated command center, moving away from "hacker" tropes toward a professional, enterprise-grade cybersecurity tool.

The visual style is **Modern Developer Tooling (DevTools)** mixed with **Subtle Glassmorphism**. This approach uses high-contrast accents against a deep, structured canvas to guide the eye toward critical vulnerabilities. The interface prioritizes information density without sacrificing clarity, utilizing crisp borders and layered surfaces to organize complex APK metadata.

## Colors
The palette is rooted in a **Deep Navy/Charcoal** foundation to reduce eye strain during long analysis sessions. 

- **Primary (Electric Blue):** Used for primary actions, active states, and focus indicators.
- **Secondary (Matrix Green):** Used for success states and secondary completion actions.
- **Semantic Accents:** These are strictly reserved for severity levels. 
    - **Critical (#EF4444):** Immediate threats or high-risk permissions.
    - **Warning (#F59E0B):** Suspicious patterns or obfuscated code.
    - **Safe (#10B981):** Verified clean signatures.
- **Surface Tiers:** Use `#1E293B` for primary containers and `#334155` for subtle borders or inactive UI elements to maintain a strict technical hierarchy.

## Typography
This design system utilizes a dual-font strategy. **Inter** provides high legibility for UI controls and reports, while **JetBrains Mono** is utilized for all raw data, hex dumps, and decompiled Java/Kotlin code.

- **Headlines:** Use tight letter-spacing and bold weights to ground the layout sections.
- **Technical Data:** All APK metadata, package names, and hash values (MD5/SHA) must be rendered in `code-md` or `code-sm` to ensure character alignment.
- **Bilingual Support:** The type scales are designed with enough line-height padding to accommodate the descriptive nature of Spanish text, which often runs 20% longer than English.

## Layout & Spacing
The system employs a **12-column fluid grid** for the main dashboard, with a fixed sidebar for primary navigation (240px width). 

- **Spacing Rhythm:** Based on a 4px baseline. Use 8px (small), 16px (medium), and 24px (large) increments for standard padding.
- **Density:** High-density layout. Vertical rhythm in data tables should use 8px cell padding to maximize visible rows.
- **Breakpoints:**
    - **Desktop (Default):** 12 columns, 24px margins.
    - **Large Desktop:** 1440px max-container width, centered.
    - **Tablet:** 8 columns, 16px margins; sidebar collapses to icons.

## Elevation & Depth
Depth is achieved through **Tonal Layering** and **Subtle Outlines** rather than heavy shadows, maintaining the "DevTool" aesthetic.

- **Base Layer:** Background (#0F172A).
- **Surface Layer:** Dashboard cards and sidebars (#1E293B).
- **Floating Layer:** Modals and tooltips (#334155) with a 1px border of `#475569` and a very subtle 15% opacity black shadow.
- **Glass Effect:** Use `backdrop-filter: blur(12px)` for table headers and floating analysis panels to maintain context of the code underneath.

## Shapes
The design system uses a **Soft (0.25rem)** roundedness approach. This maintains a technical, rigid feel while looking modern.

- **Standard Buttons/Inputs:** 4px radius.
- **Code Containers:** 4px radius for the container, but 0px for the individual code lines.
- **Badges/Tags:** Fully rounded (pill) to distinguish them from interactive buttons.

## Components

### Buttons & Inputs
- **Primary Action:** Solid Electric Blue background, white text. No gradient.
- **Technical Inputs:** Dark background (#0F172A) with a 1px stroke. Active state uses an Electric Blue glow (`0 0 0 2px`).
- **Collapsible Code Viewer:** Uses a subtle gutter for line numbers. Fold icons should be minimal Chevrons.

### Data-Heavy Tables
- **Row Styling:** Alternate row striping using 2% white overlay. On hover, rows highlight with a primary blue border on the left edge.
- **Permission Badges:** Small, pill-shaped tags. High-risk permissions (e.g., `SEND_SMS`) use the Critical Red background with low opacity (15%) and solid red text.

### Progress Indicators
- **Analysis Bar:** Thin 4px height. For "In Progress," use a dual-tone pulse effect (Primary Blue to Secondary Green).
- **Status Indicators:** Use small solid circles (8px) next to text labels for quick scanning of safe/unsafe components.

### Lists & Navigation
- **Sidebar Nav:** High contrast for active state. Use "Matrix Green" as a 2px vertical indicator on the left of the active menu item. 
