const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('A')); // exclude Akalender

files.forEach(filepath => {
    let content = fs.readFileSync(filepath, 'utf8');

    if (content.includes('posem.html') && !content.includes('matrikulasi.html')) {
        content = content.replace('<a href="posem.html">Posem</a>', '<a href="posem.html">Posem</a>\n    <a href="matrikulasi.html">Matrikulasi</a>\n    <a href="jadwal.html">Jadwal Harian</a>');
        content = content.replace('<a href="posem.html" class="active">Posem</a>', '<a href="posem.html" class="active">Posem</a>\n    <a href="matrikulasi.html">Matrikulasi</a>\n    <a href="jadwal.html">Jadwal Harian</a>');
    }

    if (!content.includes('<div class="nav-right">')) {
        content = content.replace('<button class="nav-toggle" id="nav-toggle">☰</button>', '<div class="nav-right">\n    <button class="btn-login-nav" id="btn-login-nav">Masuk</button>\n    <button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>\n  </div>');
        content = content.replace('<button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>', '<div class="nav-right">\n    <button class="btn-login-nav" id="btn-login-nav">Masuk</button>\n    <button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>\n  </div>');
    }

    fs.writeFileSync(filepath, content, 'utf8');
});

console.log("Navbars updated!");
