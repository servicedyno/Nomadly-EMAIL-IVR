#!/usr/bin/env node
// One-shot patcher: add a no-op comment inside every empty block in
// /app/js/_index.js so ESLint stops complaining. Idempotent.
// We DO NOT change behaviour, only add a comment between the braces.
'use strict'
const fs = require('fs')
const path = '/app/js/_index.js'
const lines = fs.readFileSync(path, 'utf8').split('\n')

const REPORTED = [
  1261, 1856, 2294, 2315,
  4077, 4093, 4105, 4113, 4192, 4250, 4264,
  4841, 5031, 5079, 5092, 5098,
  5934, 6479,
  10562, 11753,
  12726, 12792, 12925, 13062, 13194, 13308, 13314, 13515,
  16824, 17667,
  23405, 23941,
  24213, 24339, 24935, 24952, 24978, 24999,
  26741, 26761, 26866,
  27036, 27119, 27650, 27667, 27683,
  28022,
  29720, 29845,
  30588,
  34256,
  36757, 37078,
]

let patched = 0
const NOOP = '{ /* noop */ }'   // safe inline replacement for `{}`
for (const L of REPORTED) {
  const idx = L - 1
  const original = lines[idx]
  if (original == null) continue
  // Replace empty brace pair `{...whitespace-only...}` with `{ /* noop */ }`.
  const fixed = original.replace(/\{\s*\}/g, NOOP)
  if (fixed !== original) {
    lines[idx] = fixed
    patched++
  }
}

console.log('Patched ' + patched + '/' + REPORTED.length + ' empty-block sites')
fs.writeFileSync(path, lines.join('\n'), 'utf8')
console.log('Wrote ' + path)
