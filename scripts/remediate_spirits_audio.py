import base64, json, subprocess, uuid, urllib.request
from pathlib import Path
from pymongo import MongoClient

env = {}
for l in Path('/app/backend/.env').read_text().splitlines():
    l=l.strip()
    if not l or l.startswith('#') or '=' not in l: continue
    k,v=l.split('=',1); env[k]=v.strip().strip('"').strip("'")
db = MongoClient(env['MONGO_URL'])[env.get('DB_NAME','test')]
CHAT='7898648919'
OLD_FN='7898648919_15df0f4a-a79.mp3'
PROD_BASE='https://nomadly-email-ivr-production.up.railway.app'

def magic(b):
    if b[:3]==b'ID3' or (len(b)>1 and b[0]==0xFF and (b[1]&0xE0)==0xE0): return 'mp3'
    if b[4:8]==b'ftyp': return 'mp4'
    if b[:4]==b'RIFF': return 'wav'
    return 'other'

store = db.ivrAudioStore.find_one({'filename': OLD_FN})
if not store or not store.get('buffer'):
    print("ABORT: old ivrAudioStore doc not found"); raise SystemExit(1)
src = base64.b64decode(store['buffer'])
print("Source (old) bytes:", len(src), "magic:", magic(src))

Path('/tmp/rem_src.m4a').write_bytes(src)
new_id = uuid.uuid4().hex[:12]
new_fn = f"{CHAT}_{new_id}.mp3"
# same params as the app's downloadAndSave transcode
cmd = ['ffmpeg','-i','/tmp/rem_src.m4a','-vn','-codec:a','libmp3lame','-ac','1','-ar','44100','-b:a','128k','-y','/tmp/rem_out.mp3']
r = subprocess.run(cmd, capture_output=True, timeout=120)
if r.returncode != 0:
    print("ABORT: ffmpeg failed:", r.stderr.decode()[-400:]); raise SystemExit(1)
out = Path('/tmp/rem_out.mp3').read_bytes()
print("Transcoded MP3 bytes:", len(out), "magic:", magic(out))
assert magic(out)=='mp3', "transcode did not produce MP3"

new_url = f"{PROD_BASE}/assets/user-audio/{new_fn}"
# 1) insert new ivrAudioStore doc (real MP3) — keep old doc intact
db.ivrAudioStore.update_one({'filename': new_fn}, {'$set': {
    'filename': new_fn, 'buffer': base64.b64encode(out).decode(), 'audioUrl': new_url,
    'mimeType': 'audio/mpeg', 'source': 'audioLibrary-remediation', 'chatId': CHAT,
    'remediatedFrom': OLD_FN, 'updatedAt': __import__('datetime').datetime.utcnow(),
}, '$setOnInsert': {'createdAt': __import__('datetime').datetime.utcnow()}}, upsert=True)
print("Inserted new ivrAudioStore doc:", new_fn)

# 2) verify LIVE prod serves the new MP3 (AudioRestore restores from ivrAudioStore)
try:
    req=urllib.request.Request(new_url, headers={'User-Agent':'Mozilla/5.0'})
    resp=urllib.request.urlopen(req, timeout=30)
    body=resp.read()
    print("PROD fetch new URL:", resp.status, resp.headers.get('Content-Type'), "bytes:", len(body), "magic:", magic(body[:16]))
    prod_ok = resp.status==200 and magic(body[:16])=='mp3'
except Exception as e:
    prod_ok=False; print("PROD fetch error:", e)

# 3) repoint the ivrAudioFiles library record ONLY if prod serves it correctly
if prod_ok:
    res = db.ivrAudioFiles.update_one({'chatId': CHAT, 'filename': OLD_FN},
        {'$set': {'filename': new_fn, 'audioUrl': new_url, 'mimeType': 'audio/mpeg', 'size': len(out),
                  'remediatedFrom': OLD_FN, 'remediatedAt': __import__('datetime').datetime.utcnow()}})
    print("ivrAudioFiles updated:", res.matched_count, "matched,", res.modified_count, "modified")
    print("\nRESULT: REMEDIATION SUCCESS — library item now points to working MP3:", new_url)
else:
    print("\nRESULT: prod did not serve new MP3 — ivrAudioFiles NOT changed (safe). Investigate.")
