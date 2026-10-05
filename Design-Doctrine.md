# Kyriadon Website — Design Doctrine

> **Status:** Foundational  
> **Role:** Source Of Truth For Design And Implementation  
> **Scope:** Visual Language, Interaction Language, Responsive Behavior, Component Architecture, And Presentation Standards  
> **Principle:** No Implementation Decision May Silently Redefine The Visual Identity

---

## 1. Purpose

This Doctrine defines the design system of the Kyriadon website before individual pages and features are built.

It exists to prevent visual drift.

Every page, component, modal, card, button, animation, typography choice, gradient, role treatment, and responsive decision must belong to the same visual system. New features are not exceptions to the system; they are expressions of it.

The website is a serious product.

It must feel deliberate, modern, mature, cohesive, technically polished, and unmistakably authored.

The objective is not to imitate another website.

The objective is to establish a recognizable interface that can take structural inspiration from high-quality competitive-gaming products while retaining its own identity, hierarchy, materials, and behavior.

---

# 2. Design Philosophy

## 2.1 Identity Before Decoration

The interface must be identifiable through its:

- Typography
- Spacing
- Hierarchy
- Surfaces
- Button language
- Gradients
- Role treatments
- Iconography
- Motion
- Density
- Responsive behavior

Decoration is secondary.

A visual effect that cannot justify its presence through hierarchy, identity, usability, or atmosphere should not exist.

## 2.2 Structured Restraint

The design should feel rich without becoming noisy.

Use:

- Controlled contrast
- Intentional empty space
- Layered surfaces
- Restrained glow
- Consistent radii
- Selective gradients
- Predictable spacing
- Strong alignment

Avoid:

- Random shadows
- Excessive glow
- Arbitrary gradients
- Inconsistent corner radii
- Decorative elements competing with content
- Unnecessary borders everywhere
- Visual effects added merely because they are possible

## 2.3 Hierarchy Is The Visual Engine

Users should understand the interface before consciously analyzing it.

Every screen must establish:

1. Where the user is
2. What matters most
3. What can be interacted with
4. What is secondary
5. What is informational
6. What is destructive or irreversible

Hierarchy must be expressed consistently through:

- Size
- Weight
- Font family
- Spacing
- Opacity
- Surface elevation
- Contrast
- Color
- Placement
- Motion

No single visual property should carry the entire hierarchy.

## 2.4 Surfaces Should Feel Embedded

Panels, cards, modals, menus, and buttons should not look like unrelated rectangles placed on top of a background.

They should feel as though they belong to the same material system.

The interface should communicate depth through:

- Tonal separation
- Translucency
- Inset edges
- Subtle borders
- Restrained blur where appropriate
- Shadow only where useful
- Consistent radius language

The result should feel like a single environment with different surface elevations.

## 2.5 Clarity Beats Spectacle

The site may be expressive, but never at the cost of comprehension.

A beautiful component that makes information harder to read is a failed component.

A sophisticated visual system must remain usable on:

- Phones
- Tablets
- Laptops
- Large monitors

The interface must degrade gracefully rather than simply shrinking.

---

# 3. Design Doctrine

## 3.1 Source Of Truth

The design system must have one authoritative implementation layer.

Global design tokens should be centralized.

Examples include:

- Color tokens
- Typography tokens
- Font definitions
- Gradient definitions
- Radius tokens
- Spacing tokens
- Shadow/elevation tokens
- Surface tokens
- Transition timings
- Component variants
- Role colors
- Semantic states

Components should consume these tokens instead of independently inventing values.

## 3.2 No Silent Invention

Do not invent a visual treatment for a component merely because the specification does not explicitly mention one.

When a component belongs to an existing visual category, use that category.

When a genuinely new category is required, define it deliberately and add it to the doctrine/system rather than introducing a one-off style.

## 3.3 Preservation Rule

Once an established visual language exists, future changes must preserve it unless the change explicitly revises the doctrine.

Feature work must not casually modify:

- Base spacing
- Global radii
- Typography hierarchy
- Navigation proportions
- Panel language
- Gradient behavior
- Button geometry
- Responsive principles

The doctrine is stronger than any individual page.

---

# 4. Typography Doctrine

Typography is structural, not decorative.

The project must explicitly define which family and weight are used for every typographic role.

