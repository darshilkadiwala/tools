# EMI Calculator

A local-first loan and EMI schedule manager built with React, TypeScript, and Vite. Track home, car, education, and personal loans with support for moratorium periods, tranche disbursements, prepayments, step-ups, and interest rate changes.

## Features

- Create and manage multiple loans with detailed configuration
- Generate EMI schedules with moratorium, adjustment, and disbursement rows
- Apply prepayments, step-ups, and interest rate modifications
- Export schedules to CSV
- Dark/light themes with customizable color palettes
- All data stored locally in the browser via IndexedDB (Dexie)

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** (rolldown-vite)
- **React Router** for navigation
- **Dexie** for IndexedDB persistence
- **shadcn/ui** + **Tailwind CSS 4** for UI
- **React Hook Form** + **Zod** for forms
- **Vitest** for testing

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+ (see `.nvmrc`)
- [pnpm](https://pnpm.io/)

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Preview production build

```bash
pnpm preview
```

### Lint

```bash
pnpm lint
```

### Test

```bash
pnpm test
```

Watch mode:

```bash
pnpm test:watch
```

## Project Structure

```
src/
├── pages/           # Route-level screens
├── routes.tsx       # Lazy-loaded route definitions
├── components/
│   ├── loan/        # Loan domain UI
│   ├── emi/         # EMI schedule UI
│   ├── modifications/  # Prepayment and step-up dialogs
│   ├── layout/      # App shell (sidebar, layout, error boundary)
│   └── ui/          # shadcn primitives
├── hooks/           # Reusable stateful logic
├── contexts/        # React context providers
├── lib/             # Business logic, persistence, utilities
├── types/           # Shared domain types
└── config/          # App configuration
```

## Data Storage

Loan data, EMI schedules, and modifications are persisted in the browser using IndexedDB via Dexie. No server or account is required — data stays on your device.

## License

Private project.
