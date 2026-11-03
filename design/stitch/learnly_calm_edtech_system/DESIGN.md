---
name: Learnly Calm EdTech System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006e2d'
  on-secondary: '#ffffff'
  secondary-container: '#7cf994'
  on-secondary-container: '#007230'
  tertiary: '#4d556b'
  on-tertiary: '#ffffff'
  tertiary-container: '#656d84'
  on-tertiary-container: '#eef0ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#7ffc97'
  secondary-fixed-dim: '#62df7d'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005320'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system combines the tranquil, uncluttered spatial hierarchy of structured asynchronous classroom dashboards with the focused immersion of modern virtual meeting spaces. The brand personality is dependable, distraction-free, encouraging, and institutional without feeling bureaucratic.

The aesthetic fuses modern structured minimalism with high-utility interface patterns. Daylight educational views rely on generous white space, soft boundaries, and disciplined card compositions, while real-time video classrooms switch smoothly to focused dark stages to minimize optical fatigue. Visual delight is introduced through distinct subject accent headers and crisp progress signaling rather than decorative clutter.

## Colors
The color architecture divides cleanly into operational interface tones, live classroom states, semantic signals, and subject category identity.

### Interface Core & Surfaces
- **Primary Blue (`#2563EB`)**: Navigation roots, active tab indicators, primary action triggers, text links, and focused input indicators.
- **Accent Green (`#16A34A`)**: Course progress arcs, completion chips, and positive progression checkpoints.
- **Base Canvas Surface (`#F8FAFC`)**: Slate-tinted daylight background, providing soft contrast behind pure white cards.
- **Card Surface (`#FFFFFF`)**: High-legibility base for modules, assignments, and roster tiles.
- **Border Default (`#E2E8F0`)**: 1px perimeter outlines on interactive surfaces, dividers, and card envelopes.
- **Stage Background (`#111827`)**: Deep neutral black dedicated to the live video environment, video participant tiles, and in-call control bars.

### Typography Shades
- **Text Primary (`#0F172A`)**: Headings, critical labels, and high-emphasis body text.
- **Text Secondary (`#475569`)**: Timestamps, instructor bylines, metadata, and instructional hints.
- **Text Muted (`#94A3B8`)**: Inactive shortcuts and placeholder values.

### Subject Header Accent Palette
Course headers use six dedicated accents for distinct topic recognition:
- **Blue**: `#2563EB` (STEM & Core Computation)
- **Coral**: `#EA580C` (Humanities & Creative Arts)
- **Slate**: `#475569` (Administration & General Studies)
- **Purple**: `#9333EA` (Literature & Languages)
- **Teal**: `#0D9488` (Natural Sciences & Research)
- **Amber**: `#D97706` (Social Sciences & History)

### Status Signals
- **Success**: `#16A34A` (Submitted, present, active score)
- **Warning**: `#D97706` (Due soon, hand raised, unstable network)
- **Danger**: `#DC2626` (Overdue, disconnected, mute state)
- **Info**: `#2563EB` (Upcoming schedule, system notification)

## Typography
The system standardizes entirely on **Inter** across all operational touchpoints to maintain high legibility under dense informational displays and low-light video scenarios.

- **Headline XL (`32px/40px`, bold)**: Primary screen views, major course dashboard titles. Scales down to `28px/36px` on mobile screens.
- **Headline LG (`24px/32px`, semibold)**: Course card headers, modal titles, and section breakouts.
- **Headline MD (`20px/28px`, semibold)**: Assignment titles, panel drawer headers, participant names in spotlight view.
- **Body LG (`16px/24px`, regular)**: Syllabus descriptions, primary assignment prompts, and rich text feedback.
- **Body MD (`14px/20px`, regular)**: Feed comments, activity stream logs, and standard item lists.
- **Label MD (`14px/20px`, medium)**: Buttons, tab items, form inputs, and high-priority chip text.
- **Label SM (`12px/16px`, medium)**: Status badges, counter tags, duration pills, and metadata banners.
- **Caption (`12px/16px`, regular)**: Fine print, file sizes, and secondary participant timestamps.

## Layout & Spacing
A rigid **8px spacing grid** governs all layout dimensions. Base units: `0.25rem` (4px), `0.5rem` (8px), `1rem` (16px), `1.5rem` (24px), and `2rem` (32px).

### Classroom Dashboard Layout
- **Desktop (1200px+)**: 12-column responsive fluid grid with `2rem` margins and `1.5rem` gutters. Course grids use 3 or 4 uniform columns.
- **Tablet (768px - 1199px)**: 8-column layout with `1.5rem` margins and `1rem` gutters. Course cards reflow to a 2-column grid. Left navigation rail collapses to icon-only.
- **Mobile (< 768px)**: 4-column layout with `1rem` margins and `1rem` gutters. Cards flow single-column. Navigation docks to a bottom bar.

### Live Meeting Stage Layout
- Uses a container-bound layout against `#111827`.
- **Active Speaker + Strip**: Central stage occupies 75% width; right sidebar occupies 25% with uniform `0.5rem` gaps between remote participant tiles.
- **Grid View**: CSS aspect-ratio box grid (16:9 tiles) with strict `0.5rem` interior gaps and an anchored floating bottom control bar pinned with `1.5rem` bottom clearance.

