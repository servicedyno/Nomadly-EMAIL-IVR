// ============================================================
// Reseller API — Developer Documentation Page  (js/apidoc-page.js)
// ------------------------------------------------------------
// Renders a self-contained, dependency-free HTML developer guide for the
// public Reseller REST API (js/reseller-api.js). Served by Express at:
//     GET /apidoc      →  https://1.speechcue.com/apidoc
//
// The page has ZERO external assets (all CSS + JS are inline) so it renders
// instantly and keeps working even if a CDN is blocked.
// ============================================================

const BRAND = process.env.CHAT_BOT_BRAND || 'Nomadly'
const SUPPORT_HANDLE = process.env.SUPPORT_HANDLE || process.env.SUPPORT_USERNAME || '@onarrival1'

// ── Endpoint reference model ──
// Each group → { id, title, blurb, endpoints:[ { method, path, auth, billed, desc, params:[[name,req,desc]], curl, resp } ] }
function endpointGroups(base) {
  return [
    {
      id: 'meta', title: 'Meta',
      blurb: 'Service status and your account/wallet snapshot.',
      endpoints: [
        {
          method: 'GET', path: '/health', auth: false, billed: false,
          desc: 'Health probe. No authentication required. Returns the current run mode (live or dry_run) and the list of sellable products.',
          curl: `curl -s ${base}/health`,
          resp: `{
  "ok": true,
  "service": "reseller-api",
  "version": "v1",
  "mode": "live",
  "products": ["domains", "dns", "vps", "rdp", "hosting"]
}`,
        },
        {
          method: 'GET', path: '/account', auth: true, billed: false,
          desc: 'Returns the account bound to your API key and its current wallet balance in USD. Every billed call is funded by this wallet.',
          curl: `curl -s ${base}/account \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{
  "owner_chat_id": "7304424395",
  "label": "acme-reseller",
  "wallet_balance_usd": 142.50,
  "mode": "live"
}`,
        },
      ],
    },
    {
      id: 'domains', title: 'Domains',
      blurb: 'Search, register and list domains. Registration is wallet-billed at the live registrar price.',
      endpoints: [
        {
          method: 'GET', path: '/domains/search', auth: true, billed: false,
          desc: 'Check availability and live price for a domain.',
          params: [['domain', true, 'The domain to check, e.g. mysite.com']],
          curl: `curl -s "${base}/domains/search?domain=mysite.com" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{
  "domain": "mysite.com",
  "available": true,
  "price_usd": 12.99,
  "registrar": "ConnectReseller",
  "message": ""
}`,
        },
        {
          method: 'POST', path: '/domains/register', auth: true, billed: true,
          desc: 'Register a domain. Charged to your wallet at the price returned by /domains/search. By default DNS is set to Cloudflare; pass a custom nameserver array to override.',
          params: [
            ['domain', true, 'Domain to register, e.g. mysite.com'],
            ['ns_choice', false, '"cloudflare" (default) or "registrar"'],
            ['nameservers', false, 'Array of custom nameservers — overrides ns_choice'],
          ],
          curl: `curl -s -X POST ${base}/domains/register \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"mysite.com","ns_choice":"cloudflare"}'`,
          resp: `{
  "mode": "live",
  "product": "domain",
  "action": "register",
  "charged_usd": 12.99,
  "wallet_balance_usd": 129.51,
  "result": {
    "success": true,
    "domain": "mysite.com",
    "registrar": "ConnectReseller",
    "nameservers": ["ada.ns.cloudflare.com", "rob.ns.cloudflare.com"]
  }
}`,
        },
        {
          method: 'GET', path: '/domains', auth: true, billed: false,
          desc: 'List all domains owned by your account (max 500).',
          curl: `curl -s ${base}/domains \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{
  "domains": [
    {
      "domain": "mysite.com",
      "registrar": "ConnectReseller",
      "nameserver_type": "cloudflare",
      "registered_at": "2026-09-08T10:22:00.000Z"
    }
  ]
}`,
        },
      ],
    },
    {
      id: 'dns', title: 'DNS Management',
      blurb: 'Full CRUD over DNS records plus nameserver control. DNS operations are FREE — no wallet charge.',
      endpoints: [
        {
          method: 'GET', path: '/dns/:domain/records', auth: true, billed: false,
          desc: 'List all DNS records for a domain you own.',
          curl: `curl -s ${base}/dns/mysite.com/records \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{
  "domain": "mysite.com",
  "records": [
    { "id": "a1b2", "type": "A", "name": "@", "value": "203.0.113.10", "ttl": 3600 }
  ],
  "source": "cloudflare"
}`,
        },
        {
          method: 'POST', path: '/dns/:domain/records', auth: true, billed: false,
          desc: 'Add a DNS record.',
          params: [
            ['type', true, 'Record type: A, AAAA, CNAME, MX, TXT, …'],
            ['name', false, 'Host/subdomain — defaults to "@" (root)'],
            ['value', true, 'Record value / target'],
            ['priority', false, 'Priority (MX/SRV records)'],
            ['ttl', false, 'Time-to-live in seconds'],
          ],
          curl: `curl -s -X POST ${base}/dns/mysite.com/records \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"A","name":"www","value":"203.0.113.10","ttl":3600}'`,
          resp: `{
  "domain": "mysite.com",
  "added": { "type": "A", "name": "www", "value": "203.0.113.10", "ttl": 3600 },
  "detail": { "success": true, "id": "c3d4" }
}`,
        },
        {
          method: 'PUT', path: '/dns/:domain/records', auth: true, billed: false,
          desc: 'Update an existing DNS record. Send back the full record object obtained from the GET call (optionally wrapped in { "record": {…} }).',
          curl: `curl -s -X PUT ${base}/dns/mysite.com/records \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"record":{"id":"c3d4","type":"A","name":"www","value":"203.0.113.20","ttl":3600}}'`,
          resp: `{ "domain": "mysite.com", "updated": true, "detail": { "success": true } }`,
        },
        {
          method: 'DELETE', path: '/dns/:domain/records', auth: true, billed: false,
          desc: 'Delete a DNS record. Send the record object obtained from the GET call.',
          curl: `curl -s -X DELETE ${base}/dns/mysite.com/records \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"record":{"id":"c3d4","type":"A","name":"www"}}'`,
          resp: `{ "domain": "mysite.com", "deleted": true, "detail": { "success": true } }`,
        },
        {
          method: 'PUT', path: '/dns/:domain/nameservers', auth: true, billed: false,
          desc: 'Replace the domain nameservers. Provide at least two.',
          params: [['nameservers', true, 'Array of ≥ 2 nameserver hostnames']],
          curl: `curl -s -X PUT ${base}/dns/mysite.com/nameservers \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"nameservers":["ns1.example.com","ns2.example.com"]}'`,
          resp: `{
  "domain": "mysite.com",
  "nameservers": ["ns1.example.com", "ns2.example.com"],
  "updated": true
}`,
        },
      ],
    },
    {
      id: 'vps', title: 'VPS (Linux)',
      blurb: 'Provision and control Linux virtual servers. Creation is wallet-billed at the plan price (includes markup).',
      endpoints: [
        {
          method: 'GET', path: '/vps/plans', auth: true, billed: false,
          desc: 'List available Linux VPS plans and prices for a region.',
          params: [['region', false, 'Region code — defaults to EU']],
          curl: `curl -s "${base}/vps/plans?region=EU" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{
  "product": "vps",
  "provider": "digitalocean",
  "region": "EU",
  "plans": [
    { "plan_id": "s-1vcpu-1gb", "name": "1 vCPU / 1 GB", "vcpus": 1, "ram_gb": 1, "disk_gb": 25, "price_usd": 18.00 }
  ]
}`,
        },
        {
          method: 'POST', path: '/vps', auth: true, billed: true,
          desc: 'Create a Linux VPS. Returns the instance id, IP and initial root password once provisioned.',
          params: [
            ['plan_id', true, 'A plan_id from GET /vps/plans'],
            ['region', false, 'Region code — defaults to EU'],
            ['hostname', false, 'Optional label/hostname'],
            ['os', false, 'OS image — defaults to ubuntu'],
          ],
          curl: `curl -s -X POST ${base}/vps \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"plan_id":"s-1vcpu-1gb","region":"EU","hostname":"web-01"}'`,
          resp: `{
  "mode": "live",
  "product": "vps",
  "action": "create",
  "charged_usd": 18.00,
  "wallet_balance_usd": 111.51,
  "result": {
    "success": true,
    "id": "b2f1c0a4-…",
    "instance_id": "419287654",
    "ip": "203.0.113.55",
    "status": "provisioning",
    "default_password": "Xy8!kP2q…"
  }
}`,
        },
        {
          method: 'GET', path: '/vps', auth: true, billed: false,
          desc: 'List all Linux VPS instances owned by your account.',
          curl: `curl -s ${base}/vps -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{
  "vps": [
    { "id": "b2f1c0a4-…", "instance_id": "419287654", "ip": "203.0.113.55",
      "plan": "1 vCPU / 1 GB", "region": "EU", "os": "linux", "status": "active",
      "created_at": "2026-09-08T10:40:00.000Z" }
  ]
}`,
        },
        {
          method: 'GET', path: '/vps/:id', auth: true, billed: false,
          desc: 'Get one VPS with live status pulled from the provider.',
          curl: `curl -s ${base}/vps/b2f1c0a4-… \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{
  "id": "b2f1c0a4-…", "instance_id": "419287654",
  "plan": "1 vCPU / 1 GB", "region": "EU", "os": "linux",
  "status": "active", "ip": "203.0.113.55", "live": { "status": "active" }
}`,
        },
        {
          method: 'POST', path: '/vps/:id/action', auth: true, billed: false,
          desc: 'Power action on a VPS.',
          params: [['action', true, 'One of: start, stop, reboot, shutdown']],
          curl: `curl -s -X POST ${base}/vps/b2f1c0a4-…/action \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"reboot"}'`,
          resp: `{ "mode": "live", "id": "b2f1c0a4-…", "action": "reboot", "detail": { "ok": true } }`,
        },
        {
          method: 'DELETE', path: '/vps/:id', auth: true, billed: false,
          desc: 'Destroy (cancel) a VPS. This is irreversible.',
          curl: `curl -s -X DELETE ${base}/vps/b2f1c0a4-… \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{ "mode": "live", "id": "b2f1c0a4-…", "destroyed": true }`,
        },
        {
          method: 'GET', path: '/vps/:id/credentials', auth: true, billed: false,
          desc: 'Reveal login credentials (root user + password). Password is only returned in live mode.',
          curl: `curl -s ${base}/vps/b2f1c0a4-…/credentials \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{ "id": "b2f1c0a4-…", "ip": "203.0.113.55", "username": "root", "password": "Xy8!kP2q…", "mode": "live" }`,
        },
      ],
    },
    {
      id: 'rdp', title: 'RDP (Windows)',
      blurb: 'Identical to the VPS endpoints but provisions Windows servers. Replace /vps with /rdp. The login user is "Administrator".',
      endpoints: [
        {
          method: 'GET', path: '/rdp/plans', auth: true, billed: false,
          desc: 'List available Windows RDP plans and prices for a region.',
          params: [['region', false, 'Region code — defaults to EU']],
          curl: `curl -s "${base}/rdp/plans?region=EU" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{ "product": "rdp", "provider": "azure", "region": "EU", "plans": [ … ] }`,
        },
        {
          method: 'POST', path: '/rdp', auth: true, billed: true,
          desc: 'Create a Windows RDP server. Same body as POST /vps (os is forced to windows).',
          params: [
            ['plan_id', true, 'A plan_id from GET /rdp/plans'],
            ['region', false, 'Region code — defaults to EU'],
            ['hostname', false, 'Optional label/hostname'],
          ],
          curl: `curl -s -X POST ${base}/rdp \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"plan_id":"Standard_B1s","region":"EU"}'`,
          resp: `{ "mode": "live", "product": "rdp", "action": "create", "charged_usd": 24.00,
  "result": { "success": true, "id": "…", "ip": "203.0.113.80", "status": "provisioning" } }`,
        },
        { method: 'GET', path: '/rdp', auth: true, billed: false, desc: 'List all Windows RDP instances you own.', curl: `curl -s ${base}/rdp -H "Authorization: Bearer YOUR_API_KEY"`, resp: `{ "rdp": [ … ] }` },
        { method: 'GET', path: '/rdp/:id', auth: true, billed: false, desc: 'Get one RDP instance with live provider status.', curl: `curl -s ${base}/rdp/ID -H "Authorization: Bearer YOUR_API_KEY"`, resp: `{ "id": "…", "os": "windows", "status": "active", "ip": "203.0.113.80" }` },
        { method: 'POST', path: '/rdp/:id/action', auth: true, billed: false, desc: 'Power action (start, stop, reboot, shutdown).', params: [['action', true, 'start | stop | reboot | shutdown']], curl: `curl -s -X POST ${base}/rdp/ID/action \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"reboot"}'`, resp: `{ "mode": "live", "id": "…", "action": "reboot" }` },
        { method: 'DELETE', path: '/rdp/:id', auth: true, billed: false, desc: 'Destroy the RDP instance (irreversible).', curl: `curl -s -X DELETE ${base}/rdp/ID -H "Authorization: Bearer YOUR_API_KEY"`, resp: `{ "mode": "live", "id": "…", "destroyed": true }` },
        { method: 'GET', path: '/rdp/:id/credentials', auth: true, billed: false, desc: 'Reveal Administrator credentials (live mode only).', curl: `curl -s ${base}/rdp/ID/credentials -H "Authorization: Bearer YOUR_API_KEY"`, resp: `{ "id": "…", "ip": "203.0.113.80", "username": "Administrator", "password": "…", "mode": "live" }` },
      ],
    },
    {
      id: 'hosting', title: 'cPanel Hosting',
      blurb: 'Sell Anti-Red cPanel hosting plans. Creation is wallet-billed (plan price + domain price when domain_mode=buy).',
      endpoints: [
        {
          method: 'GET', path: '/hosting/plans', auth: true, billed: false,
          desc: 'List the available hosting plans, prices and features.',
          curl: `curl -s ${base}/hosting/plans \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{
  "plans": [
    { "plan_id": "golden-monthly", "name": "Golden Anti-Red HostPanel (1-Month)",
      "tier": "gold", "price_usd": 100, "duration_days": 30,
      "addon_domains": "unlimited",
      "features": ["Anti-Red protection", "Unlimited addon domains", "Visitor Captcha + Geo", "30 days"] }
  ]
}`,
        },
        {
          method: 'POST', path: '/hosting', auth: true, billed: true,
          desc: 'Create a cPanel hosting account. Use domain_mode "byo" to host a domain you already own, or "buy" to register a new domain in the same call (domain price is added to the charge).',
          params: [
            ['plan_id', true, 'A plan_id from GET /hosting/plans'],
            ['domain', true, 'The primary domain for the account'],
            ['domain_mode', false, '"byo" (default) or "buy"'],
            ['email', false, 'Contact email for the account'],
          ],
          curl: `curl -s -X POST ${base}/hosting \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"plan_id":"golden-monthly","domain":"mysite.com","domain_mode":"byo","email":"client@mysite.com"}'`,
          resp: `{
  "mode": "live",
  "product": "hosting",
  "action": "create",
  "charged_usd": 100,
  "wallet_balance_usd": 42.51,
  "result": {
    "success": true,
    "domain": "mysite.com",
    "plan": "Golden Anti-Red HostPanel (1-Month)",
    "cpanel_username": "mysite01",
    "nameservers": ["ada.ns.cloudflare.com", "rob.ns.cloudflare.com"],
    "queued": false
  }
}`,
        },
        {
          method: 'GET', path: '/hosting', auth: true, billed: false,
          desc: 'List all cPanel hosting accounts you own.',
          curl: `curl -s ${base}/hosting -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{
  "accounts": [
    { "username": "mysite01", "domain": "mysite.com",
      "plan": "Golden Anti-Red HostPanel (1-Month)", "suspended": false,
      "created_at": "2026-09-08T11:00:00.000Z" }
  ]
}`,
        },
        {
          method: 'POST', path: '/hosting/:user/suspend', auth: true, billed: false,
          desc: 'Suspend a hosting account.',
          params: [['reason', false, 'Optional suspend reason']],
          curl: `curl -s -X POST ${base}/hosting/mysite01/suspend \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"reason":"non-payment"}'`,
          resp: `{ "mode": "live", "username": "mysite01", "suspended": true }`,
        },
        {
          method: 'POST', path: '/hosting/:user/unsuspend', auth: true, billed: false,
          desc: 'Unsuspend a hosting account.',
          curl: `curl -s -X POST ${base}/hosting/mysite01/unsuspend \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{ "mode": "live", "username": "mysite01", "suspended": false }`,
        },
        {
          method: 'DELETE', path: '/hosting/:user', auth: true, billed: false,
          desc: 'Terminate a hosting account (irreversible).',
          curl: `curl -s -X DELETE ${base}/hosting/mysite01 \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{ "mode": "live", "username": "mysite01", "terminated": true }`,
        },
        {
          method: 'GET', path: '/hosting/:user/login', auth: true, billed: false,
          desc: 'Generate a one-click cPanel login URL for the account (live mode only).',
          curl: `curl -s ${base}/hosting/mysite01/login \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          resp: `{ "mode": "live", "username": "mysite01", "login_url": "https://whm-host/cpsess…/login/?…" }`,
        },
      ],
    },
  ]
}

const ERRORS = [
  ['401', 'missing_api_key', 'No API key supplied in Authorization / X-API-Key header.'],
  ['401', 'invalid_api_key', 'The key is unknown or has been disabled.'],
  ['400', 'invalid_domain / invalid_record / invalid_plan', 'A required parameter was missing or malformed.'],
  ['400', 'pricing_failed', 'A valid price could not be determined for the order.'],
  ['402', 'insufficient_wallet_balance', 'Wallet balance is below the order price. Top up and retry.'],
  ['409', 'domain_unavailable', 'The requested domain cannot be registered.'],
  ['409', 'domain_in_use', 'That domain already has an active hosting plan.'],
  ['404', 'not_found', 'The resource does not exist or is not owned by your account.'],
  ['501', 'not_supported', 'The provider does not support this action for this resource.'],
  ['502', 'provisioning_failed', 'The provider failed to fulfil the request. Any charge is auto-refunded.'],
  ['500', 'internal_error / auth_error', 'Unexpected server error — safe to retry; contact support if persistent.'],
]

// ── HTML escape ──
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function methodBadge(m) {
  return `<span class="m m-${m.toLowerCase()}">${m}</span>`
}

// ── Auto-generate Node.js (fetch) + Python (requests) snippets from the cURL ──
function parseCurl(curl) {
  const src = String(curl).replace(/\\\n\s*/g, ' ')
  const methodM = src.match(/-X\s+([A-Z]+)/)
  const method = methodM ? methodM[1] : 'GET'
  const urlM = src.match(/curl\s+-s\s+(?:"([^"]+)"|(\S+))/)
  const url = urlM ? (urlM[1] || urlM[2]) : ''
  const bodyM = src.match(/-d\s+'([^']*)'/)
  const body = bodyM ? bodyM[1] : null
  const hasAuth = /Authorization:\s*Bearer|X-API-Key/i.test(src)
  return { method, url, body, hasAuth }
}
function prettyJson(body) {
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch (e) { return body }
}
function indentCont(s, pad) {
  return s.split('\n').map((l, i) => (i === 0 ? l : pad + l)).join('\n')
}
function toNode({ method, url, body, hasAuth }) {
  const headers = []
  if (hasAuth) headers.push('    "Authorization": "Bearer YOUR_API_KEY"')
  if (body) headers.push('    "Content-Type": "application/json"')
  const opts = [`  method: "${method}"`]
  if (headers.length) opts.push(`  headers: {\n${headers.join(',\n')}\n  }`)
  if (body) opts.push(`  body: JSON.stringify(${indentCont(prettyJson(body), '  ')})`)
  return `const res = await fetch("${url}", {\n${opts.join(',\n')}\n});\nconst data = await res.json();\nconsole.log(data);`
}
function toPython({ method, url, body, hasAuth }) {
  const kwargs = []
  if (hasAuth) kwargs.push('headers={"Authorization": "Bearer YOUR_API_KEY"}')
  if (body) {
    const py = prettyJson(body).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')
    kwargs.push('json=' + indentCont(py, '    '))
  }
  let call = `res = requests.${method.toLowerCase()}("${url}"`
  if (kwargs.length) call += ',\n    ' + kwargs.join(',\n    ')
  call += ')'
  return `import requests\n\n${call}\nprint(res.json())`
}
function renderSnippets(ep) {
  const p = parseCurl(ep.curl)
  return `
    <div class="req-tabs">
      <button class="tab" data-lang="curl">cURL</button>
      <button class="tab" data-lang="node">Node.js</button>
      <button class="tab" data-lang="python">Python</button>
      <button class="copy snippet-copy">Copy</button>
    </div>
    <pre class="code snippet s-curl"><code>${esc(ep.curl)}</code></pre>
    <pre class="code snippet s-node"><code>${esc(toNode(p))}</code></pre>
    <pre class="code snippet s-python"><code>${esc(toPython(p))}</code></pre>`
}

function renderEndpoint(base, ep) {
  const badges = []
  badges.push(ep.auth ? '<span class="tag tag-auth">API key</span>' : '<span class="tag tag-open">No auth</span>')
  if (ep.billed) badges.push('<span class="tag tag-billed">Wallet-billed</span>')
  const params = (ep.params && ep.params.length)
    ? `<div class="ptitle">Parameters</div>
       <table class="ptable"><thead><tr><th>Name</th><th>Required</th><th>Description</th></tr></thead>
       <tbody>${ep.params.map(([n, r, d]) => `<tr><td><code>${esc(n)}</code></td><td>${r ? '<span class="req">required</span>' : '<span class="opt">optional</span>'}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table>`
    : ''
  return `
  <div class="ep">
    <div class="ep-head">
      ${methodBadge(ep.method)}
      <code class="ep-path">${esc(ep.path)}</code>
      <span class="ep-badges">${badges.join('')}</span>
    </div>
    <p class="ep-desc">${esc(ep.desc)}</p>
    ${params}
    <div class="cols">
      <div class="col">
        <div class="ctitle">Request</div>
        ${renderSnippets(ep)}
      </div>
      <div class="col">
        <div class="ctitle">Response<button class="copy" data-code="resp">Copy</button></div>
        <pre class="code"><code>${esc(ep.resp)}</code></pre>
      </div>
    </div>
  </div>`
}

function renderApiDocPage(baseUrl) {
  const base = baseUrl || 'https://1.speechcue.com/reseller/v1'
  const groups = endpointGroups(base)

  const nav = groups.map(g =>
    `<a class="nav-group" href="#${g.id}">${esc(g.title)}</a>` +
    `<div class="nav-eps">${g.endpoints.map(ep => `<a href="#${g.id}" class="nav-ep"><span class="nm nm-${ep.method.toLowerCase()}">${ep.method}</span>${esc(ep.path)}</a>`).join('')}</div>`
  ).join('')

  const sections = groups.map(g => `
    <section id="${g.id}" class="grp">
      <h2>${esc(g.title)}</h2>
      <p class="grp-blurb">${esc(g.blurb)}</p>
      ${g.endpoints.map(ep => renderEndpoint(base, ep)).join('')}
    </section>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(BRAND)} Reseller API — Developer Guide</title>
<meta name="description" content="Developer documentation for the ${esc(BRAND)} Reseller REST API: programmatically resell domains, DNS, VPS, RDP and cPanel hosting.">
<style>
  :root{
    --bg:#0a0b0d; --panel:#111318; --panel2:#16181f; --border:#242833;
    --text:#e6e8ee; --muted:#98a0ad; --accent:#10b981; --accent2:#34d399;
    --get:#34d399; --post:#60a5fa; --put:#fbbf24; --delete:#f87171;
    --code-bg:#0d0f14;
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;overflow-x:hidden}
  a{color:inherit;text-decoration:none}
  code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .layout{display:flex;min-height:100vh}
  /* Sidebar */
  aside{width:290px;flex-shrink:0;background:var(--panel);border-right:1px solid var(--border);position:sticky;top:0;height:100vh;overflow-y:auto;padding:22px 14px}
  .brand{display:flex;align-items:center;gap:10px;padding:4px 8px 18px;margin-bottom:8px;border-bottom:1px solid var(--border)}
  .logo{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--accent),#0ea5e9);display:flex;align-items:center;justify-content:center;font-weight:800;color:#04121a}
  .brand b{font-size:16px}.brand span{display:block;font-size:11px;color:var(--muted);font-weight:500}
  .nav-group{display:block;padding:9px 10px;margin-top:8px;font-weight:700;border-radius:8px;color:var(--text)}
  .nav-group:hover{background:var(--panel2)}
  .nav-eps{display:flex;flex-direction:column;gap:1px;margin:2px 0 6px 6px;border-left:1px solid var(--border);padding-left:8px}
  .nav-ep{display:flex;align-items:center;gap:8px;padding:5px 8px;font-size:12.5px;color:var(--muted);border-radius:6px;font-family:ui-monospace,monospace}
  .nav-ep:hover{background:var(--panel2);color:var(--text)}
  .nm{font-size:9.5px;font-weight:800;letter-spacing:.4px;min-width:38px}
  .nm-get{color:var(--get)}.nm-post{color:var(--post)}.nm-put{color:var(--put)}.nm-delete{color:var(--delete)}
  /* Main */
  main{flex:1;min-width:0;width:100%;max-width:1000px;padding:40px 46px 90px}
  .hero h1{font-size:34px;margin:0 0 6px;letter-spacing:-.5px}
  .hero .sub{color:var(--muted);font-size:16px;margin:0 0 22px}
  .pill{display:inline-flex;align-items:center;gap:7px;background:var(--panel2);border:1px solid var(--border);border-radius:999px;padding:5px 13px;font-size:12.5px;color:var(--muted);margin:0 8px 8px 0}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px rgba(16,185,129,.2)}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin:20px 0}
  .card h3{margin:0 0 10px;font-size:17px}
  .baseurl{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--code-bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px;font-family:ui-monospace,monospace;font-size:14px;flex-wrap:wrap}
  .baseurl b{color:var(--accent2)}
  .muted{color:var(--muted)}
  .grp{margin-top:52px;scroll-margin-top:20px}
  .grp>h2{font-size:24px;margin:0 0 4px;padding-bottom:8px}
  .grp-blurb{color:var(--muted);margin:0 0 18px}
  .ep{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin:16px 0}
  .ep-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .m{font-size:11px;font-weight:800;letter-spacing:.5px;padding:4px 9px;border-radius:7px;color:#04121a}
  .m-get{background:var(--get)}.m-post{background:var(--post)}.m-put{background:var(--put)}.m-delete{background:var(--delete)}
  .ep-path{font-size:15px;font-weight:600}
  .ep-badges{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
  .tag{font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid var(--border);color:var(--muted)}
  .tag-auth{border-color:#334155;color:#93c5fd}
  .tag-open{border-color:#334155;color:#86efac}
  .tag-billed{border-color:#7c5e12;color:var(--put);background:rgba(251,191,36,.08)}
  .ep-desc{color:var(--text);margin:14px 0}
  .ptitle,.ctitle{font-size:12px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin:14px 0 7px;display:flex;align-items:center;justify-content:space-between}
  .ptable{width:100%;border-collapse:collapse;font-size:13.5px;margin-bottom:6px}
  .ptable th{text-align:left;color:var(--muted);font-weight:600;border-bottom:1px solid var(--border);padding:6px 8px}
  .ptable td{border-bottom:1px solid var(--border);padding:7px 8px;vertical-align:top}
  .ptable code{background:var(--code-bg);padding:2px 6px;border-radius:5px;color:var(--accent2)}
  .req{color:var(--delete);font-size:12px}.opt{color:var(--muted);font-size:12px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px;min-width:0}
  .col{min-width:0}
  .baseurl,.ep,.card,.grp,.hero{min-width:0;max-width:100%}
  .code{background:var(--code-bg);border:1px solid var(--border);border-radius:10px;padding:14px;overflow:auto;font-size:12.8px;margin:0;white-space:pre}
  .copy{background:var(--panel2);border:1px solid var(--border);color:var(--muted);font-size:11px;padding:3px 10px;border-radius:6px;cursor:pointer}
  .copy:hover{color:var(--text);border-color:var(--accent)}
  .copy.done{color:var(--accent2);border-color:var(--accent)}
  .req-tabs{display:flex;align-items:center;gap:4px;margin-bottom:7px}
  .tab{background:transparent;border:1px solid transparent;color:var(--muted);font-size:12px;font-weight:600;padding:4px 11px;border-radius:7px;cursor:pointer}
  .tab:hover{color:var(--text)}
  .snippet-copy{margin-left:auto}
  .snippet{display:none}
  body[data-lang="curl"] .s-curl,body[data-lang="node"] .s-node,body[data-lang="python"] .s-python{display:block}
  body[data-lang="curl"] .tab[data-lang="curl"],body[data-lang="node"] .tab[data-lang="node"],body[data-lang="python"] .tab[data-lang="python"]{background:var(--panel2);border-color:var(--border);color:var(--accent2)}
  .etable{width:100%;border-collapse:collapse;font-size:13.5px}
  .etable th{text-align:left;color:var(--muted);border-bottom:1px solid var(--border);padding:8px}
  .etable td{border-bottom:1px solid var(--border);padding:9px 8px;vertical-align:top}
  .etable .st{font-family:ui-monospace,monospace;font-weight:700;color:var(--put)}
  .etable code{color:var(--delete);background:var(--code-bg);padding:2px 6px;border-radius:5px}
  footer{margin-top:60px;padding-top:22px;border-top:1px solid var(--border);color:var(--muted);font-size:13px}
  .menu-btn{display:none}
  .ptable td,.etable td{word-break:break-word}
  @media(max-width:920px){
    .ep,.card{overflow-x:auto}
    aside{position:fixed;left:0;top:0;z-index:40;transform:translateX(-100%);transition:transform .2s}
    aside.open{transform:none}
    .menu-btn{display:inline-flex;position:fixed;top:14px;right:14px;z-index:50;background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:9px;padding:9px 13px;cursor:pointer;font-size:14px}
    main{padding:64px 20px 80px}
    .cols{grid-template-columns:1fr}
    .hero h1{font-size:27px}
  }
</style>
</head>
<body data-lang="curl">
<button class="menu-btn" id="menuBtn">☰ Menu</button>
<div class="layout">
  <aside id="side">
    <div class="brand">
      <div class="logo">${esc(BRAND.slice(0, 1).toUpperCase())}</div>
      <div><b>${esc(BRAND)} Reseller API</b><span>Developer Guide · v1</span></div>
    </div>
    <a class="nav-group" href="#intro">Introduction</a>
    <a class="nav-group" href="#auth">Authentication</a>
    <a class="nav-group" href="#billing">Billing &amp; Modes</a>
    ${nav}
    <a class="nav-group" href="#errors">Errors</a>
  </aside>

  <main>
    <div class="hero">
      <h1>${esc(BRAND)} Reseller API</h1>
      <p class="sub">One REST API to programmatically resell domains, DNS, VPS, RDP and cPanel hosting.</p>
      <div>
        <span class="pill"><span class="dot"></span> Base URL: <b>&nbsp;${esc(base)}</b></span>
        <span class="pill">Version v1</span>
        <span class="pill">JSON over HTTPS</span>
      </div>
    </div>

    <section id="intro" class="grp" style="margin-top:34px">
      <h2>Introduction</h2>
      <p class="grp-blurb">The Reseller API lets you build your own storefront or automation on top of ${esc(BRAND)}. Every provisioning call is funded by the wallet of the account your API key is bound to — no separate invoicing.</p>
      <div class="card">
        <h3>Base URL</h3>
        <div class="baseurl"><span><b>${esc(base)}</b></span><button class="copy" data-copy="${esc(base)}">Copy</button></div>
        <p class="muted" style="margin:12px 0 0">All endpoints below are relative to this base. The <code>/api${''}</code>-prefixed form (<code>${esc(base.replace('/reseller/v1', '/api/reseller/v1'))}</code>) is also accepted. All requests and responses are JSON; send <code>Content-Type: application/json</code> on POST/PUT/DELETE bodies.</p>
      </div>
      <div class="card">
        <h3>Quick start</h3>
        <pre class="code"><code># 1. Check the service is up (no key needed)
curl -s ${esc(base)}/health

# 2. Check your wallet balance
curl -s ${esc(base)}/account -H "Authorization: Bearer YOUR_API_KEY"

# 3. Search a domain, then register it
curl -s "${esc(base)}/domains/search?domain=mysite.com" -H "Authorization: Bearer YOUR_API_KEY"</code></pre>
      </div>
    </section>

    <section id="auth" class="grp">
      <h2>Authentication</h2>
      <p class="grp-blurb">Every endpoint except <code>/health</code> requires your secret API key. Send it in <b>either</b> header:</p>
      <div class="card">
        <pre class="code"><code>Authorization: Bearer YOUR_API_KEY
# — or —
X-API-Key: YOUR_API_KEY</code></pre>
        <p class="muted" style="margin:12px 0 0">Keep your key secret — it can spend your wallet balance. Keys are issued per account; contact <b>${esc(SUPPORT_HANDLE)}</b> on Telegram to request or rotate one. A missing/invalid key returns <code>401</code>.</p>
      </div>
    </section>

    <section id="billing" class="grp">
      <h2>Billing &amp; Modes</h2>
      <p class="grp-blurb">Provisioning endpoints (marked <span class="tag tag-billed">Wallet-billed</span>) debit your account wallet in USD. DNS operations are free.</p>
      <div class="card">
        <h3>How billing works</h3>
        <ul class="muted" style="margin:0;padding-left:18px">
          <li>The price is charged <b>atomically before</b> provisioning. If your balance is too low you get <code>402 insufficient_wallet_balance</code> and nothing is created.</li>
          <li>If the provider fails after the charge, the amount is <b>automatically refunded</b> and you get <code>502 provisioning_failed</code> with <code>"refunded": true</code>.</li>
          <li>Successful billed responses include <code>charged_usd</code> and your new <code>wallet_balance_usd</code>.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Live vs. dry-run</h3>
        <p class="muted" style="margin:0">Check <code>mode</code> on <code>GET /health</code>. In <b>dry_run</b> mode the API validates input, prices the order and checks your balance, but <b>never creates a real resource or charges funds</b> — perfect for integration testing. In <b>live</b> mode calls provision real resources and debit your wallet. Dry-run responses include <code>"mode": "dry_run"</code> and a <code>would_provision</code> preview.</p>
      </div>
    </section>

    ${sections}

    <section id="errors" class="grp">
      <h2>Errors</h2>
      <p class="grp-blurb">Errors return the appropriate HTTP status with a JSON body <code>{ "error": "code", "message": "..." }</code>.</p>
      <div class="card" style="padding:6px 14px">
        <table class="etable">
          <thead><tr><th>HTTP</th><th>error</th><th>Meaning</th></tr></thead>
          <tbody>
            ${ERRORS.map(([s, c, d]) => `<tr><td class="st">${s}</td><td><code>${esc(c)}</code></td><td>${esc(d)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <footer>
      <p>${esc(BRAND)} Reseller API · v1 · Need a key or help? Message <b>${esc(SUPPORT_HANDLE)}</b> on Telegram.</p>
    </footer>
  </main>
</div>

<script>
  // Language tabs — switch ALL request blocks at once
  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){
      document.body.setAttribute('data-lang', t.getAttribute('data-lang'));
    });
  });
  // Copy buttons (copies the currently VISIBLE snippet in the block)
  document.querySelectorAll('.copy').forEach(function(btn){
    btn.addEventListener('click', function(){
      var text = btn.getAttribute('data-copy');
      if(!text){
        var scope = btn.closest('.col, .card, .baseurl');
        var code = null;
        if(scope){
          var pres = scope.querySelectorAll('pre code');
          for(var i=0;i<pres.length;i++){ if(pres[i].offsetParent!==null){ code=pres[i]; break; } }
          if(!code) code = scope.querySelector('pre code, b');
        }
        text = code ? code.innerText : '';
      }
      navigator.clipboard.writeText(text).then(function(){
        var old = btn.textContent; btn.textContent = 'Copied'; btn.classList.add('done');
        setTimeout(function(){ btn.textContent = old; btn.classList.remove('done'); }, 1400);
      }).catch(function(){});
    });
  });
  // Mobile menu
  var side = document.getElementById('side'), mb = document.getElementById('menuBtn');
  if(mb){ mb.addEventListener('click', function(){ side.classList.toggle('open'); }); }
  document.querySelectorAll('#side a').forEach(function(a){ a.addEventListener('click', function(){ side.classList.remove('open'); }); });
</script>
</body>
</html>`
}

module.exports = { renderApiDocPage }
