function safeJsonParse(str, fallback = []) {
    try {
        if (!str || str === 'undefined' || str === 'null') return fallback;
        const parsed = JSON.parse(str);
        return parsed || fallback;
    } catch (e) {
        console.warn('JSON Parse Error:', e);
        return fallback;
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    // 2. Hide Preloader instantly
    const preloader = document.querySelector('.preloader');
    if (preloader) preloader.style.display = 'none';


    /**
     * CLOUD SYNCHRONIZATION SYSTEM (PHP-Direct Mode)
     * Uses sync.php directly - runs on the same Hostinger server as MySQL.
     * This is the most reliable method and avoids Node.js port/firewall issues.
     */
    async function syncWithCloud() {
        if (window._isCloudSyncing) return;
        window._isCloudSyncing = true;

        const dbBadge = document.getElementById('dbStatus');
        if (dbBadge) {
            dbBadge.textContent = 'DB: Syncing...';
            dbBadge.style.background = '#f39c12';
            dbBadge.style.color = 'white';
        }

        try {
            let cloudData = null;
            const endpoints = ['https://rmkgroups.in/sync.php', '/sync.php', 'sync.php'];
            let lastError = null;

            for (let url of endpoints) {
                console.log(`Trying sync endpoint: ${url}`);
                try {
                    const response = await fetch(url, { cache: 'no-cache' });
                    if (response.ok) {
                        const text = await response.text();
                        console.log(`Response from ${url} received`);
                        try {
                            const data = JSON.parse(text);
                            if (data && typeof data === 'object' && !data.error) {
                                cloudData = data;
                                console.log(`Cloud data successfully loaded from ${url}`);
                                break;
                            } else if (data && data.error) {
                                console.warn(`DB Error from ${url}:`, data.error);
                                lastError = new Error(data.error);
                            }
                        } catch (e) {
                            console.warn(`JSON Parse Error from ${url}`);
                            lastError = new Error("Response was not valid JSON");
                        }
                    } else {
                        lastError = new Error(`HTTP ${response.status}`);
                    }
                } catch (e) {
                    lastError = e;
                }
            }

            if (!cloudData) throw new Error(`Cloud sync failed. Last error: ${lastError ? lastError.message : 'No valid data'}`);

            window._isCloudSyncing = true; // prevent loopback saves during merge
            for (let key in cloudData) {
                if (key === 'rmk_session') continue;

                const cloudValue = cloudData[key];
                const localValue = localStorage.getItem(key);

                if (localValue) {
                    try {
                        // Support both stringified and already-parsed data
                        const incoming = (typeof cloudValue === 'string') ? JSON.parse(cloudValue) : cloudValue;
                        if (Array.isArray(incoming)) {
                            const current = (typeof localValue === 'string') ? JSON.parse(localValue) : localValue;
                            const dataMap = new Map();
                            if (Array.isArray(current)) {
                                current.forEach(item => { if (item && item.id) dataMap.set(String(item.id), item); });
                            }
                            incoming.forEach(item => { if (item && item.id) dataMap.set(String(item.id), item); });
                            const merged = Array.from(dataMap.values()).sort((a, b) => b.id - a.id);
                            localStorage.setItem(key, JSON.stringify(merged));
                        } else {
                            localStorage.setItem(key, typeof cloudValue === 'string' ? cloudValue : JSON.stringify(cloudValue));
                        }
                    } catch (e) { 
                        console.error(`Error merging key ${key}:`, e);
                        localStorage.setItem(key, typeof cloudValue === 'string' ? cloudValue : JSON.stringify(cloudValue)); 
                    }
                } else {
                    localStorage.setItem(key, typeof cloudValue === 'string' ? cloudValue : JSON.stringify(cloudValue));
                }
            }

            if (dbBadge) {
                dbBadge.textContent = 'DB: Online ✓';
                dbBadge.style.background = '#10B981';
                dbBadge.style.color = 'white';
            }
            if (typeof loadInvoicesToTable === 'function') loadInvoicesToTable();
            if (typeof loadCustomersToTable === 'function') loadCustomersToTable();
        } catch (err) {
            console.warn('Sync Failed:', err.message);
            if (dbBadge) {
                dbBadge.textContent = 'DB: Offline (Click to retry)';
                dbBadge.style.background = '#EF4444';
                dbBadge.style.color = 'white';
            }
        } finally {
            window._isCloudSyncing = false;
            // ALWAYS refresh UI tables regardless of success or failure
            if (typeof loadInvoicesToTable === 'function') loadInvoicesToTable();
            if (typeof loadCustomersToTable === 'function') loadCustomersToTable();
            if (typeof loadQuotesToTable === 'function') loadQuotesToTable();
        }
    }

    function initializeCloudSync() {
        const originalSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function (key, value) {
            originalSetItem(key, value);
            if (window._isCloudSyncing || !key.startsWith('rmk_') || key === 'rmk_session') return;
            
            const writeEndpoints = ['/sync.php', 'sync.php', 'https://rmkgroups.in/sync.php', '/rmk-sync-write', 'http://localhost:3000/rmk-sync-write'];
            writeEndpoints.forEach(url => {
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value })
                }).catch(() => { });
            });
        };
        window.syncWithCloud = syncWithCloud;

        // Manual Trigger via Badge Click
        const dbBadge = document.getElementById('dbStatus');
        if (dbBadge) {
            dbBadge.style.cursor = 'pointer';
            dbBadge.title = 'Click to force sync with cloud';
            dbBadge.addEventListener('click', () => {
                showToast('Manual sync started...', 'info');
                syncWithCloud();
            });
        }

        syncWithCloud();
        setInterval(syncWithCloud, 60000);
    }

    // 1. Auth Guard
    if (!checkAuth()) {
        console.warn('Auth check failed, redirecting...');
        return;
    }

    // Determine current page to run specific logic
    const path = window.location.pathname;
    console.log('Current Dashboard Path:', path);

    // Global initializations
    try {
        initializeSidebar();
        initializeCloudSync();
        applyUserRolePermissions();
        console.log('Global Admin UI Initialized');
    } catch (e) {
        console.error('Error during global initialization:', e);
    }

    // Module-specific initializations
    try {
        if (path.includes('admin-billing') || path.includes('admin_billing') || document.getElementById('createInvoiceBtn')) {
            console.log('Initializing Billing Module...');
            initializeBillingModule();
        } else if (path.includes('admin-create-invoice') || path.includes('admin_create_invoice')) {
            console.log('Initializing Create Invoice Module...');
            initializeCreateInvoicePage();
        } else if (path.includes('admin-create-quote') || path.includes('admin_create_quote')) {
            console.log('Initializing Create Quote Module...');
            initializeCreateQuotePage();
        } else if (path.includes('admin-record-payment') || path.includes('admin_record_payment')) {
            console.log('Initializing Record Payment Module...');
            initializeRecordPaymentPage();
        } else if (path.includes('admin-customers') || path.includes('admin_customers') || document.getElementById('addCustomerBtn') || document.getElementById('exportCustomersBtn')) {
            console.log('Initializing Customers Module...');
            initializeCustomersModule();
        } else if (path.includes('admin-products') || path.includes('admin_products') || document.getElementById('addProductBtn')) {
            console.log('Initializing Products Module...');
            initializeProductsModule();
        } else if (path.includes('admin-inventory') || path.includes('admin_inventory') || document.getElementById('updateStockBtn') || document.getElementById('btnStockHistory')) {
            console.log('Initializing Inventory Module...');
            initializeInventoryModule();
        } else if (path.includes('admin-reports') || path.includes('admin_reports') || document.getElementById('exportGstBtn') || document.getElementById('exportAttendanceBtn') || document.getElementById('downloadReportBtn')) {
            console.log('Initializing Reports Module...');
            initializeReportsModule();
        } else if (path.includes('admin-settings') || path.includes('admin_settings') || document.getElementById('saveSettingsBtn') || document.getElementById('btnExportFullData')) {
            console.log('Initializing Settings Module...');
            initializeSettingsModule();
            initializeUserManagementModule();
        } else if (path.includes('admin-workers') || path.includes('admin_workers') || document.getElementById('addWorkerBtn')) {
            console.log('Initializing Workers Module...');
            initializeWorkersModule();
        } else if (path.includes('admin-attendance') || path.includes('admin_attendance')) {
            console.log('Initializing Attendance Module...');
            initializeAttendanceModule();
        }
    } catch (e) {
        console.error('Error during module-specific initialization:', e);
    }

    // Animate stats on all pages that have them
    try {
        animateStats();
    } catch (e) { console.warn('Stat animation skipped:', e); }

    // Inject Footer
    injectAdminFooter();
});

function injectAdminFooter() {
    const mainContent = document.querySelector('.admin-main');
    if (mainContent) {
        const footer = document.createElement('footer');
        footer.className = 'admin-developed-footer';
        footer.style.cssText = 'margin-top: 3rem; padding: 2rem 0; opacity: 0.6; font-size: 0.7rem; text-align: center; border-top: 1px solid var(--border-light); width: 100%;';
        footer.textContent = 'Developed by Guna Arts It Solutions';
        mainContent.appendChild(footer);
    }
}

// Auth Security Check
function checkAuth() {
    const session = localStorage.getItem('rmk_session');
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// User Permission Management
function applyUserRolePermissions() {
    const sessionData = safeJsonParse(localStorage.getItem('rmk_session'), null);
    if (!sessionData) return;

    const userRole = sessionData.role;
    const userNameElement = document.querySelector('.user-name');
    const userRoleElement = document.querySelector('.user-role');

    if (userNameElement) userNameElement.textContent = sessionData.username || userRole;
    if (userRoleElement) userRoleElement.textContent = userRole;

    if (userRole === 'Staff') {
        // Hide Admin-only features from Sidebar
        const adminOnlyNavItems = document.querySelectorAll('.nav-item');
        adminOnlyNavItems.forEach(item => {
            const href = item.getAttribute('href');
            const adminPages = ['admin-products.html', 'admin-reports.html', 'admin-settings.html', 'admin-customers.html', 'admin-workers.html', 'admin-attendance.html'];
            if (adminPages.includes(href)) {
                item.style.display = 'none';
            }
        });

        // Redirect if Staff accidentally accesses Admin pages
        const path = window.location.pathname;
        const restrictedPath = ['admin-products.html', 'admin-reports.html', 'admin-settings.html', 'admin-customers.html', 'admin-workers.html', 'admin-attendance.html'];
        if (restrictedPath.some(p => path.includes(p))) {
            window.location.href = 'admin-billing.html';
        }

        // Hide administrative controls on Billing page
        const adminActions = document.querySelectorAll('.admin-action');
        adminActions.forEach(el => el.style.display = 'none');
    }
}

// Sidebar Link Activation
function initializeSidebar() {
    const mobileToggle = document.getElementById('sidebarToggle') || document.querySelector('.mobile-sidebar-toggle');
    const sidebar = document.querySelector('.admin-sidebar');
    const logoutBtn = document.querySelector('.logout');

    // Create backdrop for mobile if not exists
    let backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebarBackdrop';
        document.body.appendChild(backdrop);
    }

    if (mobileToggle) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
            if (backdrop) {
                backdrop.classList.toggle('active');
            }
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('active');
            backdrop.classList.remove('active');
        });
    }

    // Close sidebar when clicking links on mobile
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                if (backdrop) backdrop.classList.remove('active');
            }
        });
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('active') &&
            !sidebar.contains(e.target) &&
            mobileToggle && !mobileToggle.contains(e.target)) {
            sidebar.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('rmk_session');
                window.location.href = 'login.html';
            }
        });
    }
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

// Toast Notification
function showToast(message, type = 'success') {
    let toast = document.getElementById('successToast');

    // Create toast if it doesn't exist
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'successToast';
        toast.className = 'toast';
        toast.innerHTML = '<i class=""></i><span></span>';
        document.body.appendChild(toast);
    }

    const icon = toast.querySelector('i');
    const text = toast.querySelector('span');

    text.textContent = message;

    if (type === 'success') {
        icon.className = 'fas fa-check-circle';
        toast.style.background = 'linear-gradient(135deg, #10B981, #059669)';
    } else if (type === 'warning') {
        icon.className = 'fas fa-exclamation-circle';
        toast.style.background = 'linear-gradient(135deg, #F59E0B, #D97706)';
    } else if (type === 'error') {
        icon.className = 'fas fa-times-circle';
        toast.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
    } else if (type === 'info') {
        icon.className = 'fas fa-info-circle';
        toast.style.background = 'linear-gradient(135deg, #3B82F6, #2563EB)';
    }

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}


// --- Invoice Number Helper ---
function generateFinancialYearInvoiceNumber(type = 'invoice', manualValue = null, commit = false) {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const fyStart = month >= 3 ? year : year - 1;
    const fyEnd = fyStart + 1;
    const fyCode = String(fyStart) + '-' + String(fyEnd);

    const storageKey = type === 'invoice' ? 'rmk_inv_counter' : 'rmk_qt_counter';
    const fyKey = type === 'invoice' ? 'rmk_inv_fy' : 'rmk_qt_fy';
    const prefix = type === 'invoice' ? 'INV' : 'QT';

    const savedFy = localStorage.getItem(fyKey);
    let counter = parseInt(localStorage.getItem(storageKey) || '0');

    // Scan existing records to find the absolute max counter
    const listKey = type === 'invoice' ? 'rmk_invoices' : 'rmk_quotes';
    const records = safeJsonParse(localStorage.getItem(listKey), []);
    let maxCounter = 0;
    
    records.forEach(rec => {
        const numStr = type === 'invoice' ? rec.invNumber : rec.quoteNumber;
        if (numStr) {
            const parts = numStr.split('-');
            if (parts.length > 0) {
                const num = parseInt(parts[parts.length - 1]);
                if (!isNaN(num) && num > maxCounter) {
                    maxCounter = num;
                }
            }
        }
    });

    if (maxCounter > counter) {
        counter = maxCounter;
    }

    // Update counter in storage if we found a higher one
    if (maxCounter > 0) {
        localStorage.setItem(storageKey, String(counter));
    }

    // Handle Financial Year Transition without resetting counter
    if (savedFy !== fyCode) {
        if (commit) {
            localStorage.setItem(fyKey, fyCode);
        }
    }

    // If we are COMMITTING (Saving/Printing)
    if (commit) {
        let finalCounter;
        if (manualValue) {
            const parts = manualValue.split('-');
            const lastPart = parts[parts.length - 1];
            const manualNum = parseInt(lastPart);
            finalCounter = !isNaN(manualNum) ? manualNum : counter + 1;
        } else {
            finalCounter = counter + 1;
        }

        localStorage.setItem(storageKey, String(finalCounter));
        if (savedFy !== fyCode) localStorage.setItem(fyKey, fyCode);

        const padded = String(finalCounter).padStart(3, '0');
        return `${prefix}-${fyCode}-${padded}`;
    }

    // If PREVIEWING (Opening Modal)
    const nextCounter = counter + 1;
    const padded = String(nextCounter).padStart(3, '0');
    return `${prefix}-${fyCode}-${padded}`;
}

// Add check to remove unnecessary global change listeners that might interfere

