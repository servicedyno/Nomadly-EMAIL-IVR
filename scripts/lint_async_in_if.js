#!/usr/bin/env node
/**
 * lint:await — flags `if (asyncFn(...))` (without `await`) in conditional
 * contexts (if/while/ternary/&&/||).
 *
 * Catches the exact class of bug fixed in voice-service.js where
 * `if (handleIvrTransferLegInitiated(payload)) break` always took the
 * branch because the unawaited Promise was truthy.
 *
 * Strategy:
 *   1. Parse each .js file under js/ with acorn (loose-friendly).
 *   2. Walk the AST, building two sets of async function "signatures":
 *        - bareNames: 'foo' (when declared as `async function foo`, `const foo = async ...`)
 *        - qualifiedNames: 'goto.foo' / 'this.foo' / 'obj.foo'
 *           (when declared as object/class member or assigned to a member)
 *   3. Walk again — for every conditional test (IfStatement, ConditionalExpression,
 *      LogicalExpression, etc.), inspect any non-awaited CallExpression and check
 *      if the callee resolves to a known async function.
 *
 *      To minimise false positives:
 *        - For `obj.foo()`, look up qualified `obj.foo` FIRST.
 *          If qualified is found → flag. Otherwise: do NOT flag (different ns).
 *        - For bare `foo()`, look up bare `foo`. If bare match exists, flag.
 *
 * Exit 1 on findings, 0 otherwise.
 */

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const explicitArgs = process.argv.slice(2);
const ROOT = '/app';
const DEFAULT_TARGETS = ['js'];
const targets = explicitArgs.length ? explicitArgs : DEFAULT_TARGETS;

function walk(p, out = []) {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    const base = path.basename(p);
    if (/(node_modules|\.git|coverage|dist|build|lang)$/i.test(base)) return out; // skip lang/ — they are pure data
    for (const ent of fs.readdirSync(p)) walk(path.join(p, ent), out);
  } else if (stat.isFile() && p.endsWith('.js')) {
    out.push(p);
  }
  return out;
}

const files = [];
for (const t of targets) {
  const full = path.isAbsolute(t) ? t : path.join(ROOT, t);
  if (!fs.existsSync(full)) continue;
  walk(full, files);
}

let totalFindings = 0;

function parse(code) {
  const baseOpts = {
    ecmaVersion: 'latest',
    locations: true,
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: true,
    allowHashBang: true,
  };
  try { return acorn.parse(code, { ...baseOpts, sourceType: 'script' }); }
  catch { try { return acorn.parse(code, { ...baseOpts, sourceType: 'module' }); }
  catch (e) { throw e; } }
}

function memberPath(node) {
  // Convert MemberExpression chain into 'a.b.c'. Returns null if computed/non-id.
  const parts = [];
  let cur = node;
  while (cur && cur.type === 'MemberExpression') {
    if (cur.computed) return null;
    if (!cur.property || cur.property.type !== 'Identifier') return null;
    parts.unshift(cur.property.name);
    cur = cur.object;
  }
  if (cur && cur.type === 'Identifier') {
    parts.unshift(cur.name);
    return parts.join('.');
  }
  if (cur && cur.type === 'ThisExpression') {
    parts.unshift('this');
    return parts.join('.');
  }
  return null;
}

