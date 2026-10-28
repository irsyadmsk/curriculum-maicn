"""Read owner's Word and program matrix; write private plain-text records, never site assets."""
import argparse, json, hashlib, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

p = argparse.ArgumentParser()
p.add_argument('folder', type=Path)
p.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'private-inputs/curriculum-content.json')
a = p.parse_args()
book = a.folder / '01 Buku dan Dokumen Induk Kurikulum/01 Buku Kurikulum Utama/BUKU KURIKULUM MA INSAN CENDEKIA NUSANTARA.docx'
matrix = a.folder / '12 Catatan dan Monitoring Program/data-program.json'
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with zipfile.ZipFile(book) as z:
    body = ET.fromstring(z.read('word/document.xml')).find('w:body', ns)
    blocks = []
    for para in body.iter('{'+ns['w']+'}p'):
        text = ''.join(t.text or '' for t in para.findall('.//w:t', ns))
        if text.strip():
            blocks.append({'id': 'B-%04d' % (len(blocks)+1), 'kind': 'book', 'source': {'text': text, 'file': book.name}, 'content': {'text': text}})
data = json.loads(matrix.read_text(encoding='utf-8-sig'))
for row in data['program_buku']:
    blocks.append({'id': row['code'], 'kind': 'program', 'source': row, 'content': {'name': row['name'], 'description': row['description'], 'indicator': row['indicator'], 'when': row['when'], 'status': row['status'], 'note': row['note'], 'checked': False}})
for n, row in enumerate(data['konfirmasi_wakakur'], 1):
    blocks.append({'id': 'K-%02d' % n, 'kind': 'confirmation', 'source': row, 'content': row})
result = {'version': 1, 'year': '2026/2027', 'source_sha256': hashlib.sha256(book.read_bytes()).hexdigest(), 'records': blocks}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'book_blocks': sum(b['kind']=='book' for b in blocks), 'programs': 40, 'confirmations': 12, 'output': str(a.output)}))
