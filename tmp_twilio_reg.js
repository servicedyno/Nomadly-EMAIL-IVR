// READ-ONLY: inspect raw regulation object shape for GB vs US vs NL.
const fs = require('fs')
const twilio = require('twilio')
function envVal(key){const m=fs.readFileSync('/app/backend/.env','utf8').match(new RegExp('^'+key+'="?([^"\\n]+)"?','m'));return m?m[1]:null}
;(async()=>{
  const client=twilio(envVal('TWILIO_ACCOUNT_SID'),envVal('TWILIO_AUTH_TOKEN'))
  try{
    for(const [c,nt] of [['GB','local'],['US','local'],['NL','mobile'],['NL','local'],['AU','local']]){
      const list=await client.numbers.v2.regulatoryCompliance.regulations.list({isoCountry:c,numberType:nt,limit:3})
      console.log('\n===== '+c+'/'+nt+' — list returned '+list.length+' regs =====')
      if(list.length){
        const r=list[0]
        console.log('LIST object keys:', Object.keys(r))
        console.log('LIST requirements (raw):', JSON.stringify(r.requirements))
        // fetch full detail
        const full=await client.numbers.v2.regulatoryCompliance.regulations(r.sid).fetch()
        const req=full.requirements||{}
        const eu=req.endUser||[]; const sd=req.supportingDocument||[]
        console.log('FETCH endUserType:', full.endUserType, '| endUser reqs:', eu.length, '| supportingDoc reqs:', sd.length)
        console.log('FETCH endUser detail:', JSON.stringify(eu).slice(0,300))
        console.log('FETCH supportingDoc detail:', JSON.stringify(sd).slice(0,300))
      }
    }
    // Also check AvailablePhoneNumber address_requirements as an alternate signal
    console.log('\n===== AvailablePhoneNumber address_requirements sample =====')
    for(const c of ['US','GB','NL','AU']){
      try{
        const av=await client.availablePhoneNumbers(c).mobile.list({limit:1}).catch(()=>[])
        const av2=av.length?av:await client.availablePhoneNumbers(c).local.list({limit:1}).catch(()=>[])
        if(av2.length) console.log('  '+c+': '+(av2[0].phoneNumber)+' addressRequirements='+av2[0].addressRequirements)
        else console.log('  '+c+': no available sample')
      }catch(e){console.log('  '+c+' err:',e.message)}
    }
  }catch(e){console.log('ERROR:',e.status||'',e.message)}finally{process.exit(0)}
})()
