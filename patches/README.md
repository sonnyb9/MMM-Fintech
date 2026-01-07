# Patches

This folder is the standard place to store patch files during development.

## Naming convention

- `0001-add-dev-md.patch`
- `0002-patch-workflow-hygiene.patch`

## Apply patches

```powershell
git apply --check .\patches\000X-some-step.patch
git apply .\patches\000X-some-step.patch
```

## Create patches (recommended)

```powershell
git diff --staged --no-color --output=patches\000X-some-step.patch
```

## Validate patches created from staged changes

```powershell
git apply --check --reverse .\patches\000X-some-step.patch
```