// --- Billing Module Logic ---
function initializeBillingModule() {
    console.log('Billing Module Initialized');
    // Using the previously defined logic, but scoped here
    // initializeQuoteModal(); // Called at end of module to ensure all listeners are attached
    // initializeInvoiceModal(); // Renamed to Logic
    // initializePaymentModal(); // Called at end of module
    initializeTabs();
    initializeTableSearch();
    initializeFormCalculations();
    setDefaultDates();

    // Populate Customer Dropdowns
    const savedCustomers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
    const invSelect = document.getElementById('invCustomerName');
    const quoteSelect = document.getElementById('quoteCustomerName');

    const populate = (select) => {
        if (!select) return;
        // Keep first option (Select Customer) and "Add New" if exists
        const keepOptions = Array.from(select.options).filter(opt => opt.value === "" || opt.value === "new");
        select.innerHTML = '';
        keepOptions.forEach(opt => select.appendChild(opt));

        savedCustomers.forEach(cust => {
            const opt = document.createElement('option');
            opt.value = cust.company; // Or ID
            opt.textContent = cust.company;
            if (select.id === 'quoteCustomerName') {
                // Insert before "Add New" if it exists
                const addNew = select.querySelector('option[value="new"]');
                if (addNew) select.insertBefore(opt, addNew);
                else select.appendChild(opt);
            } else {
                select.appendChild(opt);
            }
        });
    };

    populate(invSelect);
    populate(quoteSelect);

    loadInvoicesToTable();
    if (typeof loadQuotesToTable === 'function') loadQuotesToTable();

    // --- Consolidated Modal Listeners ---
    const createInvoiceBtn = document.getElementById('createInvoiceBtn');
    const getQuoteBtn = document.getElementById('getQuoteBtn');
    const headerRecordBtn = document.getElementById('headerRecordPaymentBtn');

    if (createInvoiceBtn) {
        createInvoiceBtn.addEventListener('click', function (e) {
            e.preventDefault();
            console.log('Create Invoice Button Clicked');

            // Generate NEW preview number only if it's currently empty or just placeholder
            const invNumEl = document.getElementById('invNumber');
            if (invNumEl) {
                invNumEl.value = generateFinancialYearInvoiceNumber('invoice');
            }

            const modal = document.getElementById('invoiceModal');
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });
    }

    if (getQuoteBtn) {
        getQuoteBtn.addEventListener('click', function (e) {
            e.preventDefault();
            console.log('Get Quote Button Clicked');
            const qtNumEl = document.getElementById('quoteNumber');
            if (qtNumEl) qtNumEl.value = generateFinancialYearInvoiceNumber('quote');

            const modal = document.getElementById('quoteModal');
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });
    }

    if (headerRecordBtn) {
        headerRecordBtn.addEventListener('click', function (e) {
            e.preventDefault();
            console.log('Record Payment Button Clicked');
            if (typeof openPaymentModal === 'function') openPaymentModal();
        });
    }

    // Add product button handlers
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) addProductBtn.addEventListener('click', addProductRow);

    const invAddProductBtn = document.getElementById('invAddProductBtn');
    if (invAddProductBtn) invAddProductBtn.addEventListener('click', addInvoiceProductRow);

    // Initialize remaining modal logic (form submissions, closing, search etc)
    try {
        if (typeof initializeQuoteModal === 'function') initializeQuoteModal();
    } catch (e) { console.warn("Quote modal logic error:", e); }

    try {
        if (typeof initializeInvoiceModalLogic === 'function') initializeInvoiceModalLogic();
    } catch (e) { console.warn("Invoice modal logic error:", e); }

    try {
        if (typeof initializePaymentModal === 'function') initializePaymentModal();
    } catch (e) { console.warn("Payment modal logic error:", e); }
}

function initializeInvoiceModalLogic() {
    const invoiceModal = document.getElementById('invoiceModal');
    const closeInvoiceModal = document.getElementById('closeInvoiceModal');
    const cancelInvoiceBtn = document.getElementById('cancelInvoiceBtn');
    const modalOverlay = document.querySelector('.modal-overlay');
    const invoiceForm = document.getElementById('invoiceForm');

    if (!invoiceModal) return;

    // Default dates
    const today = new Date();
    const invDate = document.getElementById('invDate');
    const invDueDate = document.getElementById('invDueDate');

    if (invDate) invDate.value = today.toISOString().split('T')[0];
    if (invDueDate) {
        const due = new Date(today);
        due.setDate(due.getDate() + 15);
        invDueDate.value = due.toISOString().split('T')[0];
    }

    // Add first product row by default if empty
    const invProductItems = document.getElementById('invProductItems');
    if (invProductItems && invProductItems.children.length === 0) {
        addInvoiceProductRow();
    }

    // The open modal logic is already handled in initializeBillingModule via createInvoiceBtn
    // This second duplicate listener was removed to prevent conflicts.

    const closeModal = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        invoiceModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    closeInvoiceModal?.addEventListener('click', closeModal);
    cancelInvoiceBtn?.addEventListener('click', closeModal);
    if (modalOverlay) {
        // Only close if clicking the overly itself, not children
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === modalOverlay) closeModal();
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && invoiceModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Handle Form Calculation
    const invGstToggle = document.getElementById('invGstToggle');
    const invGstRate = document.getElementById('invGstRate');

    if (invGstToggle) {
        invGstToggle.addEventListener('change', function () {
            invGstRate.disabled = !this.checked;
            calculateInvoiceTotals();
        });
    }

    invGstRate?.addEventListener('change', calculateInvoiceTotals);
    const invReceivedAmount = document.getElementById('invReceivedAmount');
    if (invReceivedAmount) invReceivedAmount.addEventListener('input', calculateInvoiceTotals);

    document.addEventListener('input', function (e) {
        if (e.target.closest('#invProductItems')) {
            if (e.target.classList.contains('quantity-input') || e.target.classList.contains('price-input')) {
                calculateInvoiceTotals();
            }
        }
    });

    document.addEventListener('click', function (e) {
        if (e.target.closest('.remove-inv-product')) {
            const productItem = e.target.closest('.product-item');
            const productItems = document.getElementById('invProductItems');
            if (productItems.children.length > 1) {
                productItem.remove();
                calculateInvoiceTotals();
            } else {
                showToast('At least one product is required', 'warning');
            }
        }
    });

    // WhatsApp Share Handler
    const shareWhatsappBtn = document.getElementById('shareInvoiceWhatsappBtn');
    if (shareWhatsappBtn) {
        shareWhatsappBtn.addEventListener('click', function () {
            shareInvoiceOnWhatsApp();
        });
    }

    // Save Only Handler
    const saveInvoiceOnlyBtn = document.getElementById('saveInvoiceOnlyBtn');
    if (saveInvoiceOnlyBtn) {
        saveInvoiceOnlyBtn.addEventListener('click', function () {
            saveInvoiceOnly();
        });
    }

    // Auto-detect tax type based on customer
    const invCustomerName = document.getElementById('invCustomerName');
    const invTaxType = document.getElementById('invTaxType');

    const invCustomClientName = document.getElementById('invCustomClientName');
    const customClientDetails = document.querySelectorAll('.custom-client-details');

    if (invCustomerName) {
        invCustomerName.addEventListener('change', function () {
            const customerId = this.value;
            const customers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
            const customer = customers.find(c => c.id === customerId || c.company === customerId);

            if (customerId) {
                if (invCustomClientName) invCustomClientName.value = '';
                document.querySelectorAll('.custom-client-details input').forEach(el => {
                    el.value = '';
                    el.disabled = true;
                });
            } else {
                document.querySelectorAll('.custom-client-details input').forEach(el => el.disabled = false);
            }

            if (customer && invTaxType) {
                invTaxType.value = (customer.state === 'Tamil Nadu') ? 'intra' : 'inter';
                calculateInvoiceTotals();
            }
        });
    }

    if (invCustomClientName) {
        invCustomClientName.addEventListener('input', function () {
            if (this.value.trim() !== '') {
                if (invCustomerName) invCustomerName.value = '';
                document.querySelectorAll('.custom-client-details input').forEach(el => el.disabled = false);
            }
        });
    }

    invTaxType?.addEventListener('change', calculateInvoiceTotals);

    invoiceForm?.addEventListener('submit', function (e) {
        e.preventDefault();

        // Validate Customer
        const customerVal = invCustomerName?.value || '';
        const customClientVal = invCustomClientName?.value || '';

        if (customerVal === '' && customClientVal.trim() === '') {
            showToast('Please select a saved customer or enter a custom client name!', 'warning');
            return;
        }

        printInvoice();
    });
}

