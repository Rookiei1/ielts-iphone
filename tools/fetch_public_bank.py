"""Read only the question database from the pinned public upstream release."""
from __future__ import annotations
import base64
import concurrent.futures
import hashlib
import json
import mimetypes
import re
import shutil
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path
from reading_source import extract_registered_object
from convert_private_bank import clean_display_html

ROOT=Path(__file__).resolve().parents[1]
REPO='sallowayma-git/IELTS-practice'
REVISION='7f7a01b2bdc8b5cfcb8ace3d1effa0e807214179'
RAW=f'https://raw.githubusercontent.com/{REPO}/{REVISION}/'
DIRECTORY='assets/generated/reading-exams/'
FIELDS=('schemaVersion','examId','meta','passage','questionGroups','answerKey','questionOrder','questionDisplayMap')

def download(url):
    if url.startswith('https://api.github.com/') and shutil.which('gh'):
        return subprocess.check_output(['gh','api',url])
    curl=shutil.which('curl.exe') or shutil.which('curl')
    if curl:
        return subprocess.check_output([curl,'--fail','--location','--silent','--show-error','--retry','2','--connect-timeout','15','--max-time','60',url])
    request=urllib.request.Request(url,headers={'User-Agent':'IELTS-Practice-data-builder'})
    with urllib.request.urlopen(request,timeout=45) as response:return response.read()

def inline_media(value):
    if isinstance(value,dict):
        return {key:inline_media(item) for key,item in value.items()}
    if isinstance(value,list):return [inline_media(item) for item in value]
    if not isinstance(value,str) or '<img' not in value.lower():return value
    def replace(match):
        src=match.group(2)
        if src.startswith('data:image/'):return match.group(0)
        url=RAW+src.lstrip('/') if src.startswith('/') or src.startswith('assets/') else urllib.parse.urljoin(RAW+DIRECTORY,src)
        if not url.startswith(RAW):raise ValueError('Question image is outside the pinned public source')
        content=download(url)
        mime=mimetypes.guess_type(url)[0] or 'image/png'
        return match.group(1)+'data:'+mime+';base64,'+base64.b64encode(content).decode()+match.group(3)
    return re.sub(r'(\bsrc=["\x27])([^"\x27]+)(["\x27])',replace,value,flags=re.I)

def fetch_bank():
    cache=ROOT/'build/public-bank.json'
    if cache.exists():
        data=json.loads(cache.read_text(encoding='utf-8'))
        if data.get('sourceRevision')==REVISION and len(data.get('exams',[]))==242:return data['exams']
    entries=json.loads(download(f'https://api.github.com/repos/{REPO}/contents/{DIRECTORY}?ref={REVISION}'))
    files=[entry for entry in entries if entry['name'].endswith('.js') and entry['name']!='manifest.js']
    def read(entry):
        saved=ROOT/'build/upstream-reading'/entry['sha']
        if saved.exists():raw=saved.read_bytes()
        else:
            stored=json.loads(download(f'https://api.github.com/repos/{REPO}/git/blobs/{entry["sha"]}'))
            raw=base64.b64decode(stored['content'])
            pointer=re.search(rb'oid sha256:([0-9a-f]{64})',raw) if raw.startswith(b'version https://git-lfs.github.com/') else None
            if pointer:
                raw=download(RAW+DIRECTORY+urllib.parse.quote(entry['name']))
                if hashlib.sha256(raw).hexdigest()!=pointer.group(1).decode():raise ValueError('LFS source integrity check failed')
        blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
        with_bom=b'\xef\xbb\xbf'+raw
        if blob!=entry['sha'] and hashlib.sha1(b'blob '+str(len(with_bom)).encode()+b'\0'+with_bom).hexdigest()==entry['sha']:
            raw=with_bom;blob=entry['sha']
        if blob!=entry['sha']:
            stored=json.loads(download(f'https://api.github.com/repos/{REPO}/git/blobs/{entry["sha"]}'))
            pointer=base64.b64decode(stored['content'])
            match=re.search(rb'oid sha256:([0-9a-f]{64})',pointer)
            if match:
                if hashlib.sha256(raw).hexdigest()!=match.group(1).decode():raise ValueError('LFS source integrity check failed')
            elif hashlib.sha1(b'blob '+str(len(pointer)).encode()+b'\0'+pointer).hexdigest()==entry['sha']:
                raw=pointer
            else:raise ValueError(f'Public source integrity check failed: {entry["name"]}')
        saved.parent.mkdir(parents=True,exist_ok=True);saved.write_bytes(raw)
        exam_id,data=extract_registered_object(raw.decode('utf-8-sig'))
        if data.get('examId')!=exam_id or not data.get('answerKey'):raise ValueError('Invalid question database entry')
        clean_display_html(data)
        return inline_media({key:data[key] for key in FIELDS if key in data})
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:exams=list(pool.map(read,files))
    if len(exams)!=242:raise ValueError(f'Expected 242 readings, received {len(exams)}')
    cache.parent.mkdir(parents=True,exist_ok=True)
    cache.write_text(json.dumps({'sourceRevision':REVISION,'exams':exams},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'Public source verified: {len(exams)} readings; {sum(len(e["answerKey"]) for e in exams)} answers.')
    return exams

if __name__=='__main__':fetch_bank()