## 4.1 Font Families

Define named font families centrally:

- `display` — Major titles and high-impact headings
- `heading` — Page and section hierarchy
- `body` — Paragraphs, labels, descriptions, and general content
- `ui` — Controls, navigation, buttons, tabs, metadata, and compact interface text
- `mono` — Technical values, code, IPs, timestamps, IDs, statistics, and developer-oriented output
- `special` — Optional controlled family for branding or exceptional display treatment

Do not allow arbitrary font-family declarations inside individual components.

The final project must explicitly decide these families before production styling begins.

## 4.2 Heading Hierarchy

Define dedicated rules for:

- `h1`
- `h2`
- `h3`
- `h4`
- `h5`
- `h6`

Each level must have an intentional relationship to the level above it.

Hierarchy should be created with a combination of:

- Family
- Size
- Weight
- Line height
- Tracking
- Opacity/contrast
- Surrounding spacing

Do not differentiate headings only by making one slightly larger.

## 4.3 Body Hierarchy

The system should distinguish between:

- Body text
- Secondary body text
- Captions
- Metadata
- Labels
- Helper text
- Overline/eyebrow text

Secondary information must be visually weaker without becoming inaccessible.

## 4.4 Capitalization

The website does **not** follow a title-case-everything convention.

Use natural capitalization.

Prefer:

- `Featured projects`
- `Server status`
- `Create announcement`
- `Manage staff`

Avoid forced forms such as:

- `Featured Projects`
- `Server Status`
- `Create Announcement`
- `Manage Staff`

Headings may use sentence case unless a specific brand treatment intentionally requires otherwise.

Buttons, labels, navigation items, and interface text should also use natural sentence-style capitalization.

## 4.5 Special Characters

Special characters have their own visual rules.

This includes:

- Arrows
- Separators
- Bullets
- Code characters
- Mathematical symbols
- Decorative marks
- Status glyphs
- Role symbols
- Brand marks

They must align naturally with the surrounding type and must never appear as accidental typography artifacts.

---

# 5. Visual Hierarchy

The interface operates on a consistent priority model.

## Level 0 — Environment

The background and global atmosphere establish the page but never compete with content.

## Level 1 — Primary Content

The main page purpose, primary heading, primary statistic, hero content, or primary action.

## Level 2 — Supporting Content

Subheadings, summaries, supporting statistics, secondary actions, and important metadata.

## Level 3 — Surfaces

Cards, panels, grouped information, secondary navigation, and contextual UI.

## Level 4 — Utility

Small labels, timestamps, helper text, filters, tertiary actions, and technical metadata.

## Level 5 — Ambient Detail

Borders, subtle highlights, blur, glow, separators, and decorative effects.

Ambient detail must remain subordinate to readable content.

---

# 6. Color System

Color must be semantic and intentional.

## 6.1 Base Palette

Establish explicit tokens for:

- Page background
- Elevated background
- Panel background
- Card background
- Modal background
- Input background
- Border
- Divider
- Primary text
- Secondary text
- Muted text
- Disabled text

Do not repeatedly hardcode unrelated neutral values.

## 6.2 Accent System

The project may use a signature accent palette and gradients.

Accents should communicate identity and hierarchy.

Gradient usage must be deliberate.

Gradients may be used for:

- Branding
- Featured elements
- Headings or emphasized text
- Role presentation
- Primary highlights
- Selected decorative surfaces
- Carefully defined interactive states

Do not apply gradients indiscriminately to every surface.

## 6.3 Semantic States

Define explicit visual states for:

- Success
- Warning
- Danger
- Information
- Neutral
- Disabled
- Loading
- Selected

A semantic state must remain understandable through more than color alone.

## 6.4 Contrast

Text and controls must remain readable against their surfaces.

Never sacrifice readability for translucency, glow, or atmospheric effects.

---

# 7. Gradients

Gradients are part of identity, not random ornament.

Every recurring gradient should be named and centralized.

Example conceptual categories:

- `brand`
- `brand-soft`
- `brand-strong`
- `accent`
- `success`
- `danger`
- `role-*`
- `featured`

Gradients must have:

- Defined direction
- Defined stops
- Defined contrast behavior
- Defined usage scope

Do not create several nearly identical gradients for separate components.

