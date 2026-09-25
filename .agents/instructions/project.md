# Project Overview

## What is Muzakit?

Muzakit is a Vue 3 + TypeScript monorepo (pnpm workspaces) that provides a shared UI component library and utilities for multiple applications.

## Workspace Structure

```
muzakit/
├── apps/
│   ├── muzakit-dashboard/                  # Main Vue 3 app (@muzakit/dashboard)
│   └── muzakit-starter-without-tailwind/   # Starter template
├── libs/
│   ├── config/     # @muzakit/config  — shared ESLint configuration
│   ├── ui/         # @muzakit/ui      — reusable Vue 3 component library
│   └── utils/      # @muzakit/utils   — shared utility functions
```

## Tech Stack

- **Framework**: Vue 3 (Composition API, `<script setup>`)
- **Language**: TypeScript
- **Build**: Vite
- **Package manager**: pnpm v10+ (workspaces)
- **Node**: v22+
- **Linting**: ESLint (shared config via `@muzakit/config`)
- **Git hooks**: Husky + commit-lint

## Package Naming

Internal packages use the `@muzakit/` scope. Always import from the package name, not relative paths across packages.

```ts
// correct
import { Button } from '@muzakit/ui'
import { formatDate } from '@muzakit/utils'

// wrong
import { Button } from '../../libs/ui/src/...'
```
