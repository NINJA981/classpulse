# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19, Vite 8, TailwindCSS v4, Recharts, Lucide Icons

## Users

K-12 Teachers, University Professors, School & University Administrators, and Students in active live lecture environments.

## Product Purpose

ClassPulse transforms live classroom lectures into real-time interactive learning experiences. It streams live audio from Raspberry Pi edge microphone nodes, generates bilingual (Tamil/English) transcripts, auto-synthesizes multiple-choice quizzes for teacher approval, and presents live projector kiosk views for student participation.

## Positioning

Privacy-first, zero-retention edge classroom intelligence. Raw audio captured by classroom mic nodes is processed transiently in memory and permanently deleted immediately post-transcription, ensuring zero disk retention while enabling real-time automated quiz generation.

## Operating Context

Live physical and hybrid classroom lectures (Science labs, Physics/Chemistry labs, University lecture halls). Instructors monitor speech sync and approve AI-generated quizzes from their admin dashboard, while students participate via phone browser QR code kiosks.

## Capabilities and Constraints

- Edge microphone streaming via secure WebSockets (Raspberry Pi Zero 2 W nodes).
- Real-time bilingual speech-to-text (Tamil & English).
- Privacy Guard protocol: Zero raw audio disk storage; audio auto-deleted post-transcription.
- Teacher Review Gate: All generated quizzes require explicit teacher approval before live projector broadcasting.
- Projector Kiosk display with QR code join link (`classpulse.live/j/CP-8492`).
- Hardware fleet monitoring & class analytics (comprehension drop-off, topic mastery, leaderboard).

## Brand Commitments

Name: ClassPulse. Clean, human-centric, high-legibility Light Mode educational SaaS aesthetic (crisp white panels, soft slate borders `#e2e8f0`, dark slate typography `#0f172a`, indigo accents `#4f46e5`).

## Evidence on Hand

- React 19 + Vite 8 production scaffold in `src/`.
- Modular components: `Sidebar.jsx`, `Header.jsx`, `AudioVisualizer.jsx`, `LiveTranscript.jsx`, `QuizWorkbench.jsx`, `ProjectorKiosk.jsx`, `FleetManager.jsx`, `AnalyticsView.jsx`.
- Context provider in `ClassPulseContext.jsx`.

## Product Principles

1. **Privacy & Zero Retention First**: Never store raw classroom audio on disk; delete transient audio post-transcription.
2. **Teacher Gate of Control**: AI suggests, but teachers review and approve all content before student presentation.
3. **High Legibility & Low Friction**: Simple, spacious light-mode UI designed for quick scanability during active teaching.
4. **Instant Participation**: Students join live projector quizzes via QR code without account creation or app downloads.

## Accessibility & Inclusion

- High contrast text (`#0f172a` on `#ffffff` / `#f8fafc`).
- Bilingual support (Tamil & English) for inclusive learning environments.
