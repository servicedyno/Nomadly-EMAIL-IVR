// Nomadly SMS App — API Discovery Worker
// Serves the current backend URL to the Nomadly SMS APK.
// To update the backend URL, edit API_BASE below and re-deploy.
// Dashboard: https://dash.cloudflare.com/?to=/:account/workers/services
const API_BASE = 'https://nomadly-email-ivr-production.up.railway.app'

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Serve the discovery JSON on any path — keep it permissive so the APK
  // can probe `/`, `/api.json`, or `/sms-app/config` and always succeed.
  const payload = {
    apiBase: API_BASE,
    version: 1,
    updatedAt: '2026-02-22T00:00:00Z',
  }
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      ...corsHeaders,
    },
  })
}
