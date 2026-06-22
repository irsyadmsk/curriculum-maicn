import os
import glob

html_files = glob.glob('*.html')

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add <a href="matrikulasi.html">Matrikulasi</a>
    # We find where `<a href="posem.html">Posem</a>` is and insert after it.
    if 'posem.html' in content and 'matrikulasi.html' not in content:
        if '<a href="posem.html">Posem</a>' in content:
            content = content.replace(
                '<a href="posem.html">Posem</a>',
                '<a href="posem.html">Posem</a>\n    <a href="matrikulasi.html">Matrikulasi</a>\n    <a href="jadwal.html">Jadwal Harian</a>'
            )
        elif '<a href="posem.html" class="active">Posem</a>' in content:
             content = content.replace(
                '<a href="posem.html" class="active">Posem</a>',
                '<a href="posem.html" class="active">Posem</a>\n    <a href="matrikulasi.html">Matrikulasi</a>\n    <a href="jadwal.html">Jadwal Harian</a>'
            )
    
    # Check if nav-right exists
    if '<div class="nav-right">' not in content:
        # It's probably just the toggle button
        if '<button class="nav-toggle" id="nav-toggle">☰</button>' in content:
            content = content.replace(
                '<button class="nav-toggle" id="nav-toggle">☰</button>',
                '<div class="nav-right">\n    <button class="btn-login-nav" id="btn-login-nav">Masuk</button>\n    <button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>\n  </div>'
            )
        elif '<button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>' in content:
            content = content.replace(
                '<button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>',
                '<div class="nav-right">\n    <button class="btn-login-nav" id="btn-login-nav">Masuk</button>\n    <button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>\n  </div>'
            )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Navbars updated!")
