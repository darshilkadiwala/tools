# Naming Conventions

Project-wide naming standards for files, folders, and exports.

## Folders

- Use **lowercase kebab-case** for all feature and domain folders
  - Good: `interest-rate/`, `emi/`, `loan/`
  - Bad: `InterestRate/`, `EMI/`

## Files

### React components

- Use **PascalCase** for component files: `LoanForm.tsx`, `EMISchedule.tsx`

### Hooks

- Use **camelCase** with `use` prefix: `useMobile.ts`, `useFormField.ts`, `useLoans.ts`
- Bad: `use-mobile.ts`, `use-form-field.ts`

### Utilities, schemas, and lib modules

- Use **kebab-case** or **camelCase** consistently within a folder
- Prefer kebab-case for multi-word non-component files: `loan-form-schema.ts`, `db-operations.ts`

### UI primitives (shadcn)

- Follow shadcn defaults: kebab-case files in `components/ui/` (`dropdown-menu.tsx`)

## Exports

- Component exports: **PascalCase** (`export function LoanForm`)
- Hook exports: **camelCase** with `use` prefix (`export function useLoans`)
- Utility exports: **camelCase** (`export function formatCurrency`)

## Imports

- Always use the `@/` path alias for `src/` imports
- Avoid relative imports that traverse more than one level when an alias is available

## Branches

- `refactor/<scope>` — structural or internal improvements
- `feat/<scope>` — new features
- `fix/<scope>` — bug fixes
- `chore/<scope>` — tooling and housekeeping
- `test/<scope>` — test additions
