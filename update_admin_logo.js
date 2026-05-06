const fs = require('fs');
const path = require('path');

const adminFiles = [
    'admin-billing.html', 'admin-customers.html', 'admin-inventory.html',
    'admin-products.html', 'admin-reports.html', 'admin-settings.html',
    'admin-workers.html', 'admin-attendance.html'
];

// Fix admin logo to include new image + text + Admin badge
const adminLogoOld = /<div class="admin-logo">[\s\S]*?<img src="logo\.png"[^>]*>[\s\S]*?<span class="logo-text">[\s\S]*?<\/span>[\s\S]*?<span class="admin-badge">Admin<\/span>[\s\S]*?<\/div>/;
const adminLogoNew = `<div class="admin-logo">
                <img src="logo.png" alt="RMK Groups" style="height: 50px; width: auto;">
                <span class="admin-badge">Admin</span>
            </div>`;

let updatedCount = 0;
adminFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    content = content.replace(adminLogoOld, adminLogoNew);
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        updatedCount++;
        console.log(`  Updated admin logo: ${file}`);
    } else {
        console.log(`  [SKIP] Logo pattern not matched in: ${file}`);
    }
});
console.log(`Done. Updated ${updatedCount} files.`);