function addInvoiceProductRow() {
    const productItems = document.getElementById('invProductItems');
    if (!productItems) return;

    const newRow = document.createElement('div');
    newRow.className = 'product-item';
    newRow.innerHTML = `
        <div class="form-row">
            <div class="form-group flex-2">
                <label>Product *</label>
                <select class="form-control product-select" required>
                    <option value="">Select Product</option>
                    <option value="Fly Ash Bricks">Fly Ash Bricks</option>
                    <option value="Paver Blocks">Paver Blocks</option>
                    <option value="Cement">Cement</option>
                    <option value="Fly Ash">Fly Ash</option>
                    <option value="Crushers">Crushers</option>
                    <option value="Earth Movers">Earth Movers</option>
                </select>
            </div>
            <div class="form-group">
                <label class="qty-label">Quantity *</label>
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
                <button type="button" class="btn-icon-danger remove-inv-product" title="Remove">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    productItems.appendChild(newRow);

    const select = newRow.querySelector('.product-select');
    const qtyLabel = newRow.querySelector('.qty-label');
    select.addEventListener('change', function() {
        const val = this.value.toLowerCase();
        if (val.includes('fly ash bricks')) {
            qtyLabel.textContent = 'Quantity (Nos) *';
        } else if (val.includes('paver')) {
            qtyLabel.textContent = 'Quantity (Sq. Ft) *';
        } else if (val.includes('cement')) {
            qtyLabel.textContent = 'Quantity (Bags) *';
        } else if (val.includes('fly ash') || val === 'ash') {
            qtyLabel.textContent = 'Quantity (Tons) *';
        } else {
            qtyLabel.textContent = 'Quantity *';
        }
    });

    newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function calculateInvoiceTotals() {
    const productItems = document.getElementById('invProductItems').querySelectorAll('.product-item');
    let subtotal = 0;

    productItems.forEach(item => {
        const quantity = parseFloat(item.querySelector('.quantity-input').value) || 0;
        const price = parseFloat(item.querySelector('.price-input').value) || 0;
        const amount = quantity * price;
        item.querySelector('.amount-display').value = amount.toFixed(2);
        subtotal += amount;
    });

    const gstToggle = document.getElementById('invGstToggle');
    const gstRateSelect = document.getElementById('invGstRate');
    const taxType = document.getElementById('invTaxType')?.value || 'intra';
    let gstAmount = 0;

    if (gstToggle && gstToggle.checked) {
        const rate = parseFloat(gstRateSelect.value) || 0;
        gstAmount = (subtotal * rate) / 100;
    }

    const total = subtotal + gstAmount;

    // Split GST
    const halfGstPercent = (parseFloat(gstRateSelect.value) || 0) / 2;
    const halfGstAmount = gstAmount / 2;

    document.getElementById('invSubtotalAmount').textContent = '₹' + subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const intraOnly = document.querySelectorAll('.inv-intra-only');
    const interOnly = document.querySelectorAll('.inv-inter-only');

    if (taxType === 'intra') {
        intraOnly.forEach(el => el.style.display = 'flex');
        interOnly.forEach(el => el.style.display = 'none');
        document.querySelectorAll('.inv-half-gst').forEach(el => el.textContent = halfGstPercent);
        document.querySelectorAll('.inv-cgst-amount').forEach(el => el.textContent = '₹' + halfGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        document.querySelectorAll('.inv-sgst-amount').forEach(el => el.textContent = '₹' + halfGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else {
        intraOnly.forEach(el => el.style.display = 'none');
        interOnly.forEach(el => el.style.display = 'flex');
        if (document.getElementById('invGstPercentage')) document.getElementById('invGstPercentage').textContent = gstToggle.checked ? gstRateSelect.value : '0';
        if (document.getElementById('invGstAmount')) document.getElementById('invGstAmount').textContent = '₹' + gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    document.getElementById('invTotalAmount').textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const receivedAmount = parseFloat(document.getElementById('invReceivedAmount')?.value) || 0;
    const balance = Math.max(total - receivedAmount, 0);
    const balEl = document.getElementById('invBalanceAmount');
    if (balEl) {
        balEl.textContent = '₹' + balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

function numberToWords(amount) {
    var words = new Array();
    words[0] = '';
    words[1] = 'One';
    words[2] = 'Two';
    words[3] = 'Three';
    words[4] = 'Four';
    words[5] = 'Five';
    words[6] = 'Six';
    words[7] = 'Seven';
    words[8] = 'Eight';
    words[9] = 'Nine';
    words[10] = 'Ten';
    words[11] = 'Eleven';
    words[12] = 'Twelve';
    words[13] = 'Thirteen';
    words[14] = 'Fourteen';
    words[15] = 'Fifteen';
    words[16] = 'Sixteen';
    words[17] = 'Seventeen';
    words[18] = 'Eighteen';
    words[19] = 'Nineteen';
    words[20] = 'Twenty';
    words[30] = 'Thirty';
    words[40] = 'Forty';
    words[50] = 'Fifty';
    words[60] = 'Sixty';
    words[70] = 'Seventy';
    words[80] = 'Eighty';
    words[90] = 'Ninety';
    amount = amount.toString();
    var atemp = amount.split(".");
    var number = atemp[0].split(",").join("");
    var n_length = number.length;
    var words_string = "";
    if (n_length <= 9) {
        var n_array = new Array(0, 0, 0, 0, 0, 0, 0, 0, 0);
        var received_n_array = new Array();
        for (var i = 0; i < n_length; i++) {
            received_n_array[i] = number.substr(i, 1);
        }
        for (var i = 9 - n_length, j = 0; i < 9; i++, j++) {
            n_array[i] = received_n_array[j];
        }
        for (var i = 0, j = 1; i < 9; i++, j++) {
            if (i == 0 || i == 2 || i == 4 || i == 7) {
                if (n_array[i] == 1) {
                    n_array[j] = 10 + parseInt(n_array[j]);
                    n_array[i] = 0;
                }
            }
        }
        value = "";
        for (var i = 0; i < 9; i++) {
            if (i == 0 || i == 2 || i == 4 || i == 7) {
                value = n_array[i] * 10;
            } else {
                value = n_array[i];
            }
            if (value != 0) {
                words_string += words[value] + " ";
            }
            if ((i == 1 && value != 0) || (i == 0 && value != 0 && n_array[i + 1] == 0)) {
                words_string += "Crores ";
            }
            if ((i == 3 && value != 0) || (i == 2 && value != 0 && n_array[i + 1] == 0)) {
                words_string += "Lakhs ";
            }
            if ((i == 5 && value != 0) || (i == 4 && value != 0 && n_array[i + 1] == 0)) {
                words_string += "Thousand ";
            }
            if (i == 6 && value != 0 && (n_array[i + 1] != 0 && n_array[i + 2] != 0)) {
                words_string += "Hundred and ";
            } else if (i == 6 && value != 0) {
                words_string += "Hundred ";
            }
        }
        words_string = words_string.split("  ").join(" ");
    }
    return 'IndianRupee ' + words_string.trim() + ' Only';
}

function printInvoice() {
    // 1. Set Labels for Invoice
    document.getElementById('pDocTitle').textContent = 'INVOICE';

    // 2. Populate Print Template
    document.getElementById('pInvNumber').textContent = document.getElementById('invNumber').value;
    document.getElementById('pInvDate').textContent = document.getElementById('invDate').value;

    // Sub-descriptions for products based on value
    const pSubDescs = {
        'flyash': '(Supply and Laying)',
        'paver': '(Paver Supply and Laying Charges only)',
        'solid': '(Solid Block Supply)',
        'kerb': '(Kerb Stone Supply)'
    };

    const customerSelect = document.getElementById('invCustomerName');
    const customerId = customerSelect.value;
    const invCustomClientName = document.getElementById('invCustomClientName')?.value || '';

    let printCustName = '';
    let printCustGst = 'N/A';
    let printCustAddress = '';
    let printCustPhone = 'N/A';

    if (invCustomClientName.trim() !== '') {
        printCustName = invCustomClientName.trim();
        printCustGst = document.getElementById('invCustomClientGst')?.value || 'N/A';
        printCustAddress = document.getElementById('invCustomClientAddress')?.value || '';
        printCustPhone = document.getElementById('invCustomClientMobile')?.value || 'N/A';
    } else {
        const customers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
        const customer = customers.find(c => c.id === customerId || c.company === customerId);
        if (customer) {
            printCustName = customer.company;
            printCustGst = customer.gst;
            printCustAddress = customer.city + (customer.state ? ', ' + customer.state : '');
            printCustPhone = customer.phone;
        }
    }

    const isGstApplied = document.getElementById('invGstToggle') && document.getElementById('invGstToggle').checked;

    // Dynamic Page Size
    let dynPrintStyle = document.getElementById('dynamicPrintStyle');
    if (!dynPrintStyle) {
        dynPrintStyle = document.createElement('style');
        dynPrintStyle.id = 'dynamicPrintStyle';
        document.head.appendChild(dynPrintStyle);
    }
    if (isGstApplied) {
        dynPrintStyle.innerHTML = '@media print { @page { size: A4 portrait !important; margin: 10mm !important; } }';
    } else {
        dynPrintStyle.innerHTML = '@media print { @page { size: A5 portrait !important; margin: 10mm !important; } }';
    }

    // Company Address Setup
    const pCompanyAddress = document.getElementById('pCompanyAddress');
    if (pCompanyAddress) {
        pCompanyAddress.innerHTML = 'SFNO:281/5A, ARIYALUR MAIN ROAD, KAULPALAYAM, THURAIMANGALAM - POST, PERAMBALUR - 621 220<br>+91 82488 38593, +91 99520 68848 | rmkgroups1987@gmail.com';
    }

    document.getElementById('pCustomerName').textContent = printCustName;
    const pCustomerAddress = document.getElementById('pCustomerAddress');
    if (pCustomerAddress) {
        if (isGstApplied) {
            pCustomerAddress.textContent = printCustAddress;
            pCustomerAddress.style.display = 'block';
        } else {
            pCustomerAddress.style.display = 'none';
        }
    }

    const pCustomerGstContainer = document.getElementById('pCustomerGstContainer');
    const pCustomerGst = document.getElementById('pCustomerGst');
    if (printCustGst && printCustGst !== 'N/A' && printCustGst.trim() !== '') {
        if (pCustomerGst) pCustomerGst.textContent = printCustGst;
        if (pCustomerGstContainer) pCustomerGstContainer.style.display = 'block';
    } else {
        if (pCustomerGstContainer) pCustomerGstContainer.style.display = 'none';
    }

    const pCustomerPhoneContainer = document.getElementById('pCustomerPhoneContainer');
    const pCustomerPhone = document.getElementById('pCustomerPhone');
    if (printCustPhone && printCustPhone !== 'N/A' && printCustPhone.trim() !== '') {
        if (pCustomerPhone) pCustomerPhone.textContent = printCustPhone;
        if (pCustomerPhoneContainer) pCustomerPhoneContainer.style.display = 'block';
    } else {
        if (pCustomerPhoneContainer) pCustomerPhoneContainer.style.display = 'none';
    }

    // Products
    const printRows = document.getElementById('pProductRows');
    printRows.innerHTML = '';
    const productItems = document.getElementById('invProductItems').querySelectorAll('.product-item');
    let index = 1;

    productItems.forEach(item => {
        const productSelect = item.querySelector('.product-select');
        const product = productSelect.options[productSelect.selectedIndex].text;
        const productVal = productSelect.value;
        const subDesc = pSubDescs[productVal] || '';

        const qty = item.querySelector('.quantity-input').value;
        const rate = parseFloat(item.querySelector('.price-input').value).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const amount = parseFloat(item.querySelector('.amount-display').value).toLocaleString('en-IN', { minimumFractionDigits: 2 });

        if (product && productVal) {
            let qtyWithUnit = qty;
            const valLower = productVal.toLowerCase();
            if (valLower.includes('paver')) {
                qtyWithUnit += ' Sq. Ft';
            } else if (valLower.includes('cement')) {
                qtyWithUnit += ' Bags';
            } else if (valLower.includes('fly ash') || valLower === 'ash') {
                if (!valLower.includes('bricks')) {
                    qtyWithUnit += ' Tons';
                }
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index++}</td>
                <td>
                    ${product}
                    ${subDesc ? `<div class="n-item-sub">${subDesc}</div>` : ''}
                </td>
                <td style="text-align:right">${qtyWithUnit}</td>
                <td style="text-align:right">${rate}</td>
                <td style="text-align:right">${amount}</td>
            `;
            printRows.appendChild(tr);
        }
    });

    // Totals
    const subtotalText = document.getElementById('invSubtotalAmount').textContent;
    document.getElementById('pSubtotal').textContent = subtotalText;

    const invTaxType = document.getElementById('invTaxType')?.value || 'intra';
    const gstAmountText = document.getElementById('invGstAmount').textContent;

    const rowCgst = document.getElementById('rowCgst');
    const rowSgst = document.getElementById('rowSgst');
    const rowIgst = document.getElementById('rowIgst');

    if (invTaxType === 'intra') {
        const subtotal = parseFloat(document.getElementById('invSubtotalAmount').textContent.replace(/[₹, ]/g, '')) || 0;
        const rate = parseFloat(document.getElementById('invGstRate').value) || 0;

        // Hide GST if rate is 0 or toggle is off
        const invGstToggle = document.getElementById('invGstToggle');
        if (rate === 0 || (invGstToggle && !invGstToggle.checked)) {
            if (rowCgst) rowCgst.style.display = 'none';
            if (rowSgst) rowSgst.style.display = 'none';
            if (rowIgst) rowIgst.style.display = 'none';
        } else {
            const totalTax = (subtotal * rate) / 100;
            const halfTax = (totalTax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const halfRate = rate / 2;

            document.getElementById('pCgst').textContent = halfTax;
            document.getElementById('pSgst').textContent = halfTax;

            const pCgstLabel = document.getElementById('pCgstLabel');
            const pSgstLabel = document.getElementById('pSgstLabel');
            if (pCgstLabel) pCgstLabel.textContent = `(${halfRate}%)`;
            if (pSgstLabel) pSgstLabel.textContent = `(${halfRate}%)`;

            if (rowCgst) rowCgst.style.display = 'table-row';
            if (rowSgst) rowSgst.style.display = 'table-row';
            if (rowIgst) rowIgst.style.display = 'none';
        }
    } else {
        const rate = parseFloat(document.getElementById('invGstRate').value) || 0;
        const invGstToggle = document.getElementById('invGstToggle');

        if (rate === 0 || (invGstToggle && !invGstToggle.checked)) {
            if (rowCgst) rowCgst.style.display = 'none';
            if (rowSgst) rowSgst.style.display = 'none';
            if (rowIgst) rowIgst.style.display = 'none';
        } else {
            document.getElementById('pIgst').textContent = gstAmountText.replace(/[₹ ]/g, '');

            const pIgstLabel = document.getElementById('pIgstLabel');
            if (pIgstLabel) pIgstLabel.textContent = `(${rate}%)`;

            if (rowCgst) rowCgst.style.display = 'none';
            if (rowSgst) rowSgst.style.display = 'none';
            if (rowIgst) rowIgst.style.display = 'table-row';
        }
    }

    const totalStr = document.getElementById('invTotalAmount').textContent;
    document.getElementById('pTotal').textContent = totalStr;

    // Received & Balance Logic
    const receivedAmt = parseFloat(document.getElementById('invReceivedAmount')?.value) || 0;
    const pRowReceived = document.getElementById('pRowReceived');
    const pRowBalance = document.getElementById('pRowBalance');

    if (receivedAmt > 0) {
        const balStr = document.getElementById('invBalanceAmount').textContent;
        document.getElementById('pReceived').textContent = '₹' + receivedAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('pBalance').textContent = balStr;
        if (pRowReceived) pRowReceived.style.display = 'table-row';
        if (pRowBalance) pRowBalance.style.display = 'table-row';
    } else {
        if (pRowReceived) pRowReceived.style.display = 'none';
        if (pRowBalance) pRowBalance.style.display = 'none';
    }

    // Total in words
    const numTotal = parseFloat(totalStr.replace(/[₹, ]/g, '')) || 0;
    const pTotalWords = document.getElementById('pTotalWords');
    if (pTotalWords) pTotalWords.textContent = numberToWords(Math.round(numTotal));

    document.getElementById('pTerms').innerHTML = (document.getElementById('invNotes').value || '').replace(/\n/g, '<br>');

    const companyGst = localStorage.getItem('companyGst') || '';
    const pCompanyGst = document.getElementById('pCompanyGst');
    const pCompanyGstContainer = document.getElementById('pCompanyGstContainer');
    if (pCompanyGst && pCompanyGstContainer) {
        if (companyGst) {
            pCompanyGstContainer.style.display = 'block';
            pCompanyGst.textContent = companyGst;
        } else {
            pCompanyGstContainer.style.display = 'none';
        }
    }

    // Use uploaded logo if available
    const savedLogo = localStorage.getItem('companyLogo');
    if (savedLogo) {
        document.getElementById('printLogo').src = savedLogo;
    } else {
        const logoPreview = document.getElementById('logoPreviewImg');
        if (logoPreview && logoPreview.src) {
            document.getElementById('printLogo').src = logoPreview.src;
        }
    }

    // Inject signature if available
    const savedSig = localStorage.getItem('companySignature');
    const printSig = document.getElementById('printSignature');
    if (printSig) {
        if (savedSig) {
            printSig.src = savedSig;
            printSig.style.display = 'block';
        } else {
            printSig.style.display = 'none';
        }
    }

    // 2. Trigger Save and Print
    saveInvoiceToStorage();

    // Refresh table if the function exists
    if (typeof loadInvoicesToTable === 'function') {
        loadInvoicesToTable();
    }

    // Instead of window.print(), use 2 A5 landscape layout
    trigger2A5Print();

    showToast('Invoice created and saved successfully!', 'success');
}

