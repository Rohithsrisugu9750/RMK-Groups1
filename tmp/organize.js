const fs = require('fs');
const path = require('path');

const files = [
    'admin-attendance.html',
    'admin-billing.html',
    'admin-create-invoice.html',
    'admin-create-quote.html',
    'admin-customers.html',
    'admin-inventory.html',
    'admin-products.html',
    'admin-record-payment.html',
    'admin-reports.html',
    'admin-settings.html',
    'admin-workers.html'
];

files.forEach(f => {
    const filePath = path.join(__dirname, '..', f);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/admin_billing\.html/g, 'admin-billing.html')
                         .replace(/admin_customers\.html/g, 'admin-customers.html')
                         .replace(/admin_products\.html/g, 'admin-products.html')
                         .replace(/admin_inventory\.html/g, 'admin-inventory.html')
                         .replace(/admin_reports\.html/g, 'admin-reports.html')
                         .replace(/admin_workers\.html/g, 'admin-workers.html')
                         .replace(/admin_attendance\.html/g, 'admin-attendance.html')
                         .replace(/admin_settings\.html/g, 'admin-settings.html')
                         .replace(/admin_create-invoice\.html/g, 'admin-create-invoice.html')
                         .replace(/admin_create-quote\.html/g, 'admin-create-quote.html')
                         .replace(/admin_record-payment\.html/g, 'admin-record-payment.html');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated links in ${f}`);
    }
});

const dupFiles = [
    'admin_attendance.html',
    'admin_billing.html',
    'admin_create-invoice.html',
    'admin_create-quote.html',
    'admin_customers.html',
    'admin_inventory.html',
    'admin_products.html',
    'admin_record-payment.html',
    'admin_reports.html',
    'admin_settings.html',
    'admin_workers.html'
];

dupFiles.forEach(df => {
    const filePath = path.join(__dirname, '..', df);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted duplicate file ${df}`);
    }
});
