# docs/agents — the source of truth

These docs describe the system for agents and developers, and `docs/humans` builds the human-facing decks and PDFs from them. Find the right file below, then read only the section you need: `Grep "^## " <file>` gives the headings with line numbers, then Read with `offset`/`limit`.

| File (lines) | Use it for |
|---|---|
| `conventions.md` (63) | Coding rules for api and web. Read the relevant half before editing code |
| `architecture.md` (132) | Components, key flows, security model, scaling |
| `api.md` (491) | Every route. Sections: Auth, Admin, Teacher, Student, Notifications, Devices, Platform, Test helpers |
| `database.md` (151) | Tables and DB conventions. `database-schema.html` is generated (`scripts/build-schema-html.mjs`); don't read it |
| `deployment.md` (433) | Sections: First deployment, Updating, Backups, Operations, Object storage (Garage), Email, Platform console, Deploying on Coolify, Security settings |
| `classroom-agent.md` (138), `hardware-raspberry-pi.md` (113) | Pi agent install, config, troubleshooting |
| `pilot-runbook.md` (82) | Running the live pilot, load test |
| `compliance/*.md` | DPDP: retention, sub-processors, parental consent, breach runbook, DPA template |
| `research/local-models-rnd.md` (1053), `research/stt-benchmark-2026-10-12.md` (570) | Self-hosted model R&D and the STT benchmark. Read by section |
| `HANDBOOK.md` (1642) | The owner's complete guide. **Never read it whole.** |

## HANDBOOK sections (`## N.`)

1 What ClassIQ is (1.4: status, accounts, kept `classpulse` names) · 2 Big picture · 3 Tech stack · 4 Repo tour · 5 Schools, users, roles, sign-in · 6 Every feature, page by page · 7 Lesson statuses · 8 AI pipeline · 9 Live quiz engine · 10 Pi recorder · 11 Database · 12 API · 13 Security and privacy · 14 Deployment and infrastructure · 15 Day-to-day operations · 16 Running locally · 17 Testing · 18 History and decisions · 19 Known limitations · 20 FAQ · 21 Glossary · 22 Quick reference card

## Rules

- `README.md` is a copy of the root `README.md`: edit the root one, then re-copy.
- When behaviour changes, update the matching doc in the same PR. `docs/humans` rebuilds from these files.
- `security-audit-*.md` is private: never commit it.
