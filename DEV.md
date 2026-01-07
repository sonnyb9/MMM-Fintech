# Development Workflow (Windows â†’ GitHub â†’ Raspberry Pi)

This project is developed on Windows and tested on Windows, then deployed to a Raspberry Pi running MagicMirrorÂ².

## Goals

- Windows laptop is the single source of truth.
- Changes are delivered as small, reviewable diffs (one step per commit).
- Raspberry Pi is used only for runtime validation (pull + restart).
- Keep secrets and machine-local state out of git.

## Repo Paths

- Windows: `C:\Users\asonn\dev\MMM-Fintech`
- Raspberry Pi: `~/MagicMirror/modules/MMM-Fintech`

## Patch-Based Development (Windows)

### 1) Create a feature branch

```powershell
cd C:\Users\asonn\dev\MMM-Fintech
git checkout -b feature/snaptrade
```

### 2) Apply an incoming patch

```powershell
git apply --check .\patches\0001-some-change.patch
git apply .\patches\0001-some-change.patch
```

### 3) Commit and push

```powershell
git status
git add -A
git commit -m "chore(dev): apply step"
git push -u origin feature/snaptrade
```

## Testing on Raspberry Pi (pull â†’ restart â†’ logs)

```bash
cd ~/MagicMirror/modules/MMM-Fintech
git pull
pm2 restart magicmirror --update-env
pm2 logs magicmirror
```

If `package.json` / `package-lock.json` changed:

```bash
npm install
pm2 restart magicmirror --update-env
```

## Secrets and Local State (must NOT be committed)

These files are intentionally machine-local and should remain gitignored:

- `manual-holdings.json`
- `cdp-credentials.enc`
- `twelvedata-credentials.enc`
- `cache.json`
- `~/.mmm-fintech-key`

## Patches Folder Convention

Store patch files in:

- `./patches/`

Naming convention:

- `0001-add-dev-md.patch`
- `0002-patch-workflow-hygiene.patch`
- `0003-snaptrade-skeleton.patch`

## Patch Hygiene

- Prefer Git to generate patch files (avoid PowerShell encoding issues).
- Validate before applying: `git apply --check`.
- Notepad++ (if used): UTF-8 (no BOM) + Unix (LF).

## Create Patch Files (Windows PowerShell)

```powershell
git diff --staged --no-color --output=patches\000X-some-step.patch
```

Validate a patch against already-staged changes:

```powershell
git apply --check --reverse .\patches\000X-some-step.patch
```

## Runtime Baseline (Pi)

- Node: v22.21.0
- pm2: v6.0.8
