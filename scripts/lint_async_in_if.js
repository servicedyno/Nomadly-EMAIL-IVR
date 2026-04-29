#!/usr/bin/env node
/**
 * lint:await — flags two classes of unawaited-async bugs.
 *
 * PATTERN A — async fn called directly inside a conditional (no `await`):
 *   if (asyncFn(payload)) break               // ← always truthy → bug
 *   while (cond && asyncFn()) ...             // ← same
 *   asyncFn() ? a : b                          // ← same (ternary)
 *
 *   Catches the exact bug fixed in voice-service.js where
 *   `if (handleIvrTransferLegInitiated(payload)) break` always took the
 *   branch because the unawaited Promise was truthy.
 *
 * PATTERN B — variable assigned to async fn result, then used as a value
 * (no `await`, no `.then/.catch/.finally`, no Promise.all wrapper):
 *   const user = fetchUser()                   // ← Promise, not awaited
 *   if (user) { ... }                          // ← always truthy → bug
 *   if (!user) return                          // ← always false → bug
 *   user ? 'a' : 'b'                            // ← always 'a' → bug
 *   user && doThing()                          // ← always truthy → bug
 *
 * Strategy:
 *   1. Parse each .js file under js/ with acorn.
 *   2. Collect async functions:
 *        - bareNames: 'foo' (when declared as `async function foo`, `const foo = async ...`)
 *        - qualifiedNames: 'goto.foo' / 'this.foo' / 'obj.foo'
 *   3. PATTERN A — walk every conditional test (if/while/ternary/&&/||) and
 *      flag any non-awaited CallExpression whose callee resolves to an async fn.
 *   4. PATTERN B — collect candidate variables (`const x = asyncFn()` without
 *      await/then chain), then walk the AST tracking lexical scope. A use of
 *      such a variable in a truthy/value context (if/while/ternary/!/&&/||)
 *      is a bug. Other uses (await x, x.then/.catch, return x, fn(x), etc.)
 *      are neutral or safe and produce no warning.
 *
 * To minimise false positives:
 *   - Pattern A: namespace-aware (obj.foo is checked against qualified set first).
 *   - Pattern B: scope-aware — `user` declared in fn1 is independent from
 *     `user` declared in fn2.
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

  // ── Pattern B: floating-Promise variable that's later used as a value ──
  // Catches `const x = asyncFn()` (without await/then/catch) where x is later
  // used in a truthy/value context like `if (x)`, `!x`, `x === foo`, etc.
  //
  // Promise-aware uses are SAFE and do NOT flag:
  //   - await x                                  (awaited)
  //   - Promise.all([..., x, ...])               (parallel)
  //   - Promise.race([...]) / allSettled / any   (parallel)
  //   - x.then(...) / x.catch(...) / x.finally() (chained)
  //   - return x                                  (caller awaits)
  //   - throw x                                   (caller handles)
  //   - void x                                    (explicit fire-and-forget)
  //
  // Step 1: collect candidate variables (`const x = asyncCall()` without chain/await).
  // Step 2: walk full AST tracking each use of those vars; classify as Promise-aware vs misuse.

  function isAsyncCall(callNode) {
    if (!callNode || callNode.type !== 'CallExpression') return false;
    const callee = callNode.callee;
    const qual = callee.type === 'MemberExpression' ? memberPath(callee) : null;
    if (qual && qualifiedNames.has(qual)) return true;
    if (callee.type === 'Identifier' && bareNames.has(callee.name)) return true;
    return false;
  }

  function isPromiseChain(callNode) {
    // x.then(...) | x.catch(...) | x.finally(...)
    if (!callNode || callNode.type !== 'CallExpression') return false;
    if (callNode.callee?.type !== 'MemberExpression') return false;
    if (callNode.callee.computed) return false;
    const m = callNode.callee.property?.name;
    return m === 'then' || m === 'catch' || m === 'finally';
  }

  // Promises-aware patterns at the call-site root: `asyncFn().then/catch/finally(...)`
  // also `await asyncFn()` etc.
  function isPromiseAwareInit(initNode) {
    if (!initNode) return false;
    if (initNode.type === 'AwaitExpression') return true;
    if (isPromiseChain(initNode)) {
      // Walk through the chain — if the eventual base is a CallExpression, check it
      // (we don't actually need the base — just confirms .then/.catch/.finally is present)
      return true;
    }
    return false;
  }

  // Step 1: collect candidates (scope-aware)
  // Each function/method/arrow is its own scope. We tag candidates by their
  // containing function "scope id" so misuses in different scopes don't conflict.
  const candidateVars = new Map(); // scopeId → Map(name → { line, col, fnName })
  let _scopeCounter = 0;
  const _scopeStack = [0]; // global scope = 0
  const allCandidates = []; // [{ scopeId, name, line, col, fnName }]

  function isFunctionLike(node) {
    return node && (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'MethodDefinition'
    );
  }

  function collectCandidates(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) collectCandidates(n); return; }
    if (typeof node.type !== 'string') return;

    let pushedScope = false;
    if (isFunctionLike(node)) {
      _scopeCounter++;
      _scopeStack.push(_scopeCounter);
      pushedScope = true;
    }

    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.init) {
      if (isAsyncCall(node.init) && !isPromiseAwareInit(node.init)) {
        const name = node.id.name;
        const callee = node.init.callee;
        const fnName = callee.type === 'Identifier' ? callee.name :
          (callee.type === 'MemberExpression' ? (memberPath(callee) || callee.property?.name) : '?');
        const scopeId = _scopeStack[_scopeStack.length - 1];
        if (!candidateVars.has(scopeId)) candidateVars.set(scopeId, new Map());
        candidateVars.get(scopeId).set(name, {
          line: node.loc?.start?.line ?? 0,
          col: (node.loc?.start?.column ?? 0) + 1,
          fnName,
          scopeId,
        });
        allCandidates.push({ scopeId, name });
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
      const c = node[key];
      if (c && typeof c === 'object') collectCandidates(c);
    }

    if (pushedScope) _scopeStack.pop();
  }
  collectCandidates(ast);

  // Step 2: track every use of candidate vars (scope-aware) and classify
  // each one as a misuse (used in a truthy/value context) — these are real bugs
  // since `if (promise)` is always truthy regardless of resolved value.
  const misuses = []; // { scopeId, name, line, col, contextTag }

  function resolveCandidate(name, scopeStack) {
    // Walk inner-most → outer-most; first hit wins.
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      const sid = scopeStack[i];
      const m = candidateVars.get(sid);
      if (m && m.has(name)) return sid;
    }
    return null;
  }

  function classifyUse(node, parent, parentKey, scopeStack) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) classifyUse(n, parent, parentKey, scopeStack); return; }
    if (typeof node.type !== 'string') return;

    let pushedScope = false;
    if (isFunctionLike(node)) {
      _scopeCounter++;
      // We don't want to allocate new scope ids — instead, use the SAME counter
      // mechanism as Step 1 (which is reset). To stay aligned with Step 1, we
      // need deterministic scope IDs. The simplest approach: count function-like
      // nodes deterministically as we visit. Because Step 1 also visited in the
      // same order, the scope IDs will match.
      scopeStack = [...scopeStack, _scopeCounter];
      pushedScope = true;
    }

    // Identifier reference
    if (node.type === 'Identifier') {
      // Skip declarator id (left-hand side of `const x = ...`)
      if (parent && parent.type === 'VariableDeclarator' && parentKey === 'id') {
        // pass-through to recurse children, no classification
      }
      // Skip property name in MemberExpression (e.g., obj.foo — `foo` is property, not a var ref)
      else if (parent && parent.type === 'MemberExpression' && parentKey === 'property' && !parent.computed) {
        // not a var ref
      }
      // Skip function/method name as the callee (we're interested in argument vars only)
      else {
        const candidateScope = resolveCandidate(node.name, scopeStack);
        if (candidateScope !== null) {
          // MISUSE: used in a truthy/value context
          if (parent && (parent.type === 'IfStatement' || parent.type === 'WhileStatement' || parent.type === 'DoWhileStatement') && parentKey === 'test') {
            misuses.push({ scopeId: candidateScope, name: node.name, line: node.loc?.start?.line ?? 0, col: (node.loc?.start?.column ?? 0) + 1, contextTag: 'if/while test' });
          }
          else if (parent && parent.type === 'ConditionalExpression' && parentKey === 'test') {
            misuses.push({ scopeId: candidateScope, name: node.name, line: node.loc?.start?.line ?? 0, col: (node.loc?.start?.column ?? 0) + 1, contextTag: 'ternary test' });
          }
          else if (parent && parent.type === 'UnaryExpression' && parent.operator === '!') {
            misuses.push({ scopeId: candidateScope, name: node.name, line: node.loc?.start?.line ?? 0, col: (node.loc?.start?.column ?? 0) + 1, contextTag: 'logical-not' });
          }
          else if (parent && parent.type === 'LogicalExpression') {
            misuses.push({ scopeId: candidateScope, name: node.name, line: node.loc?.start?.line ?? 0, col: (node.loc?.start?.column ?? 0) + 1, contextTag: '&&/||' });
          }
          // Other uses (await x, x.then, x.catch, return x, void x, fn(x), etc.) are neutral or safe.
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
      const c = node[key];
      if (c && typeof c === 'object') classifyUse(c, node, key, scopeStack);
    }

    if (pushedScope) {
      // No state to pop — scopeStack is per-call (we shadowed it).
    }
  }

  // Reset the scope counter for the second walk so IDs match Step 1's assignments.
  _scopeCounter = 0;
  classifyUse(ast, null, null, [0]);

  // Step 3: emit Pattern B findings — every misuse is a real bug regardless
  // of any other Promise-aware uses elsewhere. (`if (promise)` is always truthy
  // even if the same promise is awaited 5 lines later.)
  const patternBFindings = [];
  const seenComposite = new Set(); // dedupe: same scope+name+line+contextTag
  for (const m of misuses) {
    const key = `${m.scopeId}:${m.name}:${m.line}:${m.col}:${m.contextTag}`;
    if (seenComposite.has(key)) continue;
    seenComposite.add(key);
    const decl = candidateVars.get(m.scopeId)?.get(m.name);
    patternBFindings.push({
      line: m.line,
      col: m.col,
      varName: m.name,
      fnName: decl?.fnName || '?',
      declLine: decl?.line || 0,
      contextTag: m.contextTag,
    });
  }

  if (findings.length) {
    const rel = path.relative(ROOT, file);
    for (const f of findings) {
      console.log(`${rel}:${f.line}:${f.col}  [no-async-in-condition]  '${f.name}' is async; needs \`await\` in ${f.contextTag} test`);
      console.log(`    ${f.snippet.trim()}`);
    }
    totalFindings += findings.length;
  }

  if (patternBFindings.length) {
    const rel = path.relative(ROOT, file);
    for (const f of patternBFindings) {
      console.log(`${rel}:${f.line}:${f.col}  [floating-promise-as-value]  '${f.varName}' (= ${f.fnName}() at L${f.declLine}) is an unawaited Promise but used in ${f.contextTag} → always truthy/falsy. Add \`await\`.`);
    }
    totalFindings += patternBFindings.length;
  }
}

if (totalFindings) {
  console.log(`\n[lint:await] ${totalFindings} issue(s) found. Add \`await\` or stop calling async function in condition.`);
  process.exit(1);
} else {
  console.log(`[lint:await] OK — checked ${files.length} file(s); no unawaited async calls in conditions.`);
  process.exit(0);
}