function bareName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier') return callee.property.name;
  return null;
}

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = parse(code); }
  catch (e) {
    console.error(`[lint:await] Skipping ${file}: parse error: ${e.message}`);
    continue;
  }

  // ── Collect async functions ──
  const bareNames = new Set();
  const qualifiedNames = new Set();

  function collect(node, ctx) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) collect(n, ctx); return; }
    if (typeof node.type !== 'string') return;

    // async function foo() {}
    if (node.type === 'FunctionDeclaration' && node.async && node.id?.name) {
      bareNames.add(node.id.name);
    }
    // const foo = async ...
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.init) {
      const r = node.init;
      if ((r.type === 'ArrowFunctionExpression' || r.type === 'FunctionExpression') && r.async) {
        bareNames.add(node.id.name);
      }
    }
    // foo = async ... | obj.foo = async ...
    if (node.type === 'AssignmentExpression' && node.operator === '=' && node.right) {
      const r = node.right;
      if ((r.type === 'ArrowFunctionExpression' || r.type === 'FunctionExpression') && r.async) {
        if (node.left.type === 'Identifier') bareNames.add(node.left.name);
        if (node.left.type === 'MemberExpression') {
          const mp = memberPath(node.left);
          if (mp) qualifiedNames.add(mp);
          if (node.left.property?.name) {
            // bare-name fallback only if no other namespace owns it
            // We add it but also keep qualified
            // To minimise false positives, we DO NOT add to bareNames automatically here.
          }
        }
      }
    }
    // Object property: { foo: async ... } → qualified within parent object literal context only;
    // for our purposes, treat as a possible callable when called as `parent.foo`. That requires
    // knowing the parent var. Easier heuristic: if the property is a method shorthand inside an
    // ObjectExpression bound to a var (e.g., `const goto = { foo: async ... }`), capture
    // `varname.foo`. We do this in the VariableDeclarator handler below.
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.init?.type === 'ObjectExpression') {
      const objName = node.id.name;
      for (const prop of node.init.properties || []) {
        if (prop.type !== 'Property') continue;
        const v = prop.value;
        if (!v) continue;
        if ((v.type === 'ArrowFunctionExpression' || v.type === 'FunctionExpression') && v.async) {
          if (prop.key.type === 'Identifier') qualifiedNames.add(`${objName}.${prop.key.name}`);
          if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') qualifiedNames.add(`${objName}.${prop.key.value}`);
        }
      }
    }
    // class { async foo() {} }
    if (node.type === 'MethodDefinition' && node.value?.async) {
      if (node.key?.type === 'Identifier') {
        qualifiedNames.add(`this.${node.key.name}`);
        bareNames.add(node.key.name); // also bare so unqualified `foo()` inside class flags
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
      const c = node[key];
      if (c && typeof c === 'object') collect(c, node);
    }
  }
  collect(ast, null);

  // ── Walk conditional contexts ──
  const findings = [];

  function checkCall(node, contextTag) {
    if (!node || node.type !== 'CallExpression') return;
    const callee = node.callee;
    const qual = callee.type === 'MemberExpression' ? memberPath(callee) : null;
    const bare = bareName(callee);
    let matched = false, matchedAs = '';

    if (qual && qualifiedNames.has(qual)) {
      matched = true; matchedAs = qual;
    } else if (callee.type === 'Identifier' && bare && bareNames.has(bare)) {
      matched = true; matchedAs = bare;
    }
    // Note: if call is `obj.foo(...)` but qualified `obj.foo` is NOT in our set,
    // we deliberately skip even if `foo` is a bare-name match elsewhere
    // — different namespaces, almost always a different function.

    if (matched) {
      findings.push({
        line: node.loc?.start?.line ?? 0,
        col: (node.loc?.start?.column ?? 0) + 1,
        name: matchedAs,
        contextTag,
        snippet: code.slice(Math.max(0, node.start - 3), Math.min(code.length, node.end + 50)).split('\n')[0],
      });
    }
  }

  function checkCondition(node, contextTag) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) checkCondition(n, contextTag); return; }
    if (typeof node.type !== 'string') return;

    if (node.type === 'AwaitExpression') return; // safe — explicitly awaited
    if (node.type === 'CallExpression') { checkCall(node, contextTag); return; }

    if (node.type === 'LogicalExpression' || node.type === 'BinaryExpression' || node.type === 'UnaryExpression') {
      if (node.left) checkCondition(node.left, contextTag);
      if (node.right) checkCondition(node.right, contextTag);
      if (node.argument) checkCondition(node.argument, contextTag);
      return;
    }
    if (node.type === 'ConditionalExpression') {
      if (node.test) checkCondition(node.test, contextTag);
      // consequent / alternate are branch bodies — not part of the "test"
      return;
    }
    if (node.type === 'ParenthesizedExpression' || node.type === 'SequenceExpression') {
      // SequenceExpression: only the LAST expression is the value
      if (node.type === 'SequenceExpression' && Array.isArray(node.expressions)) {
        for (const ex of node.expressions) checkCondition(ex, contextTag);
      } else if (node.expression) {
        checkCondition(node.expression, contextTag);
      }
      return;
    }
    // For other expression types, walk children
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
      const c = node[key];
      if (c && typeof c === 'object') checkCondition(c, contextTag);
    }
  }

  function visitTopLevel(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) visitTopLevel(n); return; }
    if (typeof node.type !== 'string') return;

    if (node.type === 'IfStatement' && node.test) checkCondition(node.test, 'if');
    if (node.type === 'ConditionalExpression' && node.test) checkCondition(node.test, 'ternary');
    if (node.type === 'WhileStatement' && node.test) checkCondition(node.test, 'while');
    if (node.type === 'DoWhileStatement' && node.test) checkCondition(node.test, 'do-while');

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
      const c = node[key];
      if (c && typeof c === 'object') visitTopLevel(c);
    }
  }
  visitTopLevel(ast);

  if (findings.length) {
    const rel = path.relative(ROOT, file);
    for (const f of findings) {
      console.log(`${rel}:${f.line}:${f.col}  [no-async-in-condition]  '${f.name}' is async; needs \`await\` in ${f.contextTag} test`);
      console.log(`    ${f.snippet.trim()}`);
    }
    totalFindings += findings.length;
  }
}

if (totalFindings) {
  console.log(`\n[lint:await] ${totalFindings} issue(s) found. Add \`await\` or stop calling async function in condition.`);
  process.exit(1);
} else {
  console.log(`[lint:await] OK — checked ${files.length} file(s); no unawaited async calls in conditions.`);
  process.exit(0);
}