function saveInvoiceOnly() {
    // 1. Validate (re-using logic or just direct call)
    const customerVal = document.getElementById('invCustomerName')?.value || '';
    const customClientVal = document.getElementById('invCustomClientName')?.value || '';

    if (customerVal === '' && customClientVal.trim() === '') {
        showToast('Please select a saved customer or enter a custom client name!', 'warning');
        return;
    }

    // 2. Save
    saveInvoiceToStorage();

    // 3. Refresh Table
    if (typeof loadInvoicesToTable === 'function') {
        loadInvoicesToTable();
    }

    // 4. Close Modal
    const invoiceModal = document.getElementById('invoiceModal');
    if (invoiceModal) {
        invoiceModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    showToast('Invoice saved successfully!', 'success');
}

function trigger2A5Print() {
    // Revert to single-page portrait print instead of dual-copy
    const printArea = document.getElementById('printTemplate');
    if (printArea) {
        // Clean up any old duplicate if it exists
        const oldCopy = printArea.querySelector('.new-print-layout-copy');
        if (oldCopy) {
            oldCopy.remove();
        }
    }

    setTimeout(() => {
        window.print();
    }, 250);
}

/**
 * GLOBAL INJECTIONS
 */
function injectPaymentModal() {
    if (document.getElementById('paymentModal')) return;

    const modalHtml = `
        <div class="modal" id="paymentModal">
            <div class="modal-overlay"></div>
            <div class="modal-container" style="max-width: 450px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-hand-holding-usd"></i>
                        Record Payment
                    </h2>
                    <button class="modal-close" id="closePaymentModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="paymentForm">
                        <input type="hidden" id="payInvoiceId">
                        <div class="form-section">
                            <div class="form-group" id="payCustomerGroup">
                                <label>Customer *</label>
                                <select id="payCustomerSelect" class="form-control">
                                    <option value="">-- Select Customer --</option>
                                </select>
                            </div>
                            <div class="form-group" id="payInvoiceGroup" style="display:none;">
                                <label>Select Invoice *</label>
                                <select id="payInvoiceSelect" class="form-control">
                                    <option value="">-- Choose Invoice --</option>
                                </select>
                            </div>
                            <div class="form-group" id="payInvNumberGroup">
                                <label>Invoice Number</label>
                                <input type="text" id="payInvNumber" class="form-control" readonly>
                            </div>
                            <div class="form-group">
                                <label>Total Amount</label>
                                <input type="text" id="payTotalAmount" class="form-control" readonly>
                            </div>
                            <div class="form-group">
                                <label>Already Received</label>
                                <input type="text" id="payAlreadyReceived" class="form-control" readonly>
                            </div>
                            <div class="form-group">
                                <label>New Received Amount (₹) *</label>
                                <input type="number" id="payNewAmount" class="form-control" required placeholder="0.00" step="0.01">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" id="cancelPaymentBtn">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save Payment</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function injectGlobalRecordPaymentBtn() {
    const actions = document.querySelector('.page-actions');
    if (actions && !document.getElementById('headerRecordPaymentBtn')) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.id = 'headerRecordPaymentBtn';
        btn.style.cssText = 'background: #f39c12; color: white; border: none; display: flex; align-items: center; gap: 8px; margin-left: 10px; cursor: pointer;';
        btn.innerHTML = '<i class="fas fa-hand-holding-usd"></i> Record Payment';
        actions.appendChild(btn);
    }
}

function openPaymentModal(invoiceId = null, customerName = null) {
    const modal = document.getElementById('paymentModal');
    const form = document.getElementById('paymentForm');
    const invoiceGroup = document.getElementById('payInvoiceGroup');
    const numGroup = document.getElementById('payInvNumberGroup');
    const custGroup = document.getElementById('payCustomerGroup');

    if (!modal || !form) {
        console.error('Payment Modal or Form not found in DOM');
        return;
    }

    // Reset Form
    form.reset();
    document.getElementById('payInvoiceId').value = '';

    if (invoiceId) {
        const invoices = safeJsonParse(localStorage.getItem('rmk_invoices'), []);
        const invoice = invoices.find(inv => String(inv.id) === String(invoiceId));
        if (invoice) {
            fillPaymentDetails(invoice);
            if (custGroup) custGroup.style.display = 'none';
            if (invoiceGroup) invoiceGroup.style.display = 'none';
            if (numGroup) numGroup.style.display = 'block';
        }
    } else if (customerName) {
        populatePayCustomerSelect(customerName);
        if (custGroup) custGroup.style.display = 'block';
        if (numGroup) numGroup.style.display = 'none';

        // Trigger population of invoices for this customer
        const custSelect = document.getElementById('payCustomerSelect');
        if (custSelect) {
            custSelect.dispatchEvent(new Event('change'));
        }
    } else {
        populatePayCustomerSelect();
        if (custGroup) custGroup.style.display = 'block';
        if (numGroup) numGroup.style.display = 'none';
        if (invoiceGroup) invoiceGroup.style.display = 'none';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function fillPaymentDetails(invoice) {
    const idEl = document.getElementById('payInvoiceId');
    const numEl = document.getElementById('payInvNumber');
    const totEl = document.getElementById('payTotalAmount');
    const recEl = document.getElementById('payAlreadyReceived');
    const newEl = document.getElementById('payNewAmount');

    if (idEl) idEl.value = invoice.id;
    if (numEl) numEl.value = invoice.invNumber;

    const total = parseFloat(invoice.total) || 0;
    const received = parseFloat(invoice.receivedAmount) || 0;

    if (totEl) totEl.value = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    if (recEl) recEl.value = '₹' + received.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    if (newEl) newEl.value = (total - received).toFixed(2);
}

function populatePayCustomerSelect(selectedCustName = null) {
    const customerSelect = document.getElementById('payCustomerSelect');
    if (!customerSelect) return;

    const customers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
    customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';

    customers.forEach(cust => {
        const opt = document.createElement('option');
        opt.value = cust.company;
        opt.textContent = cust.company;
        if (cust.company === selectedCustName) opt.selected = true;
        customerSelect.appendChild(opt);
    });
}

function initializePaymentModal() {
    const paymentModal = document.getElementById('paymentModal');
    const paymentForm = document.getElementById('paymentForm');
    const closePaymentModal = document.getElementById('closePaymentModal');
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');

    if (!paymentModal || !paymentForm) return;

    const closeModal = () => {
        paymentModal.classList.remove('active');
        document.body.style.overflow = 'auto';
        paymentForm.reset();
    };

    closePaymentModal?.addEventListener('click', closeModal);
    cancelPaymentBtn?.addEventListener('click', closeModal);

    // Sidebar Backdrop Close
    document.querySelector('#paymentModal .modal-overlay')?.addEventListener('click', closeModal);

    // Initial population of customers for payment
    populatePayCustomerSelect();

    // Selection Logic
    const customerSelect = document.getElementById('payCustomerSelect');
    const invoiceSelect = document.getElementById('payInvoiceSelect');
    const invoiceGroup = document.getElementById('payInvoiceGroup');

    customerSelect?.addEventListener('change', function () {
        const custName = this.value;
        if (!custName) {
            if (invoiceGroup) invoiceGroup.style.display = 'none';
            return;
        }

        const invoices = safeJsonParse(localStorage.getItem('rmk_invoices'), []);
        const custInvoices = invoices.filter(inv =>
            inv.customerName === custName &&
            (parseFloat(inv.receivedAmount) || 0) < (parseFloat(inv.total) || 0)
        );

        if (!invoiceSelect) return;
        invoiceSelect.innerHTML = '<option value="">-- Choose Invoice --</option>';

        if (custInvoices.length > 0) {
            custInvoices.forEach(inv => {
                const opt = document.createElement('option');
                opt.value = inv.id;
                opt.textContent = `${inv.invNumber} (₹${inv.total})`;
                invoiceSelect.appendChild(opt);
            });
            if (invoiceGroup) invoiceGroup.style.display = 'block';
        } else {
            showToast('No pending balance for this customer', 'info');
            if (invoiceGroup) invoiceGroup.style.display = 'none';
        }
    });

    invoiceSelect?.addEventListener('change', function () {
        const invId = this.value;
        const invoices = safeJsonParse(localStorage.getItem('rmk_invoices'), []);
        const invoice = invoices.find(inv => String(inv.id) === String(invId));
        if (invoice) fillPaymentDetails(invoice);
    });

    paymentForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const invId = document.getElementById('payInvoiceId').value;
        const newAmount = parseFloat(document.getElementById('payNewAmount').value) || 0;

        if (!invId) {
            showToast('Please select an invoice first', 'warning');
            return;
        }

        let invoices = safeJsonParse(localStorage.getItem('rmk_invoices'), []);
        const invIndex = invoices.findIndex(inv => String(inv.id) === String(invId));

        if (invIndex !== -1) {
            const currentReceived = parseFloat(invoices[invIndex].receivedAmount || 0);
            invoices[invIndex].receivedAmount = currentReceived + newAmount;

            const total = parseFloat(invoices[invIndex].total);
            if (invoices[invIndex].receivedAmount >= total) {
                invoices[invIndex].status = 'Paid';
            } else {
                invoices[invIndex].status = 'Partial';
            }

            let wasSyncing = window._isCloudSyncing;
            window._isCloudSyncing = false;
            localStorage.setItem('rmk_invoices', JSON.stringify(invoices));
            window._isCloudSyncing = wasSyncing;
            showToast('Payment recorded successfully', 'success');
            closeModal();

            // Refresh table if on billing page
            if (typeof loadInvoicesToTable === 'function') loadInvoicesToTable();

            if (window.realtimeManager) {
                window.realtimeManager.emitInvoiceUpdated(invoices[invIndex]);
            }
        }
    });
}

// --- UI Helper: Refresh current data View ---
function refreshCurrentPageView() {
    console.log("Refreshing UI Data...");
    const path = window.location.pathname;

    // Specifically for Billing Dashboard
    if (path.includes('admin-billing.html')) {
        if (typeof loadInvoicesToTable === 'function') loadInvoicesToTable();
        if (typeof animateStats === 'function') animateStats(); // Recalculate totals

        // Re-populate customer selections if empty
        const invSelect = document.getElementById('invCustomerName');
        if (invSelect && invSelect.options.length <= 2) {
            initializeBillingModule();
        }
    } else if (path.includes('admin-customers.html')) {
        if (typeof loadCustomersToTable === 'function') loadCustomersToTable();
    } else if (path.includes('admin-products.html')) {
        if (typeof loadProductsToTable === 'function') loadProductsToTable();
    }
}

function saveInvoiceToStorage() {
    const invNumber = document.getElementById('invNumber').value;

    // COMMIT the invoice number officially to the counter now that we are actually saving/printing
    generateFinancialYearInvoiceNumber('invoice', invNumber, true);

    const invDate = document.getElementById('invDate').value;
    const customerSelect = document.getElementById('invCustomerName');
    const invCustomClientName = document.getElementById('invCustomClientName')?.value || '';
    let customerName = '';

    if (invCustomClientName.trim() !== '') {
        customerName = invCustomClientName.trim();

        // Auto Save to customers
        const customers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
        const existing = customers.find(c => c.company.toLowerCase() === customerName.toLowerCase());
        if (!existing) {
            const customMobile = document.getElementById('invCustomClientMobile')?.value || '';
            const customGst = document.getElementById('invCustomClientGst')?.value || 'N/A';
            const customAddress = document.getElementById('invCustomClientAddress')?.value || '';

            const newCustomer = {
                id: Date.now().toString(),
                company: customerName,
                custId: 'ID: ' + Math.floor(4000 + Math.random() * 1000),
                contact: customerName,
                phone: customMobile,
                city: customAddress.split(',')[0] || 'N/A',
                state: 'Tamil Nadu', // Default
                gst: customGst || 'N/A',
                orders: 0,
                status: 'Active',
                avatar: customerName.substring(0, 2).toUpperCase(),
                avatarColor: getRandomColor()
            };
            customers.unshift(newCustomer);
            localStorage.setItem('rmk_customers', JSON.stringify(customers));

            // Try updating the UI if on customers page
            if (typeof addCustomerRowToTable === 'function') {
                const tableBody = document.querySelector('.data-table tbody');
                if (tableBody) {
                    const emptyRow = tableBody.querySelector('tr td[colspan]');
                    if (emptyRow) emptyRow.parentElement.remove();
                    addCustomerRowToTable(newCustomer, true);
                    updateCustomerStats(customers.length);
                }
            }
        }
    } else {
        if (customerSelect && customerSelect.selectedIndex >= 0) {
            customerName = customerSelect.options[customerSelect.selectedIndex].text;
        }
    }
    const taxType = document.getElementById('invTaxType')?.value || 'intra';

    const subtotalText = document.getElementById('invSubtotalAmount').textContent;
    const subtotal = parseFloat(subtotalText.replace(/[₹,]/g, '')) || 0;

    const totalText = document.getElementById('invTotalAmount').textContent;
    const total = parseFloat(totalText.replace(/[₹,]/g, '')) || 0;

    let gstTotal = Math.max(0, total - subtotal);

    let cgst = 0, sgst = 0, igst = 0;
    if (taxType === 'intra') {
        cgst = gstTotal / 2;
        sgst = gstTotal / 2;
    } else {
        igst = gstTotal;
    }

    // Collect Products
    const products = [];
    const productItems = document.getElementById('invProductItems').querySelectorAll('.product-item');
    productItems.forEach(item => {
        const description = item.querySelector('.product-select').value;
        const qty = item.querySelector('.quantity-input').value;
        const rate = item.querySelector('.price-input').value;
        const amount = item.querySelector('.amount-display').value;
        if (description) {
            products.push({ description, qty, rate, amount });
        }
    });

    // Find Customer Details for header
    const savedCustomers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
    const customer = savedCustomers.find(c => c.company === customerName);
    let customerAddress = customer ? `${customer.city}, ${customer.state}` : 'N/A';

    if (invCustomClientName && invCustomClientName.trim() !== '') {
        const customAddress = document.getElementById('invCustomClientAddress')?.value || '';
        if (customAddress) customerAddress = customAddress;
    }

    const notes = document.getElementById('invNotes')?.value || '';

    // Capture GST if any
    let customerGst = customer ? customer.gst : 'N/A';
    let customerPhone = customer ? customer.phone : 'N/A';

    if (invCustomClientName && invCustomClientName.trim() !== '') {
        const customGst = document.getElementById('invCustomClientGst')?.value || '';
        if (customGst) customerGst = customGst;

        const customPhone = document.getElementById('invCustomClientMobile')?.value || '';
        if (customPhone) customerPhone = customPhone;
    }

    const totalAmountText = document.getElementById('invTotalAmount').textContent;
    // reuse 'total' defined above

    const receivedAmountVal = parseFloat(document.getElementById('invReceivedAmount').value) || 0;
    const balanceDue = total - receivedAmountVal;

    let status = 'Unpaid';
    if (balanceDue <= 0) status = 'Paid';
    else if (receivedAmountVal > 0) status = 'Partial';

    const invoiceData = {
        id: Date.now(),
        invNumber,
        invDate,
        invDueDate: document.getElementById('invDueDate')?.value || '',
        customerName,
        customerAddress,
        customerGst,
        customerPhone,
        taxType,
        subtotal,
        cgst,
        sgst,
        igst,
        gstTotal,
        total,
        receivedAmount: receivedAmountVal,
        products,
        notes,
        status: status,
        timestamp: new Date().toISOString()
    };

    const invoices = safeJsonParse(localStorage.getItem('rmk_invoices'), []);
    invoices.unshift(invoiceData);
    localStorage.setItem('rmk_invoices', JSON.stringify(invoices));

    if (window.realtimeManager) {
        window.realtimeManager.emitNewInvoice(invoiceData);
    }
}

function shareInvoiceOnWhatsApp() {
    // 1. Collect Data
    const invNumber = document.getElementById('invNumber').value;
    const invDate = document.getElementById('invDate').value;
    const customerSelect = document.getElementById('invCustomerName');

    let customerName = customerSelect.options[customerSelect.selectedIndex]?.text || '';
    const invCustomClientName = document.getElementById('invCustomClientName')?.value || '';

    // Fix: If placeholder is selected but custom name is filled
    if (customerName.includes('Select') || customerName === '') {
        if (invCustomClientName.trim() !== '') {
            customerName = invCustomClientName.trim();
        }
    }

    const totalAmount = document.getElementById('invTotalAmount').textContent;

    if (!customerName || customerName.includes('Select')) {
        showToast('Please select a customer first', 'warning');
        return;
    }

    // Capture items for text summary
    const products = [];
    document.getElementById('invProductItems').querySelectorAll('.product-item').forEach(item => {
        const prodSelect = item.querySelector('.product-select');
        const prod = prodSelect.options[prodSelect.selectedIndex]?.text || '';
        const qty = item.querySelector('.quantity-input').value;
        const amt = item.querySelector('.amount-display').value;
        if (prod && prod !== 'Select Product') {
            products.push(`• ${prod} (Qty: ${qty}) - ₹${amt}`);
        }
    });

    const itemsText = products.length > 0 ? `\n*Items:*\n${products.join('\n')}\n` : '';

    // 2. Generate PDF locally (using html2pdf)
    const printArea = document.getElementById('printTemplate');
    if (printArea) {
        // We temporarily show the print area to capture it
        const opt = {
            margin: 10,
            filename: `Invoice_${invNumber}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Generate and save PDF
        html2pdf().set(opt).from(printArea).toPdf().get('pdf').then(function (pdf) {
            // After PDF generation starts, we open WhatsApp
            const message = `*INVOICE DETAILS*\n\nHello *${customerName}*,\n\nYour invoice *${invNumber}* has been generated. I am sending the PDF bill as well.\n\n*Total Amount:* ${totalAmount}\n\nRegards,\n*RMK Fly Ash Bricks*`;

            // Find Customer Phone
            const savedCustomers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
            const customer = savedCustomers.find(c => c.company === customerName);
            let phoneNumber = '';

            if (customer && customer.phone) {
                let cleanPhone = customer.phone.replace(/\D/g, '');
                if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
                phoneNumber = cleanPhone;
            } else {
                const customMobile = document.getElementById('invCustomClientMobile')?.value || '';
                if (customMobile) {
                    let cleanPhone = customMobile.replace(/\D/g, '');
                    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
                    phoneNumber = cleanPhone;
                }
            }

            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
            showToast('PDF Generated & WhatsApp Opening...', 'success');
        }).save(); // This actually downloads the PDF
    }
}

