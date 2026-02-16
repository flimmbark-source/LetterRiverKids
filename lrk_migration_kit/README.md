# Letter River Kids Migration Kit

This kit extracts the **letter-learning mode** from your existing Letter River codebase and builds a new standalone repo scaffold.

## What this kit does

- Auto-detects likely letter-learning entry files
- Builds a dependency closure from that entry
- Copies relevant app scaffolding (`package.json`, Vite/Tailwind config, `public/`, etc.)
- Includes extra files likely needed for kids mode (settings, sound associations, accessibility, tts, achievements)
- Writes:
  - `MIGRATION_REPORT.md` (exact file list + hashes)
  - `KIDS_REFACTOR_TODO.md`

## 1) Extract the code

From your existing `HebrewLetterRiver` repo root:

```bash
# preview first
node /path/to/lrk_migration_kit/scripts/extract-kids-mode.mjs --src . --dry-run

# run actual extraction
node /path/to/lrk_migration_kit/scripts/extract-kids-mode.mjs --src . --out ../LetterRiverKids
```

If auto-detection picks the wrong entry, pass one explicitly:

```bash
node /path/to/lrk_migration_kit/scripts/extract-kids-mode.mjs \
  --src . \
  --entry src/views/LetterLearningView.jsx \
  --out ../LetterRiverKids
```

## 2) Run the extracted app

```bash
cd ../LetterRiverKids
npm install
npm run dev
```

## 3) Create GitHub repo (optional)

```bash
bash /path/to/lrk_migration_kit/scripts/create-github-repo.sh ../LetterRiverKids LetterRiverKids public
```

## 4) First refactor targets for Kids mode

- Make association mode default for pre-readers
- Replace text achievements with icon/audio rewards
- Add caregiver gate for settings
- Add big-tap UI and low-distraction visuals
- Add accessibility presets (motor/sensory/cognitive)

