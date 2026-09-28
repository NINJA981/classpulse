# ClasePulse — Student Portal (`SIH-student`)

Modern, interactive student learning portal built with **Next.js 15 (App Router)**, **React 19**, and **Tailwind CSS**.

---

## 🚀 Overview

The ClassPulse Student Portal provides an engaging learning workspace featuring:
- **Diagnostic Testing & Onboarding**: Adaptive student assessment flows (`/diagnostic`, `/join`, `/login`).
- **Interactive Quizzes**: Live multiplayer quiz lobbies, countdowns, question engines, and real-time leaderboards (`/quizzes`, `/quizzes/[id]/live`, `/quizzes/[id]/leaderboard`).
- **Coursework & Assignments**: Track assignments, tests, and academic progress (`/assignments`, `/tests`).
- **Student Profile & Guardian View**: Comprehensive performance metrics and guardian transparency (`/profile`, `/guardians`).

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Library**: React 19 / TypeScript
- **Styling**: Tailwind CSS / PostCSS
- **Database / Backend**: Supabase integration (`lib/supabase.ts`)
- **Icons / UI**: Lucide React

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
SIH-student/
├── app/                  # Next.js App Router routes & pages
│   ├── assignments/      # Student assignments view
│   ├── diagnostic/       # Diagnostic assessment flow
│   ├── guardians/        # Guardian & parent portal
│   ├── join/             # Class joining & onboarding
│   ├── login/            # Student authentication
│   ├── profile/          # Student profile & stats
│   ├── quizzes/          # Live quiz lobby, gameplay & leaderboard
│   ├── tests/            # Test schedule & history
│   ├── globals.css       # Global styles & theme tokens
│   └── layout.tsx        # Root layout with typography
├── components/           # Reusable UI components (DashboardShell, etc.)
├── lib/                  # API clients and utilities (Supabase, diagnosticApi)
├── public/               # Static assets & SVG icons
├── next.config.ts        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Project dependencies & scripts
```
