const fs = require('fs')
function envVal(k){const m=fs.readFileSync('/app/backend/.env','utf8').match(new RegExp('^'+k+'="?([^"\\n]+)"?','m'));return m?m[1]:null}
const token = envVal('API_KEY_RAILWAY')
const EP = 'https://backboard.railway.app/graphql/v2'

async function gql(query, variables){
  const r = await fetch(EP, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({query, variables}) })
  return r.json()
}

;(async()=>{
  const meQ = `query {
    me {
      projects { edges { node {
        id name
        environments { edges { node { id name } } }
        services { edges { node { id name } } }
      } } }
    }
  }`
  const me = await gql(meQ)
  if (me.errors) { console.log('ME ERR', JSON.stringify(me.errors)); }
  const projects = (((me.data||{}).me||{}).projects||{}).edges || []
  console.log('Projects:', projects.length)
  for (const p of projects){
    const n = p.node
    console.log('\nPROJECT', n.name, n.id)
    console.log('  envs:', (n.environments.edges||[]).map(e=>e.node.name+':'+e.node.id).join(', '))
    console.log('  services:', (n.services.edges||[]).map(e=>e.node.name+':'+e.node.id).join(', '))
  }
})().catch(e=>console.log('FATAL', e.message))
