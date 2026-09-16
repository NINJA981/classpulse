# ClasePulse — Teacher Portal (`SIH-teacher`)

Modern educator workflow and lesson synthesis portal built with **Next.js 15 (App Router)**, **React 19**, and **TypeScript**.

---

## 🚀 Overview

The ClassPulse Teacher Portal empowers educators with:
- **Audio & Multimodal Lesson Ingestion**: Record classroom audio directly (`components/AudioRecorder.tsx`) or import study materials (`components/SourcePicker.tsx`).
- **Automated Lesson Processing & Synthesis**: Generate synthesized lecture summaries, key concepts, and structured study guides (`app/lessons/new`, `app/lessons/[id]`).
- **Interactive Question Generation & Review**: Review, edit, and fine-tune AI-generated questions and assignments with difficulty scaling (`app/lessons/[id]/review`).
- **Teacher Workspace & Dashboard**: Manage classes, review analytics, and monitor section readiness (`app/lessons`, `components/HeaderNav.tsx`).

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Library**: React 19 / TypeScript
- **Styling**: Vanilla CSS / Responsive Layout (`app/globals.css`)
- **API Client**: Strongly-typed lesson API (`lib/api.ts`, `types/index.ts`)

---

## 💻 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production
```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
SIH-teacher/
├── app/                  # Next.js App Router routes & pages
│   ├── lessons/          # Lesson listing, creation, and review
│   │   ├── [id]/         # Lesson details and review pages
│   │   └── new/          # New lesson audio & source ingestion
│   ├── globals.css       # Global styles & layout rules
│   ├── layout.tsx        # Root layout with HeaderNav
│   └── page.tsx          # Landing redirect to /lessons
├── components/           # Core UI components (AudioRecorder, SourcePicker, HeaderNav)
├── lib/                  # Application API client and mock data layer
├── types/                # TypeScript interfaces and domain models
├── public/               # Static assets & SVG icons
├── src/                  # Legacy screen references and modular components
├── next.config.mjs       # Next.js configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Project dependencies & scripts
```
