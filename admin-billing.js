// Admin Dashboard - Billing Module JavaScript
// RMK Groups - Professional Billing System

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function () {
    initializeDashboard();
    initializeQuoteModal();
    initializeTabs();
    initializeTableSearch();
    initializeFormCalculations();
    setDefaultDates();
});

// Dashboard Initialization
function initializeDashboard() {
    console.log('Admin Dashboard Initialized');

    // Add smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';

    // Animate stats on load
    animateStats();
}

// Animate statistics with counting effect
function animateStats() {
    const statValues = document.querySelectorAll('.stat-value');

    statValues.forEach(stat => {
        const text = stat.textContent;
        if (text.includes('₹')) {
            // Animate currency values
            const value = parseFloat(text.replace(/[₹,]/g, ''));
            animateValue(stat, 0, value, 1500, true);
        } else if (!isNaN(parseInt(text))) {
            // Animate numeric values
            const value = parseInt(text);
            animateValue(stat, 0, value, 1000, false);
        }
    });
}

function animateValue(element, start, end, duration, isCurrency) {
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const current = Math.floor(start + (end - start) * easeOutQuad(progress));

        if (isCurrency) {
            element.textContent = '₹' + current.toLocaleString('en-IN');
        } else {
            element.textContent = current;
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

function easeOutQuad(t) {
    return t * (2 - t);
}

// Quote Modal Management
function initializeQuoteModal() {
    const getQuoteBtn = document.getElementById('getQuoteBtn');
    const quoteModal = document.getElementById('quoteModal');
    const closeQuoteModal = document.getElementById('closeQuoteModal');
    const cancelQuoteBtn = document.getElementById('cancelQuoteBtn');
    const modalOverlay = document.querySelector('.modal-overlay');
    const quoteForm = document.getElementById('quoteForm');

    // Open modal
    getQuoteBtn.addEventListener('click', function () {
        quoteModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    // Close modal functions
    const closeModal = () => {
        quoteModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    closeQuoteModal.addEventListener('click', closeModal);
    cancelQuoteBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && quoteModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Form submission
    quoteForm.addEventListener('submit', function (e) {
        e.preventDefault();
        handleQuoteSubmission();
    });

    // Add product button
    const addProductBtn = document.getElementById('addProductBtn');
    addProductBtn.addEventListener('click', addProductRow);
}

// Add new product row
function addProductRow() {
    const productItems = document.getElementById('productItems');
    const newRow = document.createElement('div');
    newRow.className = 'product-item';
    newRow.innerHTML = `
        <div class="form-row">
            <div class="form-group flex-2">
                <label>Product *</label>
                <select class="form-control product-select" required>
                    <option value="">Select Product</option>
                    <option value="flyash">Fly Ash Bricks</option>
                    <option value="paver">Paver Blocks</option>
                    <option value="crusher">Crushers</option>
                    <option value="earthmover">Earth Movers</option>
                </select>
            </div>
            <div class="form-group">
                <label>Quantity *</label>
                <input type="number" class="form-control quantity-input" placeholder="0" required>
            </div>
            <div class="form-group">
                <label>Unit Price (₹) *</label>
                <input type="number" class="form-control price-input" placeholder="0.00" step="0.01" required>
            </div>
            <div class="form-group">
                <label>Amount (₹)</label>
                <input type="text" class="form-control amount-display" readonly value="0.00">
            </div>
            <div class="form-group-action">
                <button type="button" class="btn-icon-danger remove-product" title="Remove">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    productItems.appendChild(newRow);

    // Add event listeners to new row
    const quantityInput = newRow.querySelector('.quantity-input');
    const priceInput = newRow.querySelector('.price-input');
    const removeBtn = newRow.querySelector('.remove-product');

    quantityInput.addEventListener('input', calculateTotals);
    priceInput.addEventListener('input', calculateTotals);
    removeBtn.addEventListener('click', function () {
        newRow.remove();
        calculateTotals();
    });

    // Smooth scroll to new row
    newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Form Calculations
function initializeFormCalculations() {
    const gstToggle = document.getElementById('gstToggle');
    const gstRate = document.getElementById('gstRate');
    const quantityInputs = document.querySelectorAll('.quantity-input');
    const priceInputs = document.querySelectorAll('.price-input');

    // GST toggle
    gstToggle.addEventListener('change', function () {
        gstRate.disabled = !this.checked;
        calculateTotals();
    });

    // GST rate change
    gstRate.addEventListener('change', calculateTotals);

    // Product calculations
    quantityInputs.forEach(input => {
        input.addEventListener('input', calculateTotals);
    });

    priceInputs.forEach(input => {
        input.addEventListener('input', calculateTotals);
    });

    // Remove product buttons
    document.addEventListener('click', function (e) {
        if (e.target.closest('.remove-product')) {
            const productItem = e.target.closest('.product-item');
            const productItems = document.getElementById('productItems');

            // Keep at least one product row
            if (productItems.children.length > 1) {
                productItem.remove();
                calculateTotals();
            } else {
                showToast('At least one product is required', 'warning');
            }
        }
    });
}

// Calculate all totals
function calculateTotals() {
    const productItems = document.querySelectorAll('.product-item');
    let subtotal = 0;

    // Calculate each product amount
    productItems.forEach(item => {
        const quantity = parseFloat(item.querySelector('.quantity-input').value) || 0;
        const price = parseFloat(item.querySelector('.price-input').value) || 0;
        const amount = quantity * price;

        item.querySelector('.amount-display').value = amount.toFixed(2);
        subtotal += amount;
    });

    // Calculate GST
    const gstToggle = document.getElementById('gstToggle');
    const gstRate = document.getElementById('gstRate');
    let gstAmount = 0;

    if (gstToggle.checked) {
        const rate = parseFloat(gstRate.value) || 0;
        gstAmount = (subtotal * rate) / 100;
    }

    const total = subtotal + gstAmount;

    // Update display
    document.getElementById('subtotalAmount').textContent = '₹' + subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('gstPercentage').textContent = gstToggle.checked ? gstRate.value : '0';
    document.getElementById('gstAmount').textContent = '₹' + gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('totalAmount').textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Set default dates
function setDefaultDates() {
    const today = new Date();
    const quoteDate = document.getElementById('quoteDate');
    const validityDate = document.getElementById('validityDate');

    // Set today's date
    quoteDate.value = today.toISOString().split('T')[0];

    // Set validity date to 14 days from today
    const validity = new Date(today);
    validity.setDate(validity.getDate() + 14);
    validityDate.value = validity.toISOString().split('T')[0];
}

// Handle quote submission
function handleQuoteSubmission() {
    const formData = new FormData(document.getElementById('quoteForm'));

    // Collect product data
    const products = [];
    document.querySelectorAll('.product-item').forEach(item => {
        const product = {
            name: item.querySelector('.product-select').value,
            quantity: item.querySelector('.quantity-input').value,
            price: item.querySelector('.price-input').value,
            amount: item.querySelector('.amount-display').value
        };
        products.push(product);
    });

    // Create quote object
    const quote = {
        id: Date.now(), // Unique ID for real-time tracking
        quoteNumber: document.getElementById('quoteNumber').value,
        customer: document.getElementById('customerName').value,
        quoteDate: document.getElementById('quoteDate').value,
        validityDate: document.getElementById('validityDate').value,
        products: products,
        gstEnabled: document.getElementById('gstToggle').checked,
        gstRate: document.getElementById('gstRate').value,
        subtotal: document.getElementById('subtotalAmount').textContent,
        gstAmount: document.getElementById('gstAmount').textContent,
        total: document.getElementById('totalAmount').textContent,
        notes: document.getElementById('notes').value,
        type: 'quote',
        createdAt: new Date().toISOString()
    };

    console.log('Quote Created:', quote);

    // Emit real-time event to all users
    if (window.realtimeManager) {
        window.realtimeManager.emitNewInvoice(quote);
    }

    // Save to localStorage/cloud
    const existingQuotes = JSON.parse(localStorage.getItem('rmk_quotes') || '[]');
    existingQuotes.unshift(quote);
    localStorage.setItem('rmk_quotes', JSON.stringify(existingQuotes));

    // Close modal
    document.getElementById('quoteModal').classList.remove('active');
    document.body.style.overflow = 'auto';

    // Show success toast
    showToast('Quote created successfully!', 'success');

    // Reset form
    document.getElementById('quoteForm').reset();
    setDefaultDates();
    calculateTotals();
}

// Tabs Management
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Table Search
function initializeTableSearch() {
    const searchInput = document.getElementById('searchInput');

    searchInput.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        const activeTab = document.querySelector('.tab-content.active');
        const rows = activeTab.querySelectorAll('.data-table tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('successToast');
    const icon = toast.querySelector('i');
    const text = toast.querySelector('span');

    // Set message
    text.textContent = message;

    // Set icon based on type
    if (type === 'success') {
        icon.className = 'fas fa-check-circle';
        toast.style.background = 'linear-gradient(135deg, #10B981, #059669)';
    } else if (type === 'warning') {
        icon.className = 'fas fa-exclamation-circle';
        toast.style.background = 'linear-gradient(135deg, #F59E0B, #D97706)';
    } else if (type === 'error') {
        icon.className = 'fas fa-times-circle';
        toast.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
    }

    // Show toast
    toast.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Action button handlers
document.addEventListener('click', function (e) {
    const target = e.target.closest('.action-btn');
    if (!target) return;

    if (target.classList.contains('view')) {
        handleViewAction(target);
    } else if (target.classList.contains('edit')) {
        handleEditAction(target);
    } else if (target.classList.contains('download')) {
        handleDownloadAction(target);
    } else if (target.classList.contains('share')) {
        handleShareAction(target);
    } else if (target.classList.contains('convert')) {
        handleConvertAction(target);
    }
});

function handleViewAction(button) {
    const row = button.closest('tr');
    const invoiceNumber = row.querySelector('td:first-child strong').textContent;
    console.log('View:', invoiceNumber);
    showToast(`Viewing ${invoiceNumber}`, 'success');
}

function handleEditAction(button) {
    const row = button.closest('tr');
    const quoteNumber = row.querySelector('td:first-child strong').textContent;
    console.log('Edit:', quoteNumber);
    showToast(`Editing ${quoteNumber}`, 'success');
}

function handleDownloadAction(button) {
    const row = button.closest('tr');
    const documentNumber = row.querySelector('td:first-child strong').textContent;
    console.log('Download:', documentNumber);
    showToast(`Downloading ${documentNumber} as PDF`, 'success');

    // In a real application, this would trigger a PDF download
    // For demonstration, we'll simulate a download
    setTimeout(() => {
        showToast('PDF downloaded successfully!', 'success');
    }, 1500);
}

function handleShareAction(button) {
    const row = button.closest('tr');
    const documentNumber = row.querySelector('td:first-child strong').textContent;
    const customerName = row.querySelector('.customer-info span').textContent;

    console.log('Share:', documentNumber);

    // Get admin email from config
    const adminEmail = window.EMAIL_CONFIG?.adminEmail || 'admin@rmkgroups.in';
    const adminWhatsApp = window.EMAIL_CONFIG?.adminWhatsApp || '+919876543210';

    // Show share options - ALL INVOICES GO TO ONE PERSON (ADMIN)
    const shareOptions = confirm(`Send ${documentNumber} to ADMIN?\n\nAdmin Email: ${adminEmail}\n\nChoose:\nOK - WhatsApp\nCancel - Email`);

    if (shareOptions) {
        // WhatsApp sharing
        const message = window.EMAIL_CONFIG?.templates?.whatsappMessage(documentNumber, customerName) || 
                       `New Invoice: ${documentNumber} for ${customerName}`;
        showToast(`Sending ${documentNumber} via WhatsApp to ADMIN (${adminWhatsApp})`, 'success');
        // In real app: window.open(`https://wa.me/${adminWhatsApp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`);
    } else {
        // Email sharing
        const subject = window.EMAIL_CONFIG?.templates?.emailSubject(documentNumber) || `Invoice ${documentNumber} - RMK Groups`;
        const body = window.EMAIL_CONFIG?.templates?.emailBody(documentNumber, customerName) || 
                    `Please find invoice ${documentNumber} for ${customerName} attached.`;
        
        showToast(`Sending ${documentNumber} via Email to ADMIN (${adminEmail})`, 'success');
        // In real app: window.location.href = `mailto:${adminEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
}

function handleConvertAction(button) {
    const row = button.closest('tr');
    const quoteNumber = row.querySelector('td:first-child strong').textContent;

    const confirm = window.confirm(`Convert ${quoteNumber} to Invoice?`);

    if (confirm) {
        console.log('Converting:', quoteNumber);
        showToast(`${quoteNumber} converted to invoice successfully!`, 'success');

        // In a real application, this would update the database
        // and redirect to the invoice page
    }
}

// Customer selection handler
document.getElementById('customerName')?.addEventListener('change', function () {
    if (this.value === 'new') {
        // In a real application, this would open a modal to add a new customer
        showToast('Add New Customer feature coming soon!', 'info');
        this.value = '';
    }
});

// Smooth hover effects for cards
document.querySelectorAll('.stat-card, .service-card, .data-table tbody tr').forEach(element => {
    element.addEventListener('mouseenter', function () {
        this.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
});

// Auto-generate quote number
function generateQuoteNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `#QT-${year}-${random}`;
}

// Initialize quote number on page load
if (document.getElementById('quoteNumber')) {
    // Keep the default value for demo, but in production you'd generate it
    // document.getElementById('quoteNumber').value = generateQuoteNumber();
}

// Print functionality
function printDocument(documentId) {
    window.print();
}

// Export to Excel (placeholder)
function exportToExcel() {
    showToast('Exporting to Excel...', 'success');
    // In a real application, this would generate and download an Excel file
}

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
    // Ctrl/Cmd + Q = Open Quote Modal
    if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
        e.preventDefault();
        document.getElementById('getQuoteBtn').click();
    }

    // Ctrl/Cmd + I = Open Invoice Modal
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        document.getElementById('createInvoiceBtn')?.click();
    }
});

console.log('RMK Groups Admin Dashboard - Billing Module Loaded');
console.log('Keyboard Shortcuts:');
console.log('- Ctrl/Cmd + Q: Create Quote');
console.log('- Ctrl/Cmd + I: Create Invoice');
console.log('- Esc: Close Modal');
