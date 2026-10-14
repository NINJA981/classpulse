# ClassIQ documentation

The docs are in two parts. They hold the same facts, written for different readers.

| Folder | For | What's in it |
|---|---|---|
| [`agents/`](agents/) | Coding agents and engineers working in the repo | Plain Markdown, the source of truth. [HANDBOOK](agents/HANDBOOK.md), [architecture](agents/architecture.md), [API](agents/api.md), [database](agents/database.md), [deployment](agents/deployment.md), [conventions](agents/conventions.md), [Pi hardware](agents/hardware-raspberry-pi.md), [pilot runbook](agents/pilot-runbook.md), [classroom agent](agents/classroom-agent.md), [web notes](agents/web-agents.md), [research](agents/research/) and [compliance drafts](agents/compliance/) |
| [`humans/`](humans/) | Schools, teachers, students, investors and operators | Interactive pages, slide decks and PDFs built from `agents/` around real screenshots of the app. Open [`humans/web/index.html`](humans/web/index.html) |

Edit the Markdown in `agents/` and rebuild `humans/`; never edit the generated files. The build and the screenshot capture are described in [`humans/README.md`](humans/README.md) and [`humans/_build/capture/README.md`](humans/_build/capture/README.md).

## What's in `humans/`

Every page in `humans/web/` is a single self-contained HTML file. It opens from disk and works offline.

| | Interactive (`humans/web/`) | Files |
|---|---|---|
| **Pitch** | Investor and school decks with presenter view and notes | `pitch/`: PPTX, PDF, speaker notes |
| **Schools** | Brochure, one-pager, FAQ | `pdf/` |
| **Role guides** | Click-through tours for teacher, admin, student and platform console; training decks; quick cards | `slides/`, `pdf/` |
| **Technical and operations** | Handbook, architecture, API, database, security and privacy, deployment, ops cheatsheet, Pi setup, pilot runbook and more, with search and diagrams | `pdf/`; architecture and pilot decks in `slides/` |
| **Research** | STT benchmark, local-models R&D, AI pipeline explainer, research deck | `pdf/`, `slides/` |

Not published: `agents/security-audit-*.md` is private, and the build refuses it and the compliance drafts.