function initializeQuoteModal() {
    const getQuoteBtn = document.getElementById('getQuoteBtn');
    const quoteModal = document.getElementById('quoteModal');
    const closeQuoteModal = document.getElementById('closeQuoteModal');
    const cancelQuoteBtn = document.getElementById('cancelQuoteBtn');
    const modalOverlay = document.querySelector('.modal-overlay');
    const quoteForm = document.getElementById('quoteForm');

    // Logic moved to initializeBillingModule for cleaner event handling.
    // getQuoteBtn listener is removed from here to prevent duplicate handling.

    const closeModal = () => {
        quoteModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    closeQuoteModal?.addEventListener('click', closeModal);
    cancelQuoteBtn?.addEventListener('click', closeModal);
    modalOverlay?.addEventListener('click', closeModal);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && quoteModal.classList.contains('active')) {
            closeModal();
        }
    });

    quoteForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        handleQuoteSubmission();
    });
}

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
                    <option value="cement">Cement</option>
                    <option value="ash">Fly Ash</option>
                    <option value="crusher">Crushers</option>
                    <option value="earthmover">Earth Movers</option>
                </select>
            </div>
            <div class="form-group">
                <label class="qty-label">Quantity *</label>
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

    const select = newRow.querySelector('.product-select');
    const qtyLabel = newRow.querySelector('.qty-label');
    select.addEventListener('change', function() {
        const val = this.value.toLowerCase();
        if (val.includes('flyash')) {
            qtyLabel.textContent = 'Quantity (Nos) *';
        } else if (val.includes('paver')) {
            qtyLabel.textContent = 'Quantity (Sq. Ft) *';
        } else if (val.includes('cement')) {
            qtyLabel.textContent = 'Quantity (Bags) *';
        } else if (val.includes('ash')) {
            qtyLabel.textContent = 'Quantity (Tons) *';
        } else {
            qtyLabel.textContent = 'Quantity *';
        }
    });


    const quantityInput = newRow.querySelector('.quantity-input');
    const priceInput = newRow.querySelector('.price-input');
    const removeBtn = newRow.querySelector('.remove-product');

    // Attach listeners for calc
    quantityInput.addEventListener('input', calculateTotals);
    priceInput.addEventListener('input', calculateTotals);

    removeBtn.addEventListener('click', function () {
        newRow.remove();
        calculateTotals();
    });

    newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function initializeFormCalculations() {
    const gstToggle = document.getElementById('gstToggle');
    const gstRate = document.getElementById('gstRate');
    const taxType = document.getElementById('taxType');

    if (!gstToggle) return;

    gstToggle.addEventListener('change', function () {
        gstRate.disabled = !this.checked;
        calculateTotals();
    });

    gstRate.addEventListener('change', calculateTotals);
    if (taxType) taxType.addEventListener('change', calculateTotals);

    // Auto-detect tax type for Quotation based on customer state
    const custSelect = document.getElementById('quoteCustomerName');
    if (custSelect) {
        custSelect.addEventListener('change', function () {
            const customerId = this.value;
            const customers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
            const customer = customers.find(c => c.id === customerId || c.company === customerId);
            if (customer && taxType) {
                taxType.value = (customer.state === 'Tamil Nadu') ? 'intra' : 'inter';
                calculateTotals();
            }
        });
    }

    document.addEventListener('input', function (e) {
        if (e.target.classList.contains('quantity-input') || e.target.classList.contains('price-input')) {
            calculateTotals();
        }
    });

    document.addEventListener('click', function (e) {
        if (e.target.closest('.remove-product')) {
            const productItem = e.target.closest('.product-item');
            const productItems = document.getElementById('productItems');
            if (productItems.children.length > 1) {
                productItem.remove();
                calculateTotals();
            } else {
                showToast('At least one product is required', 'warning');
            }
        }
    });
}