## Elevation & Depth
Depth is constructed through flat tonal planes, crisp 1px borders, and ultra-soft, low-opacity ambient drop shadows. Heavy blurs and glossy elevations are avoided to preserve educational clarity.

- **Level 0 (Flat Canvas)**: `#F8FAFC` base surface for daytime layout; `#111827` for real-time video rooms. Zero shadow.
- **Level 1 (Card & Module Resting)**: `#FFFFFF` filled card with a solid `1px` border of `#E2E8F0` and shadow `0 1px 3px 0 rgba(15, 23, 42, 0.04)`.
- **Level 2 (Interactive Hover & Context Menus)**: Card elevates upon pointer hover using `0 4px 12px -2px rgba(15, 23, 42, 0.08)` and border tint shifting to `#CBD5E1`.
- **Level 3 (Modals, Overlays, Floating Video Controls)**: Shadow `0 12px 28px -4px rgba(15, 23, 42, 0.16)`. In dark video mode, floating toolbars use `#1E293B` background with a subtle highlight border of `rgba(255, 255, 255, 0.08)`.

## Shapes
Geometry is disciplined, using two core corner languages:
- **Cards and Containers**: Standardized on a structural **16px** (`1rem`) border radius (`rounded-lg`). Applied to classroom course cards, submission modules, modal containers, and video tile viewports.
- **Interactive Pills and Badges**: Fully rounded **999px** circular radius. Applied to active navigation pills, status badges, counter indicators, video control circle triggers, and search bars.
- **Form Controls & Micro Inputs**: Consistent **8px** (`0.5rem`) radius for text input fields, dropdown trigger buttons, and contextual menu items.

## Components

### Iconography
- Icons are drawn on a uniform **24px x 24px** boundary with a continuous **1.5px stroke outline**, rounded caps, and rounded joins. Never use solid fills except for active toggle states (e.g., mic muted, camera off).

### Buttons
- **Primary**: Pill or 8px rounded variant depending on density. Background `#2563EB`, text `#FFFFFF`, font `Label MD`. Hover: `#1D4ED8`. Focus outline: 2px offset with `#93C5FD`.
- **Secondary**: Background `#FFFFFF`, border `1px solid #E2E8F0`, text `#0F172A`. Hover: `#F1F5F9`.
- **Success Action**: Background `#16A34A`, text `#FFFFFF`. Used for assignment turn-in triggers.
- **Live Room Call Controls**: Circular pills (48px x 48px). Neutral inactive uses `#374151` with white icon; destructive disconnect uses `#DC2626`.

### Cards (Course & Assignment)
- Constructed with `#FFFFFF` background, `16px` border radius, and `1px solid #E2E8F0`.
- **Subject Cards**: Feature an 80px colored top header band selected from the 6-color palette (Blue, Coral, Slate, Purple, Teal, Amber) containing course title and teacher details in high-contrast white text, followed by white interior content housing upcoming deadlines and task lists.
- **Hover State**: Border shifts smoothly to `#CBD5E1` with Level 2 elevation lift.

### Chips & Badges
- **Status Pills**: 999px radius, padding `4px 12px`, typography `Label SM`.
  - *Completed*: Background `#DCFCE7`, text `#15803D`.
  - *Due Soon*: Background `#FEF3C7`, text `#B45309`.
  - *Late*: Background `#FEE2E2`, text `#B91C1C`.
- **Progress Trackers**: Compact horizontal progress bar (height 6px, track `#E2E8F0`, fill `#16A34A`, border radius 999px) paired with trailing percentage label in `Caption`.

### Input Fields & Selects
- 40px base height, `8px` corner radius, background `#FFFFFF`, border `1px solid #E2E8F0`, horizontal padding `12px`.
- Typography `Body MD` with placeholder `#94A3B8`.
- Focus state: Border shifts to `#2563EB` with an ambient glow shadow `0 0 0 3px rgba(37, 99, 235, 0.15)`.

### Checkboxes & Radios
- Size: 18px x 18px. Border: 1.5px solid `#CBD5E1`.
- Checked state: Background `#2563EB` with white checkmark icon. Corner radius: 4px for checkboxes, 999px for radio discs.

### Lists & Rosters
- Zero-gap list items bound with `1px solid #F1F5F9` bottom separators.
- Hover state: background `#F8FAFC`.
- Left-aligned avatar (36px circle), center label stack with Primary Text (`Body MD`) and Secondary Text (`Caption`), right-aligned action or status pill.

### Live Video Participant Tile
- Aspect ratio 16:9, background `#1F2937`, border radius `16px`, subtle perimeter border `1px solid rgba(255, 255, 255, 0.08)`.
- Active speaker state indicated by a `2px solid #2563EB` inner ring.
- Lower-left overlay: Pill container with blurred dark backing (`rgba(17, 24, 39, 0.75)`), white text (`Label SM`), and mini mic status icon.