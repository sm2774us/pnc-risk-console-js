# ADR 0008: ES2025 JavaScript source with an `ng-js` build bridge

- Status: Accepted
- Context: This repository is a behaviour-identical JavaScript port of `pnc-risk-console-ts`. Angular's compiler (ngtsc) does compile decorated `.js` files, but the code it generates carries TypeScript annotations that TypeScript only erases for `.ts` inputs, and `@angular/build` loads the result as plain JS, so a build from `.js` fails to parse.
- Decision: All source is plain JavaScript (native class fields, ES2025 syntax, ES decorators for Angular, `tslib` helpers for the NestJS legacy decorators). `tools/ng-mirror.mjs` copies the Angular-facing `.js` files to a git-ignored `ng-js/` tree as `.ts`, line for line, byte-identical (so line numbers match) and compiled with `noCheck`, and writes tsconfigs pointing at it. Nx targets `build`, `serve` and `test` depend on `ng-prep`; `npm run dev` runs `ng-watch`.
- Consequences: Same bundles, tests, workflows and behaviour as the TS repo. Types are no longer compiler-checked: correctness rests on tests, ESLint, and `typecheck` (syntax and module resolution). Template type checking is `basic`, not strict. Never edit `ng-js/`.
- Not used: JIT builds (needs the compiler in the browser and breaks signal inputs), patching `@angular/build`.
