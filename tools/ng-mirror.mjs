#!/usr/bin/env node
// Angular's AOT compiler (ngtsc) cannot emit valid code for `.js` sources: the code it generates carries
// TypeScript annotations that are only erased for `.ts` inputs. Source of truth stays JavaScript; this
// bridge mirrors the Angular-facing `.js` files to a git-ignored `ng-js/` tree as `.ts` (valid, since JS is
// a subset of what ngtsc parses) and writes tsconfigs that point at the mirror.
//   node tools/ng-mirror.mjs           one-shot (used as the `ng-prep` Nx target)
//   node tools/ng-mirror.mjs --watch   keep the mirror in sync during `npm run dev`
import { mkdirSync, readdirSync, readFileSync, rmSync, watch, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OUT = 'ng-js';
const ROOTS = [
  'apps/risk-console/src',
  'libs/shared/ui/src',
  'libs/risk/data-access/src',
  'libs/risk/feature-dashboard/src',
  'libs/risk/feature-exposure/src',
  'libs/risk/feature-accumulation/src',
  'libs/risk/feature-policy/src',
];

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : [],
  );
const target = (f) => join(OUT, f.replace(/\.js$/, '.ts'));

function mirrorFile(f) {
  const t = target(f);
  mkdirSync(dirname(t), { recursive: true });
  const src = readFileSync(f, 'utf8'); // byte-identical: mirror line numbers match the .js original
  try {
    if (readFileSync(t, 'utf8') === src) return;
  } catch {
    /* new file */
  }
  writeFileSync(t, src);
}

export function sync() {
  rmSync(OUT, { recursive: true, force: true });
  for (const root of ROOTS) for (const f of files(root)) mirrorFile(f);
  const base = JSON.parse(readFileSync('tsconfig.base.json', 'utf8'));
  const paths = Object.fromEntries(
    Object.entries(base.compilerOptions.paths).map(([k, v]) => [
      k,
      v.map((p) =>
        ROOTS.some((r) => p.replace('./', '').startsWith(r.replace(/\/src$/, '/')))
          ? `./${p.replace('./', '').replace(/\.js$/, '.ts')}`
          : `../${p.replace('./', '')}`,
      ),
    ]),
  );
  // JS is not type-checked (no annotations to check against): the mirror compiles with lenient typing.
  const lenient = {
    noCheck: true,
    strict: false,
    noImplicitAny: false,
    strictNullChecks: false,
    noImplicitReturns: false,
    noImplicitOverride: false,
    noUncheckedIndexedAccess: false,
    noFallthroughCasesInSwitch: false,
  };
  const co = { ...base.compilerOptions, ...lenient, lib: ['ES2025', 'dom', 'dom.iterable'], paths, rootDir: '..' };
  const ng = { strictTemplates: false, strictInjectionParameters: true, strictInputAccessModifiers: true };
  writeFileSync(join(OUT, 'tsconfig.base.json'), JSON.stringify({ compilerOptions: co }, null, 2));
  writeFileSync(
    join(OUT, 'tsconfig.app.json'),
    JSON.stringify(
      {
        extends: './tsconfig.base.json',
        compilerOptions: { types: [], outDir: '../dist/out-tsc' },
        angularCompilerOptions: ng,
        files: ['apps/risk-console/src/main.ts'],
        include: ['**/*.ts'],
        exclude: ['**/*.spec.ts'],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(OUT, 'tsconfig.spec.json'),
    JSON.stringify(
      {
        extends: './tsconfig.base.json',
        compilerOptions: { types: [] },
        angularCompilerOptions: { strictTemplates: false },
        include: ['**/*.ts'],
      },
      null,
      2,
    ),
  );
  console.log(`ng-mirror: ${ROOTS.reduce((n, r) => n + files(r).length, 0)} files -> ${OUT}/`);
}

sync();
if (process.argv.includes('--watch')) {
  for (const root of ROOTS) {
    watch(root, { recursive: true }, (_e, name) => {
      if (name?.endsWith('.js')) {
        try {
          mirrorFile(join(root, name));
        } catch {
          rmSync(target(join(root, name)), { force: true });
        }
      }
    });
  }
  console.log('ng-mirror: watching for changes');
}
