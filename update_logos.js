const fs = require('fs');
const path = require('path');

const files = [
    'about.html', 'achievements.html', 'admin-billing.html', 'admin-customers.html',
    'admin-inventory.html', 'admin-products.html', 'admin-reports.html', 
    'admin-settings.html', 'careers.html', 'clients.html', 'construction.html',
    'contact.html', 'gallery.html', 'index.html', 'services.html'
];

const newHeader = `<a href="index.html" class="logo-text" style="display: flex; align-items: center; gap: 12px;">
                    <img src="logo.png" alt="RMK Groups" style="height: 60px; width: auto;">
                    <span>RMK <span>GROUPS</span></span>
                </a>`;

const newFooter = `<a href="index.html" class="logo-text" style="margin-bottom: 2rem; display: flex; align-items: center; gap: 10px;">
                        <img src="logo.png" alt="RMK Groups" style="height: 50px; width: auto; filter: brightness(0) invert(1);">
                        <span style="color: white;">RMK <span style="color: var(--primary-light);">GROUPS</span></span>
                    </a>`;

const headerRegex1 = /<a href="index\.html" class="(?:logo-text|logo-brand)"[^>]*>[\s\S]*?<img src="logo\.png"[^>]*>[\s\S]*?<span>RMK <span>GROUPS<\/span><\/span>[\s\S]*?<\/a>/g;
const headerRegex2 = /<a href="index\.html" class="logo-brand">[\s\S]*?<img src="logo\.png"[^>]*>[\s\S]*?<\/a>/g;
const footerRegex = /<a href="index\.html" class="logo-text" style="margin-bottom: 2rem; display: block;">[\s\S]*?RMK <span>GROUPS<\/span>[\s\S]*?<\/a>/g;

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(headerRegex1, newHeader);
        content = content.replace(headerRegex2, newHeader);
        content = content.replace(footerRegex, newFooter);
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file}`);
    }
});
