import os
import re

html_files = [
    'index.html',
    'profil.html',
    'struktur.html',
    'kalender.html',
    'prota.html',
    'posem.html',
    'dokumen.html'
]

nav_html = """
<nav class="top-nav">
  <a href="index.html" class="nav-brand">
    <img src="assets/iconmaicn.png" alt="Logo" style="height:24px;">
    Portal Kurikulum
  </a>
  <button class="hamburger">☰</button>
  <div class="nav-links">
    <a href="index.html">Beranda</a>
    <a href="profil.html">Profil</a>
    <a href="struktur.html">Struktur</a>
    <a href="kalender.html">Kalender</a>
    <a href="prota.html">Prota</a>
    <a href="posem.html">Posem</a>
    <a href="dokumen.html">Dokumen</a>
  </div>
</nav>
"""

footer_html = """
<footer class="footer">
  <div class="wrap" style="text-align: center; line-height: 1.5;">
    <strong>MA Insan Cendekia Nusantara Purwakarta</strong> &middot; Portal Kurikulum<br>
    Waka Kurikulum: Muhammad Irsyad Sirojul Khoeir, S.Sos., M.Sos.
  </div>
</footer>
"""

head_injections = """
<link rel="stylesheet" href="assets/styles.css">
<script src="data.js"></script>
<script src="assets/app.js"></script>
"""

for file in html_files:
    if not os.path.exists(file):
        # Create dummy file if not exists
        with open(file, 'w', encoding='utf-8') as f:
            f.write(f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{file.split('.')[0].title()} — Portal Kurikulum MA ICN</title>
</head>
<body>
<div class="hdr">
  <div class="backbar"><div class="wrap"><a href="index.html">&larr; Beranda Portal Kurikulum</a></div></div>
  <div class="wrap hdr-top">
    <div class="eyebrow">{file.split('.')[0].title()}</div>
    <h1>Judul Halaman {file.split('.')[0].title()}</h1>
  </div>
</div>
<div class="wrap section">
  <p>Konten halaman belum tersedia.</p>
</div>
</body>
</html>
""")
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Inject into head if not already there
    if 'assets/styles.css' not in content:
        content = content.replace('</head>', head_injections + '</head>')
    
    # Inject nav if not already there
    if '<nav class="top-nav">' not in content:
        content = content.replace('<body>', '<body>\n' + nav_html)
    
    # Replace old footer or insert new one
    if 'class="footer"' in content:
        # Replace the entire footer div
        content = re.sub(r'<div class="footer">.*?</div>', footer_html, content, flags=re.DOTALL)
        content = re.sub(r'<footer class="footer">.*?</footer>', footer_html, content, flags=re.DOTALL)
    else:
        # Insert before </body>
        content = content.replace('</body>', footer_html + '\n</body>')
    
    # Write back
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Injections complete.")
