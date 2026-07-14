# ADR-001 Code Style

Status: Accepted

## Context

NetWatch membutuhkan standar format, lint, dan test yang konsisten sebelum fitur monitoring dibangun.

## Decision

- Gunakan ESLint flat config dari root workspace.
- Gunakan Prettier untuk formatting.
- Backend memakai Node test runner untuk test endpoint.
- Frontend memakai Vitest untuk test komponen React.
- Script kualitas dijalankan dari root memakai pnpm workspace.

## Consequences

- Task berikutnya wajib menjaga `pnpm lint`, `pnpm format:check`, `pnpm test`, dan `pnpm build` tetap hijau.
- Aturan yang lebih spesifik dapat ditambahkan saat kompleksitas fitur meningkat.