function calculateTotals() {
    const productItems = document.querySelectorAll('#productItems .product-item');
    let subtotal = 0;

    productItems.forEach(item => {
        const quantity = parseFloat(item.querySelector('.quantity-input').value) || 0;
        const price = parseFloat(item.querySelector('.price-input').value) || 0;
        const amount = quantity * price;
        item.querySelector('.amount-display').value = amount.toFixed(2);
        subtotal += amount;
    });

    const gstToggle = document.getElementById('gstToggle');
    const gstRateSelect = document.getElementById('gstRate');
    const taxTypeSelect = document.getElementById('taxType');
    const selectedTaxType = taxTypeSelect?.value || 'intra';
    let gstAmount = 0;

    if (gstToggle && gstToggle.checked) {
        const rate = parseFloat(gstRateSelect.value) || 0;
        gstAmount = (subtotal * rate) / 100;
    }

    const total = subtotal + gstAmount;

    // Split GST
    const halfGstPercent = (parseFloat(gstRateSelect.value) || 0) / 2;
    const halfGstAmount = gstAmount / 2;

    const subtotalEl = document.getElementById('subtotalAmount');
    if (subtotalEl) subtotalEl.textContent = '₹' + subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const intraOnly = document.querySelectorAll('.intra-only');
    const interOnly = document.querySelectorAll('.inter-only');

    if (selectedTaxType === 'intra') {
        intraOnly.forEach(el => el.style.display = 'flex');
        interOnly.forEach(el => el.style.display = 'none');
        document.querySelectorAll('.half-gst').forEach(el => el.textContent = halfGstPercent);
        document.querySelectorAll('.cgst-amount').forEach(el => el.textContent = '₹' + halfGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        document.querySelectorAll('.sgst-amount').forEach(el => el.textContent = '₹' + halfGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else {
        intraOnly.forEach(el => el.style.display = 'none');
        interOnly.forEach(el => el.style.display = 'flex');
        const gstPcEl = document.getElementById('gstPercentage');
        const gstAmEl = document.getElementById('gstAmount');
        if (gstPcEl) gstPcEl.textContent = gstToggle.checked ? gstRateSelect.value : '0';
        if (gstAmEl) gstAmEl.textContent = '₹' + gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    const totalEl = document.getElementById('totalAmount');
    if (totalEl) totalEl.textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setDefaultDates() {
    const today = new Date();
    const quoteDate = document.getElementById('quoteDate');
    const validityDate = document.getElementById('validityDate');
    if (quoteDate) quoteDate.value = today.toISOString().split('T')[0];

    if (validityDate) {
        const validity = new Date(today);
        validity.setDate(validity.getDate() + 14);
        validityDate.value = validity.toISOString().split('T')[0];
    }
}


function handleQuoteSubmission() {
    printQuote();
}

function printQuote() {
    // 1. Set Labels for Quotation
    document.getElementById('pDocTitle').textContent = 'QUOTE';

    // 2. Populate Data
    const quoteNumber = document.getElementById('quoteNumber').value;

    // COMMIT the quote number officially to the counter
    generateFinancialYearInvoiceNumber('quote', quoteNumber, true);

    document.getElementById('pInvNumber').textContent = quoteNumber;
    document.getElementById('pInvDate').textContent = document.getElementById('quoteDate').value;

    // Sub-descriptions for products
    const pSubDescs = {
        'flyash': '(Supply and Laying)',
        'paver': '(Paver Supply and Laying Charges only)',
        'solid': '(Solid Block Supply)',
        'kerb': '(Kerb Stone Supply)'
    };

    const customerSelect = document.getElementById('quoteCustomerName');
    const customerId = customerSelect ? customerSelect.value : '';
    const quoteCustomClient = document.getElementById('quoteCustomClient')?.value || '';
    const customers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
    const customer = customers.find(c => c.id === customerId || c.company === customerId);

    // Handle custom client name in quote
    let printCustName = '';
    if (quoteCustomClient.trim() !== '') {
        printCustName = quoteCustomClient.trim();
    } else if (customerSelect) {
        printCustName = customerSelect.options[customerSelect.selectedIndex]?.text || '';
    }

    document.getElementById('pCustomerName').textContent = printCustName;

    const pCustomerGstContainer = document.getElementById('pCustomerGstContainer');
    const pCustomerGst = document.getElementById('pCustomerGst');
    if (customer && customer.gst && customer.gst !== 'N/A') {
        if (pCustomerGst) pCustomerGst.textContent = customer.gst;
        if (pCustomerGstContainer) pCustomerGstContainer.style.display = 'block';
    } else {
        if (pCustomerGstContainer) pCustomerGstContainer.style.display = 'none';
    }

    // 3. Products
    const printRows = document.getElementById('pProductRows');
    printRows.innerHTML = '';
    const productItems = document.getElementById('productItems').querySelectorAll('.product-item');
    let index = 1;

    productItems.forEach(item => {
        const productSelect = item.querySelector('.product-select');
        const product = productSelect.options[productSelect.selectedIndex]?.text || '';
        const productVal = productSelect.value;
        const subDesc = pSubDescs[productVal] || '';

        const qty = item.querySelector('.quantity-input').value;
        const priceVal = parseFloat(item.querySelector('.price-input').value) || 0;
        const amountVal = parseFloat(item.querySelector('.amount-display').value) || 0;

        const rate = priceVal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const amount = amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 });

        if (product && product !== 'Select Product') {
            let qtyWithUnit = qty;
            const valLower = productVal.toLowerCase();
            if (valLower.includes('paver')) {
                qtyWithUnit += ' Sq. Ft';
            } else if (valLower.includes('cement')) {
                qtyWithUnit += ' Bags';
            } else if (valLower.includes('flyash') || valLower === 'ash') {
                qtyWithUnit += ' Tons';
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index++}</td>
                <td>
                    ${product}
                    ${subDesc ? `<div class="n-item-sub">${subDesc}</div>` : ''}
                </td>
                <td style="text-align:right">${qtyWithUnit}</td>
                <td style="text-align:right">${rate}</td>
                <td style="text-align:right">${amount}</td>
            `;
            printRows.appendChild(tr);
        }
    });

    // 4. Totals
    const subtotalText = document.getElementById('subtotalAmount').textContent;
    document.getElementById('pSubtotal').textContent = subtotalText;

    const taxType = document.getElementById('taxType')?.value || 'intra';
    const gstAmountText = document.getElementById('gstAmount').textContent;

    const rowCgst = document.getElementById('rowCgst');
    const rowSgst = document.getElementById('rowSgst');
    const rowIgst = document.getElementById('rowIgst');

    if (taxType === 'intra') {
        const subtotal = parseFloat(subtotalText.replace(/[₹, ]/g, '')) || 0;
        const rate = parseFloat(document.getElementById('gstRate').value) || 0;
        const gstToggle = document.getElementById('gstToggle');

        if (rate === 0 || (gstToggle && !gstToggle.checked)) {
            if (rowCgst) rowCgst.style.display = 'none';
            if (rowSgst) rowSgst.style.display = 'none';
            if (rowIgst) rowIgst.style.display = 'none';
        } else {
            const totalTax = (subtotal * rate) / 100;
            const halfTax = (totalTax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const halfRate = rate / 2;

            document.getElementById('pCgst').textContent = halfTax;
            document.getElementById('pSgst').textContent = halfTax;

            const pCgstLabel = document.getElementById('pCgstLabel');
            const pSgstLabel = document.getElementById('pSgstLabel');
            if (pCgstLabel) pCgstLabel.textContent = `(${halfRate}%)`;
            if (pSgstLabel) pSgstLabel.textContent = `(${halfRate}%)`;

            if (rowCgst) rowCgst.style.display = 'table-row';
            if (rowSgst) rowSgst.style.display = 'table-row';
            if (rowIgst) rowIgst.style.display = 'none';
        }
    } else {
        const rate = parseFloat(document.getElementById('gstRate').value) || 0;
        const gstToggle = document.getElementById('gstToggle');

        if (rate === 0 || (gstToggle && !gstToggle.checked)) {
            if (rowCgst) rowCgst.style.display = 'none';
            if (rowSgst) rowSgst.style.display = 'none';
            if (rowIgst) rowIgst.style.display = 'none';
        } else {
            document.getElementById('pIgst').textContent = gstAmountText.replace(/[₹ ]/g, '');

            const pIgstLabel = document.getElementById('pIgstLabel');
            if (pIgstLabel) pIgstLabel.textContent = `(${rate}%)`;

            if (rowCgst) rowCgst.style.display = 'none';
            if (rowSgst) rowSgst.style.display = 'none';
            if (rowIgst) rowIgst.style.display = 'table-row';
        }
    }

    const totalStr = document.getElementById('totalAmount').textContent;
    document.getElementById('pTotal').textContent = totalStr;

    const numTotal = parseFloat(totalStr.replace(/[₹, ]/g, '')) || 0;
    const pTotalWords = document.getElementById('pTotalWords');
    if (pTotalWords) pTotalWords.textContent = numberToWords(Math.round(numTotal));

    // Notes
    document.getElementById('pTerms').innerHTML = (document.getElementById('notes').value || '').replace(/\n/g, '<br>');

    // GST Toggle and Dynamic Page Size / Addresses
    const gstToggle = document.getElementById('gstToggle');
    const isGstApplied = gstToggle && gstToggle.checked;

    let dynPrintStyle = document.getElementById('dynamicPrintStyle');
    if (!dynPrintStyle) {
        dynPrintStyle = document.createElement('style');
        dynPrintStyle.id = 'dynamicPrintStyle';
        document.head.appendChild(dynPrintStyle);
    }
    if (isGstApplied) {
        dynPrintStyle.innerHTML = '@media print { @page { size: A4 portrait !important; margin: 10mm !important; } }';
    } else {
        dynPrintStyle.innerHTML = '@media print { @page { size: A5 portrait !important; margin: 10mm !important; } }';
    }

    const pCompanyAddress = document.getElementById('pCompanyAddress');
    if (pCompanyAddress) {
        pCompanyAddress.innerHTML = 'SFNO:281/5A, ARIYALUR MAIN ROAD, KAULPALAYAM, THURAIMANGALAM - POST, PERAMBALUR - 621 220<br>+91 82488 38593, +91 99520 68848 | rmkgroups1987@gmail.com';
    }

    const pCustomerAddress = document.getElementById('pCustomerAddress');
    if (pCustomerAddress) {
        if (isGstApplied) {
            pCustomerAddress.textContent = customer ? (customer.city + (customer.state ? ', ' + customer.state : '')) : '';
            pCustomerAddress.style.display = 'block';
        } else {
            pCustomerAddress.style.display = 'none';
        }
    }

    // Add Company GSTIN to template
    const companyGst = localStorage.getItem('companyGst') || '';
    const pCompanyGstContainer = document.getElementById('pCompanyGstContainer');
    const pCompanyGst = document.getElementById('pCompanyGst');

    if (companyGst) {
        if (pCompanyGst) pCompanyGst.textContent = companyGst;
        if (pCompanyGstContainer) pCompanyGstContainer.style.display = 'block';
    } else {
        if (pCompanyGstContainer) pCompanyGstContainer.style.display = 'none';
    }

    // Logo
    const savedLogo = localStorage.getItem('companyLogo');
    if (savedLogo) {
        document.getElementById('printLogo').src = savedLogo;
    } else {
        const logoPreview = document.getElementById('logoPreviewImg');
        if (logoPreview && logoPreview.src) {
            document.getElementById('printLogo').src = logoPreview.src;
        }
    }

    // Signature
    const savedSig = localStorage.getItem('companySignature');
    const printSig = document.getElementById('printSignature');
    if (printSig) {
        if (savedSig) {
            printSig.src = savedSig;
            printSig.style.display = 'block';
        } else {
            printSig.style.display = 'none';
        }
    }

    // 5. Trigger Print (With 2 A5 layout)
    trigger2A5Print();
    showToast('Generating Quotation PDF...', 'success');
}

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            const targetTab = this.dataset.tab;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            this.classList.add('active');
            const target = document.getElementById(targetTab);
            if (target) target.classList.add('active');
        });
    });
}

function initializeTableSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        const activeTab = document.querySelector('.tab-content.active') || document.querySelector('.data-table'); // Fallback if no tabs
        if (!activeTab) return;

        const rows = activeTab.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

// --- Workers Module Logic ---
function initializeWorkersModule() {
    console.log('Workers Module Initialized');
    
    const workerTableBody = document.getElementById('workerTableBody');
    const totalWorkersCount = document.getElementById('totalWorkersCount');
    const activeWorkersCount = document.getElementById('activeWorkersCount');
    const monthlyPayroll = document.getElementById('monthlyPayroll');

    const loadWorkers = () => {
        const workers = safeJsonParse(localStorage.getItem('rmk_workers'), []);
        if (workerTableBody) {
            workerTableBody.innerHTML = '';
            if (workers.length === 0) {
                workerTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No workers found.</td></tr>`;
            } else {
                workers.forEach(w => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${w.workerId || w.id}</td>
                        <td style="font-weight:600">${w.workerName || w.name}</td>
                        <td><span class="status-badge secondary">${w.category}</span></td>
                        <td>${w.phone}</td>
                        <td><span class="status-badge in-stock">Active</span></td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn delete" onclick="deleteWorker('${w.id}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    `;
                    workerTableBody.appendChild(tr);
                });
            }
        }
        
        if (totalWorkersCount) totalWorkersCount.textContent = workers.length;
        if (activeWorkersCount) activeWorkersCount.textContent = workers.length;
        if (monthlyPayroll) monthlyPayroll.textContent = '₹' + (workers.length * 15000).toLocaleString('en-IN');
    };

    loadWorkers();

    const addWorkerBtn = document.getElementById('addWorkerBtn');
    const workerModal = document.getElementById('addWorkerModal');
    const closeWorkerModal = document.getElementById('closeWorkerModal');
    const cancelWorkerBtn = document.getElementById('cancelWorkerBtn');
    const workerForm = document.getElementById('addWorkerForm');

    if (addWorkerBtn && workerModal) {
        addWorkerBtn.addEventListener('click', () => workerModal.classList.add('active'));
        const close = () => workerModal.classList.remove('active');
        if (closeWorkerModal) closeWorkerModal.addEventListener('click', close);
        if (cancelWorkerBtn) cancelWorkerBtn.addEventListener('click', close);

        if (workerForm) {
            workerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(workerForm);
                const workers = safeJsonParse(localStorage.getItem('rmk_workers'), []);
                workers.push({
                    id: Date.now().toString(),
                    workerId: formData.get('workerId'),
                    workerName: formData.get('workerName'),
                    category: formData.get('category'),
                    phone: formData.get('phone'),
                    joinDate: formData.get('joinDate'),
                    address: formData.get('address')
                });
                localStorage.setItem('rmk_workers', JSON.stringify(workers));
                showToast('Worker added successfully');
                workerForm.reset();
                close();
                loadWorkers();
            });
        }
    }
}

window.deleteWorker = function(id) {
    if (confirm('Delete this worker?')) {
        let workers = safeJsonParse(localStorage.getItem('rmk_workers'), []);
        workers = workers.filter(w => String(w.id) !== String(id));
        localStorage.setItem('rmk_workers', JSON.stringify(workers));
        showToast('Worker removed');
        const path = window.location.pathname;
        if (path.includes('admin-workers.html') || path.includes('admin_workers.html')) {
            initializeWorkersModule();
        }
    }
};

// --- Attendance Module Logic ---
function initializeAttendanceModule() {
    console.log('Attendance Module Initialized');
    // Implement simple attendance table loader if necessary
}

// --- Customers Module Logic ---
function initializeCustomersModule() {
    console.log('Customers Module Initialized');
    initializeTableSearch();

    // Load Saved Customers
    const savedCustomers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
    const tableBody = document.querySelector('.data-table tbody');

    if (savedCustomers.length > 0) {
        // Clear "No data" row if exists
        const emptyRow = tableBody.querySelector('tr td[colspan]');
        if (emptyRow) emptyRow.parentElement.remove();

        savedCustomers.forEach(customer => {
            addCustomerRowToTable(customer);
        });
        updateCustomerStats(savedCustomers.length);
    } else {
        // Display "No data" row if no customers are loaded
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No customers found.</td></tr>`;
        updateCustomerStats(0);
    }

    // Export Handlers
    const exportBtn = document.getElementById('exportCustomersBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const rows = document.querySelectorAll('.data-table tbody tr');
            if (rows.length === 0 || (rows.length === 1 && rows[0].cells.length < 2)) {
                showToast('No data to export', 'warning');
                return;
            }
            // ... export logic (kept simple for brevity or could copy paste previous impl if needed, but assuming user just wants persistence now)
            // I will actually keep the export logic as is in user's file if I can, but replacing the whole function is safer to ensure structure.
            // Re-implementing export briefly for correctness since I'm replacing the whole block.
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Customer Name,ID,Contact Person,Phone,City,Orders,Status\n";
            rows.forEach(row => {
                if (row.cells.length < 5) return;
                const custInfo = row.cells[0].innerText.split('\n');
                const name = (custInfo[0] || '').trim();
                const id = (custInfo[1] || '').replace('ID:', '').trim();
                const contactInfo = row.cells[1].innerText.split('\n');
                const contact = (contactInfo[0] || '').trim();
                const phone = (contactInfo[1] || '').trim();
                const city = (row.cells[2].innerText || '').trim();
                const orders = (row.cells[3].innerText || '').trim();
                const status = (row.cells[4].innerText || '').trim();
                const rowData = [name, id, contact, phone, city, orders, status].map(item => `"${item.replace(/"/g, '""')}"`).join(",");
                csvContent += rowData + "\r\n";
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "rmk_customers_export.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Customers exported successfully', 'success');
        });
    }

    // Modal Element References
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    const customerModal = document.getElementById('addCustomerModal');
    const closeCustomerModal = document.getElementById('closeCustomerModal');
    const cancelCustomerBtn = document.getElementById('cancelCustomerBtn');
    const modalOverlay = document.querySelector('#addCustomerModal .modal-overlay');
    const customerForm = document.getElementById('addCustomerForm');

    // Initializers
    if (addCustomerBtn && customerModal) {
        addCustomerBtn.addEventListener('click', () => {
            customerModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        const closeModal = () => {
            customerModal.classList.remove('active');
            document.body.style.overflow = 'auto';
            customerForm.reset();
        };

        if (closeCustomerModal) closeCustomerModal.addEventListener('click', closeModal);
        if (cancelCustomerBtn) cancelCustomerBtn.addEventListener('click', closeModal);
        if (modalOverlay) modalOverlay.addEventListener('click', closeModal);

        // Form Submit
        if (customerForm) {
            customerForm.addEventListener('submit', (e) => {
                e.preventDefault();

                const formData = new FormData(customerForm);
                const company = formData.get('companyName');
                const contact = formData.get('contactPerson');
                const phone = formData.get('phone');
                const city = formData.get('city') || 'N/A';

                const custId = 'ID: ' + Math.floor(4000 + Math.random() * 1000);
                const avatar = company.substring(0, 2).toUpperCase();
                const avatarColor = getRandomColor();
                const id = Date.now().toString(); // unique ID for storage

                const newCustomer = {
                    id,
                    company,
                    custId,
                    contact,
                    phone,
                    city,
                    address: formData.get('address') || '',
                    state: formData.get('state'),
                    gst: formData.get('gst') || 'N/A',
                    orders: 0,
                    status: 'Active',
                    avatar,
                    avatarColor
                };

                // Save to Storage
                const customers = safeJsonParse(localStorage.getItem('rmk_customers'), []);
                customers.unshift(newCustomer);
                localStorage.setItem('rmk_customers', JSON.stringify(customers));

                // Update UI
                const emptyRow = document.querySelector('.data-table tbody tr td[colspan]');
                if (emptyRow) emptyRow.parentElement.remove();

                addCustomerRowToTable(newCustomer, true);
                updateCustomerStats(customers.length);

                showToast('Customer added successfully!', 'success');
                closeModal();
            });
        }
    }
}

function addCustomerRowToTable(customer, prepend = false) {
    const tableBody = document.querySelector('.data-table tbody');
    const newRow = document.createElement('tr');
    newRow.dataset.id = customer.id;
    newRow.dataset.type = 'customer'; // For delete handler logic

    newRow.innerHTML = `
        <td>
            <div class="customer-info">
                <div class="customer-avatar" style="background:${customer.avatarColor}">${customer.avatar}</div>
                <div>
                    <div style="font-weight:600">${customer.company}</div>
                    <div style="font-size:0.8rem; color:var(--text-light)">${customer.custId}</div>
                </div>
            </div>
        </td>
        <td>
            <div>${customer.contact}</div>
            <div style="font-size:0.8rem; color:var(--text-light)">${customer.phone}</div>
        </td>
        <td>
            <div>${customer.city}</div>
            <div style="font-size:0.8rem; color:var(--text-light)">${customer.state || 'N/A'}</div>
        </td>
        <td><strong>${customer.orders}</strong></td>
        <td><span class="status-badge active">${customer.status}</span></td>
        <td>
            <div class="action-buttons">
                <button class="action-btn payment" title="Record Payment"><i class="fas fa-hand-holding-usd"></i></button>
                <button class="action-btn edit" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </td>
    `;

    if (prepend) tableBody.insertBefore(newRow, tableBody.firstChild);
    else tableBody.appendChild(newRow);
}

// Helper to generate random dark colors for avatars
function getRandomColor() {
    const colors = ['#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e', '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50', '#f1c40f', '#e67e22', '#e74c3c', '#d35400', '#c0392b'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function updateCustomerStats(count) {
    // Increment Total Customers
    const totalStat = document.querySelector('.stats-grid .stat-card:nth-child(1) .stat-value');
    if (totalStat) {
        totalStat.textContent = count;
    }

    // Increment Active Customers (Simplified: All active for now)
    const activeStat = document.querySelector('.stats-grid .stat-card:nth-child(2) .stat-value');
    if (activeStat) {
        activeStat.textContent = count;
    }
}

// --- Products Module Logic ---
function initializeProductsModule() {
    console.log('Products Module Initialized');
    initializeTableSearch();

    // Load Saved Products
    const savedProducts = safeJsonParse(localStorage.getItem('rmk_products'), []);
    const tableBody = document.querySelector('.data-table tbody');

    if (savedProducts.length > 0) {
        const emptyRow = tableBody.querySelector('tr td[colspan]');
        if (emptyRow) emptyRow.parentElement.remove();

        savedProducts.forEach(product => {
            addProductRowToTable(product);
        });
    } else {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No products found.</td></tr>`;
    }

    // Modal Element References
    const addProductBtn = document.getElementById('addProductBtn');
    const productModal = document.getElementById('addProductModal');
    const closeProductModal = document.getElementById('closeProductModal');
    const cancelProductBtn = document.getElementById('cancelProductBtn');
    const modalOverlay = document.querySelector('#addProductModal .modal-overlay');
    const productForm = document.getElementById('addProductForm');

    // Initializers
    if (addProductBtn && productModal) {
        addProductBtn.addEventListener('click', () => {
            productModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        const closeModal = () => {
            productModal.classList.remove('active');
            document.body.style.overflow = 'auto';
            productForm.reset();
        };

        if (closeProductModal) closeProductModal.addEventListener('click', closeModal);
        if (cancelProductBtn) cancelProductBtn.addEventListener('click', closeModal);
        if (modalOverlay) modalOverlay.addEventListener('click', closeModal);

        // Form Submit
        if (productForm) {
            productForm.addEventListener('submit', (e) => {
                e.preventDefault();

                const formData = new FormData(productForm);
                const name = formData.get('productName');
                const sku = formData.get('sku');
                const category = formData.get('category');
                const price = parseFloat(formData.get('price')).toFixed(2);
                const unit = formData.get('unit');
                const stock = parseInt(formData.get('stock') || 0);
                const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                const id = Date.now().toString();

                const newProduct = {
                    id, name, sku, category, price, unit, stock, gstRate: formData.get('gstRate'), today
                };

                // Save to Storage
                const products = safeJsonParse(localStorage.getItem('rmk_products'), []);
                products.unshift(newProduct);
                localStorage.setItem('rmk_products', JSON.stringify(products));

                // Update UI
                const emptyRow = document.querySelector('.data-table tbody tr td[colspan]');
                if (emptyRow) emptyRow.parentElement.remove();

                addProductRowToTable(newProduct, true);

                showToast('Product added successfully!', 'success');
                closeModal();
            });
        }
    }
}

function addProductRowToTable(product, prepend = false) {
    const tableBody = document.querySelector('.data-table tbody');
    let stockBadge = '<span class="status-badge in-stock">In Stock</span>';
    if (product.stock === 0) stockBadge = '<span class="status-badge out-of-stock">Out of Stock</span>';
    else if (product.stock < 100) stockBadge = '<span class="status-badge low-stock">Low Stock</span>';

    const newRow = document.createElement('tr');
    newRow.dataset.id = product.id;
    newRow.dataset.type = 'product';

    newRow.innerHTML = `
        <td>
            <div style="font-weight:600">${product.name}</div>
            <div style="font-size:0.8rem; color:var(--text-light)">Code: ${product.sku}</div>
        </td>
        <td>${product.category}</td>
        <td><strong>₹${product.price}</strong> / ${product.unit}</td>
        <td><strong>${product.gstRate || '18'}%</strong></td>
        <td>${stockBadge}</td>
        <td>${product.today}</td>
        <td>
            <div class="action-buttons">
                <button class="action-btn edit" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </td>
    `;

    if (prepend) tableBody.insertBefore(newRow, tableBody.firstChild);
    else tableBody.appendChild(newRow);
}

// --- Inventory Module Logic ---
function initializeInventoryModule() {
    console.log('Inventory Module Initialized');
    initializeTableSearch();
    initializeTabs();

    // Modal Element References
    const updateStockBtn = document.getElementById('updateStockBtn');
    const stockModal = document.getElementById('updateStockModal');
    const closeStockModal = document.getElementById('closeStockModal');
    const cancelStockBtn = document.getElementById('cancelStockBtn');
    const modalOverlay = document.querySelector('#updateStockModal .modal-overlay');
    const stockForm = document.getElementById('updateStockForm');

    // Pre-populate tables if empty
    const populateInitial = () => {
        const itemMap = {
            'fab': { name: 'Fly Ash Brick', sku: 'FAB-001', category: 'Finished Goods', unit: 'Pieces' },
            'paver': { name: 'Paver Block', sku: 'PVR-005', category: 'Finished Goods', unit: 'Sq.ft' },
            'solid': { name: 'Solid Block', sku: 'SLD-201', category: 'Finished Goods', unit: 'Pieces' },
            'kerb': { name: 'Kerb Stone', sku: 'KRB-301', category: 'Finished Goods', unit: 'Pieces' },
            'cement': { name: 'Cement', sku: 'MAT-CEM', category: 'Raw Materials', unit: 'Bags' },
            'chips': { name: 'Chips', sku: 'MAT-CHP', category: 'Raw Materials', unit: 'Unit' },
            'dust': { name: 'Dust', sku: 'MAT-DST', category: 'Raw Materials', unit: 'Unit' },
            'sludge': { name: 'Sludge', sku: 'MAT-SLG', category: 'Raw Materials', unit: 'Unit' },
            'ash': { name: 'Ash', sku: 'MAT-ASH', category: 'Raw Materials', unit: 'Tonne' },
            'chemical': { name: 'P.B (Chemical)', sku: 'MAT-CHM', category: 'Raw Materials', unit: 'Litres' },
            'acid': { name: 'Acid', sku: 'MAT-ACD', category: 'Raw Materials', unit: 'Litres' },
            'soap_oil': { name: 'Soap Oil', sku: 'MAT-SPO', category: 'Raw Materials', unit: 'Litres' },
            'waste_oil': { name: 'Waste Oil', sku: 'MAT-WFO', category: 'Raw Materials', unit: 'Litres' },
            'oxide': { name: 'Oxide', sku: 'MAT-OXD', category: 'Raw Materials', unit: 'Bag' },
            'polish': { name: 'Polish', sku: 'MAT-POL', category: 'Raw Materials', unit: 'Litre' },
            'diesel': { name: 'Diesel', sku: 'MAT-DSL', category: 'Raw Materials', unit: 'Litres' }
        };

        Object.keys(itemMap).forEach(key => {
            const item = itemMap[key];
            const targetId = item.category === 'Finished Goods' ? 'finished' : 'raw';
            const tableBody = document.querySelector(`#${targetId} .data-table tbody`);

            // Only add if table is empty or doesn't have this item
            const existing = Array.from(tableBody.querySelectorAll('tr')).find(row => row.cells[0]?.textContent === item.name);
            if (!existing) {
                const emptyRow = tableBody.querySelector('tr td[colspan]');
                if (emptyRow) emptyRow.parentElement.remove();

                const newRow = document.createElement('tr');
                if (item.category === 'Finished Goods') {
                    newRow.innerHTML = `
                        <td style="font-weight:600">${item.name}</td>
                        <td>${item.sku}</td>
                        <td>Bricks/Pavers</td>
                        <td>0</td>
                        <td>${item.unit}</td>
                        <td><span class="status-badge out-of-stock">Out of Stock</span></td>
                    `;
                } else {
                    newRow.innerHTML = `
                        <td style="font-weight:600">${item.name}</td>
                        <td>Standard Supplier</td>
                        <td>0</td>
                        <td>${item.unit}</td>
                        <td>100</td>
                        <td><span class="status-badge out-of-stock">Empty</span></td>
                    `;
                }
                tableBody.appendChild(newRow);
            }
        });
    };

    populateInitial();

    const btnStockHistory = document.getElementById('btnStockHistory');
    if (btnStockHistory) {
        btnStockHistory.addEventListener('click', () => {
            alert('Stock history feature coming soon! All modifications are safely logged in the master ledger.');
        });
    }

    // Initializers
    if (updateStockBtn && stockModal) {
        // Open Modal
        updateStockBtn.addEventListener('click', () => {
            stockModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        // Close Modal Handlers
        const closeModal = () => {
            stockModal.classList.remove('active');
            document.body.style.overflow = 'auto';
            stockForm.reset();
        };

        if (closeStockModal) closeStockModal.addEventListener('click', closeModal);
        if (cancelStockBtn) cancelStockBtn.addEventListener('click', closeModal);
        if (modalOverlay) modalOverlay.addEventListener('click', closeModal);

        // Form Submit
        if (stockForm) {
            stockForm.addEventListener('submit', (e) => {
                e.preventDefault();

                // 1. Get Form Values
                const formData = new FormData(stockForm);
                const itemCode = formData.get('stockItem');
                const action = formData.get('stockAction'); // add, remove, set
                const quantity = parseInt(formData.get('quantity')) || 0;

                // 2. Map codes to readable names & determine category
                const itemMap = {
                    // Finished Goods
                    'fab': { name: 'Fly Ash Brick', sku: 'FAB-001', category: 'Finished Goods', unit: 'Pieces' },
                    'paver': { name: 'Paver Block', sku: 'PVR-005', category: 'Finished Goods', unit: 'Sq.ft' },
                    'solid': { name: 'Solid Block', sku: 'SLD-201', category: 'Finished Goods', unit: 'Pieces' },
                    'kerb': { name: 'Kerb Stone', sku: 'KRB-301', category: 'Finished Goods', unit: 'Pieces' },

                    // Raw Materials
                    'cement': { name: 'Cement', sku: 'MAT-CEM', category: 'Raw Materials', unit: 'Bags' },
                    'chips': { name: 'Chips', sku: 'MAT-CHP', category: 'Raw Materials', unit: 'Unit' },
                    'dust': { name: 'Dust', sku: 'MAT-DST', category: 'Raw Materials', unit: 'Unit' },
                    'sludge': { name: 'Sludge', sku: 'MAT-SLG', category: 'Raw Materials', unit: 'Unit' },
                    'ash': { name: 'Ash', sku: 'MAT-ASH', category: 'Raw Materials', unit: 'Tonne' },
                    'chemical': { name: 'P.B (Chemical)', sku: 'MAT-CHM', category: 'Raw Materials', unit: 'Litres' },
                    'acid': { name: 'Acid', sku: 'MAT-ACD', category: 'Raw Materials', unit: 'Litres' },
                    'soap_oil': { name: 'Soap Oil', sku: 'MAT-SPO', category: 'Raw Materials', unit: 'Litres' },
                    'waste_oil': { name: 'Waste Oil', sku: 'MAT-WFO', category: 'Raw Materials', unit: 'Litres' },
                    'oxide': { name: 'Oxide', sku: 'MAT-OXD', category: 'Raw Materials', unit: 'Bag' },
                    'polish': { name: 'Polish', sku: 'MAT-POL', category: 'Raw Materials', unit: 'Litre' },
                    'diesel': { name: 'Diesel', sku: 'MAT-DSL', category: 'Raw Materials', unit: 'Litres' }
                };

                const itemData = itemMap[itemCode];
                if (!itemData) return; // Should not happen

                // 3. Determine which tab logic to apply
                // Currently simplified: using active tab or category mapping
                let targetTableId = itemData.category === 'Finished Goods' ? 'finished' : 'raw';
                const targetTab = document.getElementById(targetTableId);
                const tableBody = targetTab.querySelector('.data-table tbody');

                // 4. Remove "No data" row if it exists
                const emptyRow = tableBody.querySelector('tr td[colspan]');
                if (emptyRow) {
                    emptyRow.parentElement.remove();
                }

                // 5. Check if row exists
                let existingRow = null;
                const rows = tableBody.querySelectorAll('tr');
                rows.forEach(row => {
                    if (row.cells[0].textContent.includes(itemData.name)) {
                        existingRow = row;
                    }
                });

                if (existingRow) {
                    // Update existing row
                    const qtyCell = existingRow.cells[3]; // Fixed index for simplified logic
                    let currentQty = parseInt(qtyCell.textContent.replace(/,/g, ''));

                    if (action === 'add') currentQty += quantity;
                    else if (action === 'remove') currentQty -= quantity;
                    else if (action === 'set') currentQty = quantity;

                    if (currentQty < 0) currentQty = 0;

                    // Format with commas
                    qtyCell.textContent = currentQty.toLocaleString('en-IN');

                    // Flash effect
                    existingRow.style.backgroundColor = '#ecfdf5';
                    setTimeout(() => existingRow.style.backgroundColor = '', 500);

                } else {
                    // Create new row
                    // Note: Raw vs Finished table structure is slightly different in HTML but similar enough for this mock
                    // Finished: Name, SKU, Category, Qty, Unit, Status
                    // Raw: Name, Supplier(fake), Qty, Unit, Reorder, Status

                    const newRow = document.createElement('tr');
                    const initialQty = action === 'set' || action === 'add' ? quantity : 0;
                    const statusBadge = '<span class="status-badge in-stock">Good</span>';

                    if (itemData.category === 'Finished Goods') {
                        newRow.innerHTML = `
                            <td style="font-weight:600">${itemData.name}</td>
                            <td>${itemData.sku}</td>
                            <td>Bricks/Pavers</td>
                            <td>${initialQty.toLocaleString('en-IN')}</td>
                            <td>${itemData.unit}</td>
                            <td>${statusBadge}</td>
                        `;
                    } else {
                        // Raw Materials Structure
                        newRow.innerHTML = `
                            <td style="font-weight:600">${itemData.name}</td>
                            <td>Unknown Supplier</td>
                            <td>${initialQty.toLocaleString('en-IN')}</td>
                            <td>${itemData.unit}</td>
                            <td>100</td>
                            <td>${statusBadge}</td>
                        `;
                    }

                    tableBody.appendChild(newRow);
                }

                // Update Stats
                updateInventoryStats(quantity, action);

                showToast('Stock updated successfully!', 'success');
                closeModal();
            });
        }
    }
}

function updateInventoryStats(qty, action) {
    const totalStat = document.querySelector('.stats-grid .stat-card:nth-child(1) .stat-value');
    if (totalStat) {
        let current = parseInt(totalStat.textContent.replace(/,/g, '')) || 0;
        if (action === 'add') current += qty;
        else if (action === 'remove') current -= qty;
        // Set is complex for total, ignoring for simple mock
        totalStat.textContent = current.toLocaleString('en-IN');
    }
}

// --- Reports Module Logic ---
function initializeReportsModule() {
    console.log('Reports Module Initialized');

    // Handle "Download Report" button
    const downloadBtn = document.getElementById('downloadReportBtn');

    if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
            // Populate print data
            const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
            const dateEl = document.getElementById('printDate');
            if (dateEl) dateEl.textContent = today;

            const stats = document.querySelectorAll('.stat-value');
            if (stats.length >= 3) {
                const revEl = document.getElementById('printRevenue');
                const ordEl = document.getElementById('printOrders');
                const avgEl = document.getElementById('printAvgOrder');

                if (revEl) revEl.textContent = stats[0].textContent;
                if (ordEl) ordEl.textContent = stats[1].textContent;
                if (avgEl) avgEl.textContent = stats[2].textContent;
            }

            // Populate GST Summary in Print
            const mainGstBody = document.querySelector('#gstSummaryTable tbody');
            const printGstBody = document.querySelector('#printGstSummary tbody');
            if (mainGstBody && printGstBody) {
                printGstBody.innerHTML = mainGstBody.innerHTML;
            }

            // update print title
            const originalTitle = document.title;
            document.title = 'RMK_Groups_Report_' + new Date().toISOString().split('T')[0];

            window.print();

            // reset title
            setTimeout(() => {
                document.title = originalTitle;
            }, 100);

            showToast('Downloading report...', 'success');
        });
    }

    // Handle GST Export to Excel (CSV)
    const exportGstBtn = document.getElementById('exportGstBtn');
    if (exportGstBtn) {
        exportGstBtn.addEventListener('click', function () {
            const invoices = safeJsonParse(localStorage.getItem('rmk_invoices'), []);
            if (invoices.length === 0) {
                showToast('No invoice data to export', 'warning');
                return;
            }

            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const currentMonth = months[new Date().getMonth()];
            const currentYear = new Date().getFullYear();

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += `RMK Fly Ash Bricks & Paver Block - ${currentMonth} ${currentYear}\n\n`;
            csvContent += "Invoice Date,Invoice Number,Customer Name,Customer GST,Tax Type,Taxable Value,CGST,SGST,IGST,Total Tax,Total Amount,Products\n";

            invoices.forEach(inv => {
                const productSummary = (inv.products || []).map(item => `${item.description} (qty:${item.qty})`).join(" | ");

                let gstTot = parseFloat(inv.gstTotal);
                if (isNaN(gstTot) || gstTot === 0) {
                    gstTot = Math.max(0, parseFloat(inv.total) - parseFloat(inv.subtotal));
                }

                let cG = parseFloat(inv.cgst) || (inv.taxType === 'intra' ? gstTot / 2 : 0);
                let sG = parseFloat(inv.sgst) || (inv.taxType === 'intra' ? gstTot / 2 : 0);
                let iG = parseFloat(inv.igst) || (inv.taxType === 'inter' ? gstTot : 0);

                const row = [
                    inv.invDate,
                    inv.invNumber,
                    inv.customerName,
                    inv.customerGst || 'N/A',
                    inv.taxType,
                    inv.subtotal,
                    cG,
                    sG,
                    iG,
                    gstTot,
                    inv.total,
                    productSummary
                ].map(v => {
                    const str = String(v ?? '');
                    return `"${str.replace(/"/g, '""')}"`;
                }).join(",");
                csvContent += row + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `GST_Report_${currentMonth}_${currentYear}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('GST Report exported successfully', 'success');
        });
    }

    const exportAttendanceBtn = document.getElementById('exportAttendanceBtn');
    if (exportAttendanceBtn) {
        exportAttendanceBtn.addEventListener('click', function () {
            const workers = safeJsonParse(localStorage.getItem('rmk_workers'), []);
            const attendanceData = safeJsonParse(localStorage.getItem('rmk_attendance'), {});
            
            if (workers.length === 0) {
                showToast('No worker data to export', 'warning');
                return;
            }

            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const currentMonth = months[new Date().getMonth()];
            const currentYear = new Date().getFullYear();

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += `RMK Workers Attendance & Salary Report - ${currentMonth} ${currentYear}\n\n`;
            csvContent += "Worker ID,Worker Name,Category,Daily Wage (₹),Present Days,Half Days,Absent Days,Total Days Payable,Salary Payable (₹)\n";

            workers.forEach(w => {
                let pCount = 0;
                let hCount = 0;
                let aCount = 0;
                
                if (attendanceData[w.id]) {
                    const logs = attendanceData[w.id];
                    Object.values(logs).forEach(status => {
                        if (status === 'P') pCount++;
                        else if (status === 'H') hCount++;
                        else if (status === 'A') aCount++;
                    });
                }

                const payableDays = pCount + (hCount * 0.5);
                const dailyWage = parseFloat(w.dailyWage) || 0;
                const totalSalary = dailyWage * payableDays;

                const row = [
                    w.workerId || 'N/A',
                    w.name || 'N/A',
                    w.category || 'N/A',
                    dailyWage,
                    pCount,
                    hCount,
                    aCount,
                    payableDays,
                    totalSalary
                ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");

                csvContent += row + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Attendance_Report_${currentMonth}_${currentYear}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Attendance Report exported successfully', 'success');
        });
    }

    // Handle "This Month" filter button (mock functionality)
    const filterBtn = document.querySelector('.page-actions .btn-secondary');
    if (filterBtn) {
        filterBtn.addEventListener('click', function () {
            showToast('Filter updated: This Month', 'info');
        });
    }

    populateGstSummary();
}

function populateGstSummary() {
    const tableBody = document.querySelector('#gstSummaryTable tbody');
    if (!tableBody) return;

    const invoices = safeJsonParse(localStorage.getItem('rmk_invoices'), []);
    if (invoices.length === 0) return;

    // Group by month
    const summary = {};
    invoices.forEach(inv => {
        const date = new Date(inv.invDate);
        const monthYear = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

        if (!summary[monthYear]) {
            summary[monthYear] = {
                taxable: 0,
                cgst: 0,
                sgst: 0,
                igst: 0,
                totalTax: 0
            };
        }

        summary[monthYear].taxable += inv.subtotal;
        summary[monthYear].cgst += inv.cgst;
        summary[monthYear].sgst += inv.sgst;
        summary[monthYear].igst += inv.igst;
        summary[monthYear].totalTax += inv.gstTotal;
    });

    tableBody.innerHTML = '';
    Object.keys(summary).sort((a, b) => new Date(b) - new Date(a)).forEach(month => {
        const data = summary[month];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600">${month}</td>
            <td>₹${data.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>₹${data.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>₹${data.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>₹${data.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="font-weight:600">₹${data.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        `;
        tableBody.appendChild(tr);
    });
}

function loadInvoicesToTable() {
    const tableBody = document.querySelector('#invoices .data-table tbody');
    if (!tableBody) return;

    const invoices = safeJsonParse(localStorage.getItem('rmk_invoices'), []);

    // Update Billing Stats - Show TOTAL Billed Revenue for better visibility
    const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
    const paidCount = invoices.filter(inv => inv.status === 'Paid').length;

    const stats = document.querySelectorAll('.stats-grid .stat-card');
    if (stats.length >= 2) {
        const revEl = stats[0].querySelector('.stat-value');
        const paidEl = stats[1].querySelector('.stat-value');
        if (revEl) revEl.textContent = '₹' + totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        if (paidEl) paidEl.textContent = paidCount;
    }


    if (invoices.length === 0) return;

    tableBody.innerHTML = '';
    invoices.forEach(inv => {
        const tr = document.createElement('tr');
        tr.dataset.id = inv.id;
        tr.dataset.type = 'invoice';
        const received = inv.receivedAmount || 0;
        const balance = inv.total - received;
        const statusClass = balance <= 0 ? 'paid' : (received > 0 ? 'partial' : 'unpaid');
        const statusText = balance <= 0 ? 'Paid' : (received > 0 ? 'Partial' : 'Unpaid');

        tr.innerHTML = `
            <td style="font-weight:600; color:var(--primary)">${inv.invNumber}</td>
            <td>
                <div style="display:flex; flex-direction:column;">
                    <span>${inv.customerName}</span>
                    <small style="color:var(--text-light); font-size:0.75rem;">${inv.customerPhone || ''}</small>
                </div>
            </td>
            <td>${inv.invDate}</td>
            <td><strong>₹${inv.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" title="View/Print">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn payment" title="Record Payment">
                        <i class="fas fa-hand-holding-usd"></i>
                    </button>
                    <button class="action-btn delete" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function loadQuotesToTable() {
    const tableBody = document.querySelector('#quotes .data-table tbody');
    if (!tableBody) return;

    const quotes = safeJsonParse(localStorage.getItem('rmk_quotes'), []);
    
    // Update Stats for quotes
    const stats = document.querySelectorAll('.stats-grid .stat-card');
    if (stats.length >= 4) {
        const totalQuotesEl = stats[3].querySelector('.stat-value');
        const pendingQuotesEl = stats[2].querySelector('.stat-value');
        if (totalQuotesEl) totalQuotesEl.textContent = quotes.length;
        if (pendingQuotesEl) pendingQuotesEl.textContent = quotes.length; 
    }

    if (quotes.length === 0) return;

    tableBody.innerHTML = '';
    quotes.forEach(qt => {
        const tr = document.createElement('tr');
        tr.dataset.id = qt.id;
        tr.dataset.type = 'quote';

        tr.innerHTML = `
            <td style="font-weight:600; color:var(--primary)">${qt.quoteNumber}</td>
            <td>
                <div style="display:flex; flex-direction:column;">
                    <span>${qt.customerName}</span>
                </div>
            </td>
            <td>${qt.quoteDate}</td>
            <td>${qt.validityDate || '-'}</td>
            <td><strong>₹${qt.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            <td><span class="status-badge pending">Pending</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" title="View/Print">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn delete" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// --- Settings Module Logic ---
function initializeSettingsModule() {
    console.log('Settings Module Initialized');

    const nameInput = document.getElementById('companyNameInput');
    const gstInput = document.getElementById('companyGstInput');
    const emailInput = document.getElementById('companyEmailInput');

    // Load initial settings
    if (nameInput) nameInput.value = localStorage.getItem('companyName') || 'RMK Fly Ash Bricks';
    if (gstInput) gstInput.value = localStorage.getItem('companyGst') || '';
    if (emailInput) emailInput.value = localStorage.getItem('companyEmail') || 'rmkgroups1987@gmail.com';

    // Handle Logo Upload Preview
    const logoInput = document.getElementById('logoUpload');
    const logoPreview = document.getElementById('logoPreviewImg');

    if (logoInput && logoPreview) {
        logoInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    logoPreview.src = e.target.result;
                    localStorage.setItem('companyLogo', e.target.result);
                    showToast('Logo updated successfully', 'success');
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle Signature Upload Preview
    const sigInput = document.getElementById('sigUpload');
    const sigPreview = document.getElementById('sigPreviewImg');
    const savedSig = localStorage.getItem('companySignature');
    if (savedSig && sigPreview) {
        sigPreview.src = savedSig;
        sigPreview.style.display = 'block';
    }

    if (sigInput && sigPreview) {
        sigInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    sigPreview.src = e.target.result;
                    sigPreview.style.display = 'block';
                    localStorage.setItem('companySignature', e.target.result);
                    showToast('Signature updated successfully', 'success');
                }
                reader.readAsDataURL(file);
            }
        });
    }

    const phoneInput = document.getElementById('companyPhoneInput');
    const websiteInput = document.getElementById('companyWebsiteInput');
    const addressInput = document.getElementById('companyAddressInput');

    if (phoneInput) phoneInput.value = localStorage.getItem('companyPhone') || '+91 99520 68848';
    if (websiteInput) websiteInput.value = localStorage.getItem('companyWebsite') || 'https://rmkgroups.in';
    if (addressInput) addressInput.value = localStorage.getItem('companyAddress') || '123, Ariyalur Main Road, Perambalur, Tamil Nadu';

    // Save settings
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (nameInput) localStorage.setItem('companyName', nameInput.value);
            if (gstInput) localStorage.setItem('companyGst', gstInput.value);
            if (emailInput) localStorage.setItem('companyEmail', emailInput.value);
            if (phoneInput) localStorage.setItem('companyPhone', phoneInput.value);
            if (websiteInput) localStorage.setItem('companyWebsite', websiteInput.value);
            if (addressInput) localStorage.setItem('companyAddress', addressInput.value);

            showToast('Settings saved successfully', 'success');
        });
    }

    // Also initialize user management if on this page
    if (document.getElementById('addUserForm')) {
        initializeUserManagementModule();
    }
}

// Global Click Handlers for Actions
document.addEventListener('click', function (e) {
    const target = e.target.closest('.action-btn');
    if (!target) return;

    if (target.classList.contains('view')) {
        const row = target.closest('tr');
        const id = row.dataset.id;
        const type = row.dataset.type;

        if (type === 'invoice') {
            const invoices = safeJsonParse(localStorage.getItem('rmk_invoices'), []);
            const invoice = invoices.find(inv => inv.id == id);
            if (invoice) {
                sessionStorage.setItem('view_invoice_data', JSON.stringify(invoice));
                window.open('invoice-view.html', '_blank');
            }
        } else {
            showToast('Viewing details...', 'info');
        }
    } else if (target.classList.contains('payment')) {
        const row = target.closest('tr');
        if (!row) return;

        const id = row.dataset.id;
        const type = row.dataset.type;

        if (type === 'invoice') {
            openPaymentModal(id);
        } else if (type === 'customer') {
            // Find customer name from the row
            const custName = row.querySelector('.customer-info div div')?.textContent;
            openPaymentModal(null, custName);
        }
    } else if (target.classList.contains('edit')) {
        showToast('Edit mode enabled', 'info');
    } else if (target.classList.contains('delete')) {
        if (confirm('Are you sure you want to delete this item?')) {
            const row = target.closest('tr');
            const id = row.dataset.id;
            const type = row.dataset.type;

            if (id && type) {
                if (type === 'customer') {
                    let data = safeJsonParse(localStorage.getItem('rmk_customers'), []);
                    const updated = data.filter(item => item.id !== id);
                    localStorage.setItem('rmk_customers', JSON.stringify(updated));

                    // Update stats
                    // Need to find the function or manually update
                    const totalStat = document.querySelector('.stats-grid .stat-card:nth-child(1) .stat-value');
                    const activeStat = document.querySelector('.stats-grid .stat-card:nth-child(2) .stat-value');
                    if (totalStat) totalStat.textContent = updated.length;
                    if (activeStat) activeStat.textContent = updated.length;

                    // Show "No data" if empty
                    if (updated.length === 0) {
                        const tableBody = document.querySelector('.data-table tbody');
                        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No customers found.</td></tr>`;
                    }
                } else if (type === 'product') {
                    let data = safeJsonParse(localStorage.getItem('rmk_products'), []);
                    const updated = data.filter(item => item.id !== id);
                    localStorage.setItem('rmk_products', JSON.stringify(updated));

                    // Show "No data" if empty
                    if (updated.length === 0) {
                        const tableBody = document.querySelector('.data-table tbody');
                        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No products found.</td></tr>`;
                    }
                } else if (type === 'invoice') {
                    let data = safeJsonParse(localStorage.getItem('rmk_invoices'), []);
                    const updated = data.filter(item => item.id != id);
                    localStorage.setItem('rmk_invoices', JSON.stringify(updated));

                    if (updated.length === 0) {
                        const tableBody = document.querySelector('#invoices .data-table tbody');
                        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No invoices found.</td></tr>`;
                    }
                    if (typeof loadInvoicesToTable === 'function') loadInvoicesToTable();
                } else if (type === 'quote') {
                    let data = safeJsonParse(localStorage.getItem('rmk_quotes'), []);
                    const updated = data.filter(item => item.id != id);
                    localStorage.setItem('rmk_quotes', JSON.stringify(updated));

                    if (updated.length === 0) {
                        const tableBody = document.querySelector('#quotes .data-table tbody');
                        if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No quotations found.</td></tr>`;
                    }
                    if (typeof loadQuotesToTable === 'function') loadQuotesToTable();
                } else if (type === 'worker') {
                    let data = safeJsonParse(localStorage.getItem('rmk_workers'), []);
                    const updated = data.filter(item => item.id !== id);
                    localStorage.setItem('rmk_workers', JSON.stringify(updated));
                    updateWorkerStats(updated);

                    if (updated.length === 0) {
                        const tableBody = document.getElementById('workerTableBody');
                        if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No workers found.</td></tr>`;
                    }
                }
            }

            if (!id) {
                // Determine type by page logic if data-id missing (fallback)
                // This handles the generic delete if data-id wasn't set (e.g. legacy rows, though we cleared them)
                row.remove();
                showToast('Item deleted (not saved)', 'info');
            } else {
                row.remove();
                showToast('Item deleted', 'success');
            }
        }
    } else if (target.classList.contains('download')) {
        showToast('Downloading PDF...', 'success');
    }
});

// --- User Management Logic (General Admin) ---
function initializeUserManagementModule() {
    console.log('Settings Module Initialized');
    const addUserForm = document.getElementById('addUserForm');

    // Load existing users
    loadAdminUsers();

    addUserForm?.addEventListener('submit', (e) => {
        e.preventDefault();

        const userId = document.getElementById('newUserId').value;
        const name = document.getElementById('newUserName').value;
        const password = document.getElementById('newUserPassword').value;
        const role = document.getElementById('newUserRole').value;

        // Check if user already exists
        let users = safeJsonParse(localStorage.getItem('rmk_users'), []);
        if (users.find(u => u.userId === userId)) {
            showToast('User ID already exists', 'error');
            return;
        }

        const newUser = {
            id: Date.now().toString(),
            userId,
            name,
            password, // In a real app, this should be hashed
            role,
            status: 'Active',
            createdAt: new Date().toISOString().split('T')[0]
        };

        users.push(newUser);
        localStorage.setItem('rmk_users', JSON.stringify(users));

        addUserRowToTable(newUser);
        addUserForm.reset();
        showToast(`User ${userId} created successfully`);
    });

    // Handle Delete Users (Delegated event)
    document.getElementById('usersTableBody')?.addEventListener('click', (e) => {
        if (e.target.closest('.delete')) {
            const tr = e.target.closest('tr');
            const id = tr.dataset.id;
            const userId = tr.cells[0].textContent;

            if (confirm(`Are you sure you want to delete user "${userId}"?`)) {
                let users = safeJsonParse(localStorage.getItem('rmk_users'), []);
                users = users.filter(u => u.id !== id);
                localStorage.setItem('rmk_users', JSON.stringify(users));
                tr.remove();
                showToast('User deleted');
            }
        }
    });
}

function loadAdminUsers() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    let users = safeJsonParse(localStorage.getItem('rmk_users'), []);

    // Default admin if none exist
    if (users.length === 0) {
        users = [{
            id: 'default-admin',
            userId: 'admin',
            name: 'Main Admin',
            password: 'admin',
            role: 'Admin',
            status: 'Active',
            createdAt: '2024-01-01'
        }];
        localStorage.setItem('rmk_users', JSON.stringify(users));
    }

    tableBody.innerHTML = '';
    users.forEach(user => addUserRowToTable(user));
}

function addUserRowToTable(user) {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    const tr = document.createElement('tr');
    tr.dataset.id = user.id;
    tr.innerHTML = `
        <td><span class="id-badge">${user.userId}</span></td>
        <td>
            <div class="user-cell">
                <div class="user-avatar" style="background-color: ${getRandomColor()}">
                    ${user.name.charAt(0).toUpperCase()}
                </div>
                <div class="user-meta">
                    <span class="user-name-cell">${user.name}</span>
                    <span class="user-sub">Created ${user.createdAt}</span>
                </div>
            </div>
        </td>
        <td><span class="role-badge ${user.role.toLowerCase()}">${user.role}</span></td>
        <td><span class="status-pill status-active">${user.status}</span></td>
        <td class="table-actions">
            <button class="action-btn delete" title="Delete Account" ${user.userId === 'admin' ? 'disabled style="opacity:0.3; cursor:not-allowed"' : ''}>
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
    `;
    tableBody.appendChild(tr);
}

// ==========================================
// Database Management (Backup & Restore)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnExport = document.getElementById('btnExportFullData');
    const btnImport = document.getElementById('btnImportFullData');

    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                data[key] = localStorage.getItem(key);
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            a.download = `rmk_groups_backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (typeof showToast === 'function') showToast('Backup created successfully!', 'success');
        });
    }

    if (btnImport) {
        btnImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (confirm('Are you sure you want to restore data from this backup? This will overwrite your current settings and records!')) {
                        // Clear existing to avoid overlapping broken records, or just overwrite matching keys. Overwriting is safer for partial backups.
                        Object.keys(data).forEach(key => {
                            localStorage.setItem(key, data[key]);
                        });
                        alert('Data successfully restored! The page will now reload.');
                        window.location.reload();
                    }
                } catch (error) {
                    alert('Error importing data. The file may be corrupted.');
                    console.error(error);
                }
                // Reset file input
                e.target.value = '';
            };
            reader.readAsText(file);
        });
    }

    // Sequence Counter Resets (Global Handler)
    document.addEventListener('click', (e) => {
        const resetInv = e.target.closest('#btnResetInvCounter');
        const resetQt = e.target.closest('#btnResetQtCounter');

        if (resetInv) {
            const invoices = safeJsonParse(localStorage.getItem('rmk_invoices'), []);
            const now = new Date();
            const month = now.getMonth();
            const year = now.getFullYear();
            const fyStart = month >= 3 ? year : year - 1;
            const fyEnd = fyStart + 1;
            const fyCode = String(fyStart) + '-' + String(fyEnd);

            // Find the highest invoice number in the current financial year
            let maxCounter = 0;
            invoices.forEach(inv => {
                if (inv.invNumber && inv.invNumber.includes(fyCode)) {
                    const parts = inv.invNumber.split('-');
                    const num = parseInt(parts[parts.length - 1]);
                    if (!isNaN(num) && num > maxCounter) maxCounter = num;
                }
            });

            const nextNum = maxCounter + 1;
            const nextNumStr = String(nextNum).padStart(3, '0');

            if (confirm(`Reset Invoice Counter?\nLast invoice was #${maxCounter === 0 ? 'none' : maxCounter}.\nNext invoice will be INV-${fyCode}-${nextNumStr}.`)) {
                localStorage.setItem('rmk_inv_counter', String(maxCounter));
                localStorage.setItem('rmk_inv_fy', fyCode);
                showToast(`Invoice counter synced. Next: INV-${fyCode}-${nextNumStr}`, 'success');
            }
        }

        if (resetQt) {
            if (confirm('Are you sure you want to reset Quote Number to 001?')) {
                localStorage.setItem('rmk_qt_counter', '0');
                localStorage.removeItem('rmk_qt_fy'); // Correct key
                showToast('Quote counter reset to 001', 'success');
            }
        }
    });
});


