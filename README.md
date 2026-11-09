# Student Assessment Comment Generator

A privacy-focused, browser-based application designed for secondary and tertiary educators to generate structured, personalized student assessment feedback using deterministic section-prioritized matching.

---

## Overview

The Comment Generator runs entirely client-side with zero server processes, background workers, or external API dependencies. All student grade data and comment libraries remain strictly within the local browser runtime and persist using browser local storage.

The repository is pre-configured for static hosting on **GitHub Pages** or direct local usage simply by opening `index.html`.

---

## Key Features

- **Heuristic Gradebook Parser**: Automatically locates student roster rows, question columns, and maximum mark allocations across messy or offset spreadsheets (e.g. tables starting at cell `C4`).
- **Drag-and-Drop Section Mapping**: Organise questions into distinct assessment sections (e.g. *Multiple Choice Questions*, *Short Answer*, *Extended Response*) with real-time drag-and-drop reordering.
- **Deterministic Section Priority Ranking**: Specify an explicit priority hierarchy (e.g. `SAQ > MCQ > General`) to dictate how comments are selected for each student.
  - Priority sections are matched first.
  - Lower-priority sections are evaluated only when higher-priority criteria are exhausted.
  - General comments function strictly as a fallback.
- **Section-Isolated Comment Banks**: Comments scoped to a specific section will never bleed into or evaluate questions from unrelated sections.
- **Subquestion and Range Parsing**: Recognises single questions (`Q1`), comma-separated lists (`Q1, 2, 4`), subquestion sequences (`7a, b`), and range expressions (`1-4`, `7a-c`).
- **Semantic Anti-Redundancy**: Deduplicates overlapping keywords across candidate comments to prevent contradictory or repetitive statements.
- **Export Options**: Export finalized student comments directly to Microsoft Excel (`.xlsx`) or copy individual student remarks with one click.
- **Australian Teacher Stationery Aesthetic**: Styled with a warm, legible tactile palette inspired by classic gradebooks and stationery, featuring complete Light and Dark mode support.

---

## Deployment & Usage

### Running Locally
Open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari).

### Deploying to GitHub Pages
1. Push this repository to GitHub.
2. In the repository settings, navigate to **Pages**.
3. Under **Build and deployment**, select **Source: Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder, then save.
5. The application will be immediately live and fully functional on your GitHub Pages URL with zero server setup required.

---

## Offline Python CLI & Test Suite

A standalone Python CLI is included for headless batch processing and test verification.

### Running the Test Suite
```bash
python -m pytest
```

### Running the Headless CLI
```bash
python cli.py --gradebook "sample_grades_offset.csv" --bank "Comment_Bank.json" --ranking "SAQ,MCQ,General" --output "comments.json"
```

---

## Architecture

- **UI & Presentation**: Single-page application written in semantic HTML5, CSS3 with CSS custom properties, and native SVG icons (`index.html`, `styles.css`, `app.js`).
- **Spreadsheet Parsing**: SheetJS (`vendor/xlsx.full.min.js`) wrapped by `js/excel-parser.js`.
- **Comment Bank Management**: `js/comment-bank.js`.
- **Deterministic Matching Engine**: `js/comment-engine.js`.
- **Local Persistence**: `js/storage-service.js` using browser `localStorage` with JSON export and import capabilities.