When two gradients serve the same semantic purpose, unify them.

---

# 8. Role System

Roles are first-class visual entities.

Each role must have:

- Role name
- Semantic purpose
- Primary color
- Secondary color where needed
- Gradient where appropriate
- Icon/symbol
- Badge treatment
- Text treatment
- Contrast rules
- Dark-surface behavior
- Light-surface behavior if applicable

Role gradients must be visually related while remaining distinguishable.


```

The role system should feel like one family, not a collection of unrelated colors.

Role color is meaningful information.

Do not use a role color for unrelated decorative purposes simply because it looks attractive.

---

## 9. Surfaces

## 9.1 Surface Hierarchy

Every surface belongs to an elevation class.

Recommended conceptual levels:

- `surface-base`
- `surface-raised`
- `surface-panel`
- `surface-card`
- `surface-popover`
- `surface-modal`
- `surface-floating`

The exact implementation values are defined by the system, not by individual pages.

## 9.2 Panels

Panels are major structural containers.

They should feel:

- Dark
- Controlled
- Slightly translucent where appropriate
- Separated from the environment
- Cohesive with cards and modals

Panels may use:

- Subtle inset edges
- Restrained borders
- Controlled blur
- Shallow shadows
- Tonal separation

Do not make every panel visually identical.

Panels should vary through hierarchy while remaining part of the same material family.

## 9.3 Cards

Cards are information containers, not mini-pages.

A card should have:

- Clear internal hierarchy
- Predictable padding
- Controlled density
- Consistent radius
- Clear interactive state when clickable

Cards should not become visually heavier than the page itself.

## 9.4 Modals

Modals must feel like elevated parts of the same interface.

They require:

- Strong surface separation
- Clear title hierarchy
- Predictable close behavior
- Obvious primary/secondary actions
- Usable internal scrolling where required
- Mobile-safe dimensions

The backdrop should establish focus without visually destroying the underlying page.

---

## 10. Buttons

Buttons are among the most recognizable parts of the product language.

## 10.1 Button Families

Define a controlled button family such as:

- Primary
- Secondary
- Tertiary/ghost
- Danger
- Success
- Icon-only
- Link-like
- Compact
- Loading/disabled

Every family must share a common geometry.

## 10.2 Button Geometry

Buttons should have:

- Consistent height logic
- Consistent radius
- Consistent internal padding
- Consistent icon alignment
- Predictable text weight
- Controlled spacing between icon and text

Do not create a new button shape for every page.

## 10.3 Interaction States

Every interactive button must define:

- Default
- Hover
- Active/pressed
- Focus-visible
- Disabled
- Loading
- Destructive confirmation state where applicable

The transition between states should be subtle and fast.

## 10.4 Visual Integration

Buttons should appear to float naturally within the surface system.

They must not look pasted onto panels.

Primary buttons may carry stronger accent treatment.

Secondary buttons should remain visually present without competing with primary actions.

---

## 11. Badges, Chips, And Compact Metadata

Badges communicate classification.

They may represent:

- Roles
- Categories
- Status
- Tags
- Counts
- Permissions
- State

Badges should be:

- Compact
- Legible
- Consistently padded
- Semantically meaningful
- Visually related to the surrounding surface

Avoid badge overload.

When everything is a badge, nothing is a badge.

---

## 12. Inputs And Controls

Inputs should visually belong to the same material ecosystem as cards and panels.

Define consistent behavior for:

- Text fields
- Search fields
- Selects
- Checkboxes
- Toggles
- Tabs
- Filters
- Textareas
- Segmented controls

Each must have explicit:

- Default state
- Hover state where relevant
- Focus-visible state
- Error state
- Disabled state
- Populated state
- Placeholder behavior

Focus must remain clearly visible and keyboard accessible.

---

## 13. Iconography

Icons must share a coherent visual language.

The project should decide:

- Stroke vs fill philosophy
- Typical stroke width
- Corner treatment
- Optical size
- Icon spacing
- Alignment rules

Do not mix unrelated icon families without a reason.

Icons should reinforce hierarchy rather than become decoration.

---

## 14. Motion Doctrine

Motion should explain change.

Use animation for:

- Entering/leaving surfaces
- Modal presentation
- Hover feedback
- State transitions
- Navigation transitions where useful
- Expanding/collapsing content
- Loading indicators

Avoid:

- Constant movement
- Excessive bounce
- Long transitions
- Motion that delays interaction
- Animation that distracts from reading

Motion must remain usable on lower-powered devices.

Respect reduced-motion preferences.

---

## 15. Responsive Doctrine

Responsive design is not “desktop layout but smaller.”

The interface must be designed across three primary contexts:

## Mobile

Priority:

- Readability
- Reachability
- Touch targets
- Vertical hierarchy
- Safe spacing
- Minimal horizontal density

Navigation may collapse or transform.

Large panels should become full-width or near-full-width structures where appropriate.

## Laptop

Priority:

- Efficient information density
- Stable navigation
- Balanced whitespace
- Readable content width
- Practical multitasking

## Monitor

Priority:

- Use additional space intelligently
- Preserve readable line lengths
- Avoid uncontrolled stretching
- Allow comfortable breathing room
- Maintain a deliberate visual center

Never stretch content simply because more pixels are available.

## 15.1 Breakpoint Philosophy

Breakpoints exist to solve layout problems, not to satisfy arbitrary device names.

The component must adapt when its current geometry stops being useful.

## 15.2 Touch Targets

Interactive controls must remain comfortably tappable.

Do not make controls tiny merely to preserve desktop density on mobile.

## 15.3 Text Wrapping

Text must wrap naturally.

Do not rely on fragile fixed widths that cause:

- Clipped headings
- Overflowing buttons
- Hidden menus
- Broken badge rows
- Inaccessible controls

---

## 16. Spacing System

Spacing must follow a predictable scale.

Define a centralized spacing system rather than selecting random pixel values.

Spacing governs:

- Page margins
- Section gaps
- Card padding
- Heading separation
- Button groups
- Form fields
- Icon/text relationships
- Modal composition

Consistency in whitespace is a major contributor to perceived quality.

---

## 17. Radius Doctrine

Corner radii create personality.

The project must define a small family of radii rather than using arbitrary values.

Example conceptual hierarchy:

- Subtle
- Control
- Card
- Panel
- Modal
- Pill

Do not mix sharp, rounded, and pill shapes randomly.

A component's radius should communicate its category.

---

## 18. Borders, Inset Edges, And Shadows

Depth should be subtle.

## Borders

Borders should separate surfaces without drawing attention to themselves.

## Inset Edges

Inset highlights or darkened edge treatments may be used to create a polished, embedded appearance.

They should remain restrained and consistent.

## Shadows

Shadows communicate elevation.

Use them sparingly.

A surface should not require a heavy shadow to be perceived as separate.

---

## 19. Page Composition

Every page should answer four questions immediately:

1. What is this page?
2. What is the most important thing here?
3. What can I do?
4. Where am I in the wider site?

A page should have a deliberate composition rather than a collection of vertically stacked components.

Recommended composition logic:

- Global shell
- Page identity
- Primary content
- Supporting content
- Contextual actions
- Supporting/utility regions
- Footer where applicable

Not every page needs every region.

---

## 20. Navigation Doctrine

Navigation is a permanent orientation system.

It should:

- Remain recognizable across pages
- Preserve the brand
- Clearly communicate the active location
- Avoid unnecessary clutter
- Adapt intentionally to mobile
- Keep primary destinations easy to reach

Navigation should not visually overpower the page content.

---

## 21. Content Density

The product must support both information-rich and lightweight pages.

For information-heavy pages:

- Group related content
- Use hierarchy
- Use progressive disclosure
- Allow scanning
- Avoid giant uninterrupted text blocks

For lightweight pages:

- Do not artificially add panels simply to fill space
- Preserve whitespace
- Let the primary content breathe

---

## 22. Interaction Consistency

The same action should feel the same everywhere.

For example:

- Close actions should behave consistently
- Destructive actions should look consistent
- Secondary navigation should follow one model
- Loading states should follow one model
- Confirmation dialogs should follow one model
- Notification states should follow one model

A user should not have to relearn the interface from page to page.

---

## 23. Accessibility Doctrine

Visual quality does not override usability.

The interface must support:

- Keyboard navigation
- Visible focus states
- Readable contrast
- Semantic HTML
- Accessible labels
- Usable touch targets
- Reduced motion
- Screen-reader-friendly controls
- Meaningful error states

Do not encode essential meaning through color alone.

---

## 24. Technical Design Discipline

The design system must remain maintainable.

## Do

- Centralize tokens
- Reuse components
- Use semantic names
- Keep variants explicit
- Isolate genuinely page-specific behavior
- Document meaningful deviations
- Preserve responsive behavior during refactors

## Do Not

- Duplicate global styles
- Introduce random one-off values
- Create near-identical component variants
- Hide styling logic in arbitrary inline values
- Copy/paste major component systems between pages
- Change global design tokens to fix a local problem

A local problem should usually receive a local solution.

---

## 25. Component Doctrine

Every reusable component should have a clear responsibility.

A component should know:

- What it represents
- What state it supports
- Which design tokens it consumes
- Which variants are valid
- How it behaves responsively

Avoid components that mix unrelated responsibilities merely because they happen to appear together on one page.

---

## 26. Consistency Rules

The following are considered design regressions:

- A button with a unique radius without a defined reason
- A panel that uses unrelated colors
- Typography that bypasses the defined hierarchy
- Arbitrary capitalization
- An inconsistent role color
- A modal that looks unrelated to other modals
- Mobile layout that is merely compressed desktop UI
- Repeated components implemented with different visual logic
- One-off gradients that duplicate existing gradients
- Decorative effects that overpower content
- A page that ignores the global spacing system

A feature is not finished when it works.

It is finished when it belongs.

---

## 27. Visual Quality Standard

Before a page is considered complete, inspect it as a composition.

Check:

## Hierarchy

Can the page be understood at a glance?

## Alignment

Do major elements align intentionally?

## Rhythm

Does spacing feel consistent?

## Surfaces

Do panels, cards, buttons, and modals belong to the same material system?

## Typography

Are every heading and text role using the intended hierarchy?

## Color

Are accents meaningful rather than decorative noise?

## Interaction

Do hover, active, focus, loading, disabled, and error states feel like one system?

## Responsiveness

Does the page remain deliberate from phone to large monitor?

## Density

Is information easy to scan?

## Identity

Could someone recognize this interface as the Kyriadon website without seeing the logo?

---

## 28. Implementation Order

The website must be built in this order unless a deliberate technical dependency requires otherwise.

## Phase 1 — Doctrine

Finalize:

- Typography
- Color tokens
- Gradients
- Role system
- Spacing
- Radii
- Surfaces
- Button families
- Icon language
- Motion principles
- Responsive principles

## Phase 2 — Global Shell

Build:

- Page background
- Global typography
- Navigation
- Global containers
- Responsive shell
- Shared surface primitives

## Phase 3 — Core Primitives

Build and validate:

- Buttons
- Badges
- Cards
- Panels
- Inputs
- Tabs
- Menus
- Modals
- Notifications
- Status indicators

## Phase 4 — Page Composition

Build pages from the established primitives.

Do not redesign the primitives on every page.

## Phase 5 — Feature Systems

Add:

- Data
- Authentication
- Announcements
- Statistics
- Staff systems
- Player systems
- Administrative tools
- Other product functionality

Functionality should be layered into the established visual system.

## Phase 6 — Refinement

Perform dedicated passes for:

- Responsive behavior
- Spacing
- Typography
- Interaction states
- Accessibility
- Performance
- Visual consistency
- Edge cases

---

## 29. Change Control

Any requested change falls into one of three categories.

## Additive

Adds capability without altering the established design language.

Implement directly.

## Corrective

Fixes a bug, inconsistency, accessibility issue, or broken responsive behavior.

Fix surgically without redesigning unrelated areas.

## Doctrinal

Changes the established visual philosophy itself.

This requires an explicit decision because it affects every future component.

---

## 30. The Governing Rule

The website must never become a collection of individually impressive pages.

It must become **one interface**.

Every page should feel as though it was designed by the same person, from the same doctrine, using the same vocabulary, with the same understanding of hierarchy.

The doctrine is the foundation.

The design system is the language.

The components are the vocabulary.

The pages are the sentences.

The complete product is the result.

**No drifting.**
**No accidental redesigns.**
**No arbitrary invention.**
**No visual regression disguised as progress.**

Build deliberately.

Build consistently.

Build the vision.
