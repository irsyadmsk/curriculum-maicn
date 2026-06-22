const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('A')); // exclude Akalender

const indexContent = fs.readFileSync('index.html', 'utf8');

// Extract modals from index.html
const modalLoginStart = indexContent.indexOf('<!-- ══ MODAL: LOGIN ══ -->');
const modalAdminEnd = indexContent.indexOf('<script>', modalLoginStart);
const modalsHtml = indexContent.substring(modalLoginStart, modalAdminEnd).trim();

files.forEach(filepath => {
    if (filepath === 'index.html') return;
    let content = fs.readFileSync(filepath, 'utf8');

    if (!content.includes('modal-login')) {
        content = content.replace('</body>', '\n' + modalsHtml + '\n</body>');
        fs.writeFileSync(filepath, content, 'utf8');
    }
});

console.log("Modals injected!");
