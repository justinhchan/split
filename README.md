# Split

Vibe-coded with Claude 🤖

Split a credit-card statement between people. Drop in a CSV, add the people you're splitting with, tag each transaction, and see who owes what.

Live demo: https://justinhchan.github.io/split/

## Features

- **CSV auto-detect**. Drop in a statement and Split figures out the date, description, and amount columns. Falls back to a column-mapper dialog when it's not sure.
- **Previous-statement payments are auto-excluded** so the math comes out right; small merchant refunds stay in the split.
- **Tagging**. Tag one or many people on a transaction from the row menu. Multi-select for bulk tag, exclude, delete, mark-as-payment from a floating action bar that shows the sum of the selected rows.
- **Even splits with no missing cent**. $10 across three people becomes $3.34 + $3.33 + $3.33, not three $3.33s that sum to $9.99.
- **Summary panel** with statement total, per-person owed, and a warning if anything doesn't reconcile or any rows are untagged.
- **Responsive**. Table layout on wide screens, sidebar drawer on narrow ones, stacked card list on phone-sized widths.
- **Light, dark, and system theme**.
- **Local persistence with a kill switch**. State saves to disk by default; turn off "Remember session" in settings and only the theme persists.

## Run it

```bash
npm install
npm run dev          # Electron + Vite HMR
npm test
npm run typecheck
npm run build
```

## Build for distribution

```bash
npm run build:mac
npm run build:win
npm run build:linux
```
