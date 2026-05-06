// Email Configuration for RMK Groups
// All invoices will be sent to this single admin email

const EMAIL_CONFIG = {
    // Admin email that receives all invoices
    adminEmail: 'admin@rmkgroups.in',
    
    // WhatsApp number for admin (optional)
    adminWhatsApp: '+919876543210',
    
    // Email settings
    emailSettings: {
        subject: 'New Invoice - RMK Groups',
        from: 'billing@rmkgroups.in',
        replyTo: 'support@rmkgroups.in'
    },
    
    // Message templates
    templates: {
        emailSubject: (invoiceNumber) => `Invoice ${invoiceNumber} - RMK Groups`,
        emailBody: (invoiceNumber, customerName) => `
            Dear Admin,
            
            A new invoice has been generated:
            
            Invoice Number: ${invoiceNumber}
            Customer: ${customerName}
            
            Please find the invoice attached.
            
            Best regards,
            RMK Groups Billing System
        `,
        whatsappMessage: (invoiceNumber, customerName) => 
            `New Invoice Generated: ${invoiceNumber} for ${customerName} - RMK Groups`
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EMAIL_CONFIG;
} else {
    window.EMAIL_CONFIG = EMAIL_CONFIG;
}
