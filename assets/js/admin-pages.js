// ============================================================
// DEDICATED PAGE: Create Invoice (admin-create-invoice.html)
// ============================================================
function initializeCreateInvoicePage() {
    const invNumEl = document.getElementById('invNumber');
    if (invNumEl) invNumEl.value = generateFinancialYearInvoiceNumber('invoice');

    const today = new Date();
    const invDate = document.getElementById('invDate');
    if (invDate) invDate.value = today.toISOString().split('T')[0];

    const customers = JSON.parse(localStorage.getItem('rmk_customers') || '[]');
    const custSel = document.getElementById('invCustomerName');
    if (custSel) {
        customers.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id || c.company;
            opt.textContent = c.company || c.name;
            opt.dataset.mobile = c.mobile || '';
            opt.dataset.gst = c.gst || '';
            opt.dataset.address = c.address || '';
            opt.dataset.state = c.state || '';
            custSel.appendChild(opt);
        });
        custSel.addEventListener('change', function () {
            const sel = this.options[this.selectedIndex];
            const mob = document.getElementById('invCustomClientMobile');
            const gst = document.getElementById('invCustomClientGst');
            const addr = document.getElementById('invCustomClientAddress');
            const taxType = document.getElementById('invTaxType');
            if (mob) mob.value = sel.dataset.mobile || '';
            if (gst) gst.value = sel.dataset.gst || '';
            if (addr) addr.value = sel.dataset.address || '';
            if (taxType) taxType.value = (sel.dataset.state === 'Tamil Nadu') ? 'intra' : 'inter';
            invoiceCalculateTotals();
        });
    }

    const invProductItems = document.getElementById('invProductItems');
    if (invProductItems && invProductItems.children.length === 0) addInvoiceProductRow();

    const addBtn = document.getElementById('invAddProductBtn');
    if (addBtn) addBtn.addEventListener('click', addInvoiceProductRow);

    const gstToggle = document.getElementById('invGstToggle');
    const gstRate = document.getElementById('invGstRate');
    if (gstToggle) gstToggle.addEventListener('change', function () { gstRate.disabled = !this.checked; invoiceCalculateTotals(); });
    if (gstRate) gstRate.addEventListener('change', invoiceCalculateTotals);
    const taxTypeEl = document.getElementById('invTaxType');
    if (taxTypeEl) taxTypeEl.addEventListener('change', invoiceCalculateTotals);
    const receivedEl = document.getElementById('invReceivedAmount');
    if (receivedEl) receivedEl.addEventListener('input', invoiceCalculateTotals);

    document.addEventListener('input', function (e) {
        if (e.target.classList.contains('inv-quantity-input') || e.target.classList.contains('inv-price-input')) {
            invoiceCalculateTotals();
        }
    });

    const saveOnlyBtn = document.getElementById('saveInvoiceOnlyBtn');
    if (saveOnlyBtn) {
        saveOnlyBtn.addEventListener('click', function () {
            if (!validateInvoiceForm()) return;
            const invoice = buildInvoiceObject(false);
            saveInvoiceToStorage(invoice);
            showToast('Invoice saved successfully!', 'success');
            setTimeout(() => window.location.href = 'admin-billing.html', 1200);
        });
    }

    const form = document.getElementById('invoiceForm');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!validateInvoiceForm()) return;
            const invoice = buildInvoiceObject(true);
            saveInvoiceToStorage(invoice);
            printInvoice();
        });
    }
}

function invoiceCalculateTotals() {
    const items = document.querySelectorAll('#invProductItems .product-item');
    let subtotal = 0;
    items.forEach(item => {
        const qty = parseFloat(item.querySelector('.inv-quantity-input') ? item.querySelector('.inv-quantity-input').value : 0) || 0;
        const price = parseFloat(item.querySelector('.inv-price-input') ? item.querySelector('.inv-price-input').value : 0) || 0;
        const amt = qty * price;
        const disp = item.querySelector('.inv-amount-display');
        if (disp) disp.value = amt.toFixed(2);
        subtotal += amt;
    });
    const gstToggle = document.getElementById('invGstToggle');
    const gstRateEl = document.getElementById('invGstRate');
    const taxTypeEl = document.getElementById('invTaxType');
    const selectedTax = taxTypeEl ? taxTypeEl.value : 'intra';
    let gstAmount = 0;
    if (gstToggle && gstToggle.checked) gstAmount = (subtotal * (parseFloat(gstRateEl.value) || 0)) / 100;
    const total = subtotal + gstAmount;
    const halfGstPc = (parseFloat(gstRateEl ? gstRateEl.value : 0) || 0) / 2;
    const halfGst = gstAmount / 2;
    const fmt = function(v) { return '\u20B9' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    const subtotalEl = document.getElementById('invSubtotalAmount');
    if (subtotalEl) subtotalEl.textContent = fmt(subtotal);
    const intraOnly = document.querySelectorAll('.inv-intra-only');
    const interOnly = document.querySelectorAll('.inv-inter-only');
    if (selectedTax === 'intra') {
        intraOnly.forEach(function(el) { el.style.display = 'flex'; });
        interOnly.forEach(function(el) { el.style.display = 'none'; });
        document.querySelectorAll('.inv-half-gst').forEach(function(el) { el.textContent = halfGstPc; });
        document.querySelectorAll('.inv-cgst-amount').forEach(function(el) { el.textContent = fmt(halfGst); });
        document.querySelectorAll('.inv-sgst-amount').forEach(function(el) { el.textContent = fmt(halfGst); });
    } else {
        intraOnly.forEach(function(el) { el.style.display = 'none'; });
        interOnly.forEach(function(el) { el.style.display = 'flex'; });
        const gstPcEl = document.getElementById('invGstPercentage');
        const gstAmEl = document.getElementById('invGstAmount');
        if (gstPcEl) gstPcEl.textContent = gstRateEl ? gstRateEl.value : '0';
        if (gstAmEl) gstAmEl.textContent = fmt(gstAmount);
    }
    const received = parseFloat(document.getElementById('invReceivedAmount') ? document.getElementById('invReceivedAmount').value : 0) || 0;
    const balance = Math.max(0, total - received);
    const totalEl = document.getElementById('invTotalAmount');
    if (totalEl) totalEl.textContent = fmt(total);
    const balEl = document.getElementById('invBalanceAmount');
    if (balEl) balEl.textContent = fmt(balance);
}

function validateInvoiceForm() {
    const custSel = document.getElementById('invCustomerName');
    const customNameEl = document.getElementById('invCustomClientName');
    const customName = customNameEl ? customNameEl.value.trim() : '';
    if ((!custSel || !custSel.value) && !customName) {
        showToast('Please select or enter a customer name', 'warning');
        return false;
    }
    if (!document.querySelector('#invProductItems .product-item')) {
        showToast('Add at least one product', 'warning');
        return false;
    }
    return true;
}

function buildInvoiceObject(commit) {
    const invNumInput = document.getElementById('invNumber') ? document.getElementById('invNumber').value : '';
    const invNumber = generateFinancialYearInvoiceNumber('invoice', invNumInput, commit);
    const custSel = document.getElementById('invCustomerName');
    const customNameEl = document.getElementById('invCustomClientName');
    const customName = customNameEl ? customNameEl.value.trim() : '';
    const custName = customName || (custSel && custSel.selectedIndex > 0 ? custSel.options[custSel.selectedIndex].textContent.trim() : '');
    const mobile = document.getElementById('invCustomClientMobile') ? document.getElementById('invCustomClientMobile').value : '';
    const gst = document.getElementById('invCustomClientGst') ? document.getElementById('invCustomClientGst').value : '';
    const address = document.getElementById('invCustomClientAddress') ? document.getElementById('invCustomClientAddress').value : '';
    const invDate = document.getElementById('invDate') ? document.getElementById('invDate').value : '';
    const notes = document.getElementById('invNotes') ? document.getElementById('invNotes').value : '';
    const received = parseFloat(document.getElementById('invReceivedAmount') ? document.getElementById('invReceivedAmount').value : 0) || 0;
    const items = [];
    document.querySelectorAll('#invProductItems .product-item').forEach(function(item) {
        const productSel = item.querySelector('.inv-product-select');
        const qty = parseFloat(item.querySelector('.inv-quantity-input') ? item.querySelector('.inv-quantity-input').value : 0) || 0;
        const price = parseFloat(item.querySelector('.inv-price-input') ? item.querySelector('.inv-price-input').value : 0) || 0;
        items.push({ product: productSel ? productSel.value : '', productName: productSel && productSel.selectedIndex > 0 ? productSel.options[productSel.selectedIndex].textContent : '', qty: qty, price: price, amount: qty * price });
    });
    const subtotal = items.reduce(function(s, i) { return s + i.amount; }, 0);
    const gstToggle = document.getElementById('invGstToggle');
    const gstRateEl = document.getElementById('invGstRate');
    const taxTypeEl = document.getElementById('invTaxType');
    const gstRate = (gstToggle && gstToggle.checked) ? (parseFloat(gstRateEl ? gstRateEl.value : 0) || 0) : 0;
    const gstAmount = (subtotal * gstRate) / 100;
    const total = subtotal + gstAmount;
    const balance = Math.max(0, total - received);
    const status = received >= total ? 'Paid' : (received > 0 ? 'Partial' : 'Unpaid');
    return { id: Date.now(), invNumber: invNumber, customerName: custName, mobile: mobile, gst: gst, address: address, date: invDate, items: items, subtotal: subtotal, gstRate: gstRate, gstAmount: gstAmount, total: total, receivedAmount: received, balance: balance, status: status, notes: notes, taxType: taxTypeEl ? taxTypeEl.value : 'intra', createdAt: new Date().toISOString() };
}

// ============================================================
// DEDICATED PAGE: Create Quote (admin-create-quote.html)
// ============================================================
function initializeCreateQuotePage() {
    const today = new Date();
    const quoteDate = document.getElementById('quoteDate');
    const validityDate = document.getElementById('validityDate');
    if (quoteDate) quoteDate.value = today.toISOString().split('T')[0];
    if (validityDate) {
        const v = new Date(today);
        v.setDate(v.getDate() + 14);
        validityDate.value = v.toISOString().split('T')[0];
    }
    const quoteNumEl = document.getElementById('quoteNumber');
    if (quoteNumEl) quoteNumEl.value = generateFinancialYearInvoiceNumber('quote');

    const customers = JSON.parse(localStorage.getItem('rmk_customers') || '[]');
    const custSel = document.getElementById('quoteCustomerName');
    if (custSel) {
        customers.forEach(function(c) {
            const opt = document.createElement('option');
            opt.value = c.id || c.company;
            opt.textContent = c.company || c.name;
            opt.dataset.state = c.state || '';
            custSel.appendChild(opt);
        });
        custSel.addEventListener('change', function () {
            const taxType = document.getElementById('taxType');
            if (taxType) taxType.value = (this.options[this.selectedIndex].dataset.state === 'Tamil Nadu') ? 'intra' : 'inter';
            if (typeof calculateTotals === 'function') calculateTotals();
        });
    }

    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) addProductBtn.addEventListener('click', addProductRow);
    if (typeof initializeFormCalculations === 'function') initializeFormCalculations();

    const form = document.getElementById('quoteForm');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (typeof handleQuoteSubmission === 'function') handleQuoteSubmission();
            setTimeout(function() { window.location.href = 'admin-billing.html'; }, 1500);
        });
    }
    const draftBtn = document.getElementById('saveQuoteDraftBtn');
    if (draftBtn) {
        draftBtn.addEventListener('click', function () {
            showToast('Quote saved as draft', 'info');
            setTimeout(function() { window.location.href = 'admin-billing.html'; }, 1200);
        });
    }
}

// ============================================================
// DEDICATED PAGE: Record Payment (admin-record-payment.html)
// ============================================================
function initializeRecordPaymentPage() {
    const invoices = JSON.parse(localStorage.getItem('rmk_invoices') || '[]');
    const customers = JSON.parse(localStorage.getItem('rmk_customers') || '[]');
    const custSel = document.getElementById('payCustomerSelect');
    const invoiceSel = document.getElementById('payInvoiceSelect');
    const invoiceSelectSection = document.getElementById('invoiceSelectSection');
    const invoiceInfoSection = document.getElementById('invoiceInfoSection');
    const noInvoicesMsg = document.getElementById('noInvoicesMsg');
    const savePayBtn = document.getElementById('savePaymentBtn');

    if (custSel) {
        const allCustNames = [];
        invoices.forEach(function(i) { if (i.customerName && allCustNames.indexOf(i.customerName) === -1) allCustNames.push(i.customerName); });

        customers.forEach(function(c) {
            const opt = document.createElement('option');
            opt.value = c.company || c.name;
            opt.textContent = c.company || c.name;
            custSel.appendChild(opt);
        });
        allCustNames.forEach(function(name) {
            if (!customers.some(function(c) { return (c.company || c.name) === name; })) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                custSel.appendChild(opt);
            }
        });

        custSel.addEventListener('change', function () {
            const custName = this.value;
            if (!custName) {
                if (invoiceSelectSection) invoiceSelectSection.style.display = 'none';
                if (invoiceInfoSection) invoiceInfoSection.style.display = 'none';
                return;
            }
            if (invoiceSelectSection) invoiceSelectSection.style.display = 'block';
            if (invoiceSel) invoiceSel.innerHTML = '<option value="">-- Choose Invoice --</option>';
            const pending = invoices.filter(function(inv) {
                return inv.customerName === custName && (parseFloat(inv.receivedAmount) || 0) < (parseFloat(inv.total) || 0);
            });
            if (pending.length === 0) {
                if (noInvoicesMsg) noInvoicesMsg.style.display = 'block';
                if (invoiceSel) invoiceSel.style.display = 'none';
                if (invoiceInfoSection) invoiceInfoSection.style.display = 'none';
            } else {
                if (noInvoicesMsg) noInvoicesMsg.style.display = 'none';
                if (invoiceSel) invoiceSel.style.display = 'block';
                pending.forEach(function(inv) {
                    const bal = (parseFloat(inv.total) || 0) - (parseFloat(inv.receivedAmount) || 0);
                    const opt = document.createElement('option');
                    opt.value = inv.id;
                    opt.textContent = inv.invNumber + ' — Bal: \u20B9' + bal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                    if (invoiceSel) invoiceSel.appendChild(opt);
                });
            }
        });
    }

    if (invoiceSel) {
        invoiceSel.addEventListener('change', function () {
            const invId = this.value;
            if (!invId) {
                if (invoiceInfoSection) invoiceInfoSection.style.display = 'none';
                if (savePayBtn) savePayBtn.disabled = true;
                return;
            }
            const inv = invoices.find(function(i) { return String(i.id) === String(invId); });
            if (inv) {
                const payInvoiceId = document.getElementById('payInvoiceId');
                if (payInvoiceId) payInvoiceId.value = inv.id;
                const fmt = function(v) { return '\u20B9' + (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); };
                const payInvNum = document.getElementById('payInvNumber');
                if (payInvNum) payInvNum.textContent = inv.invNumber || '-';
                const payTotal = document.getElementById('payTotalAmount');
                if (payTotal) payTotal.textContent = fmt(inv.total);
                const payReceived = document.getElementById('payAlreadyReceived');
                if (payReceived) payReceived.textContent = fmt(inv.receivedAmount || 0);
                const bal = (parseFloat(inv.total) || 0) - (parseFloat(inv.receivedAmount) || 0);
                const payBal = document.getElementById('payBalanceDue');
                if (payBal) payBal.textContent = fmt(bal);
                const amtInput = document.getElementById('payNewAmount');
                if (amtInput) amtInput.value = bal.toFixed(2);
                if (invoiceInfoSection) invoiceInfoSection.style.display = 'block';
                if (savePayBtn) savePayBtn.disabled = false;
            }
        });
    }

    const form = document.getElementById('paymentForm');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const payInvoiceIdEl = document.getElementById('payInvoiceId');
            const invId = payInvoiceIdEl ? payInvoiceIdEl.value : '';
            const payNewAmountEl = document.getElementById('payNewAmount');
            const newAmount = parseFloat(payNewAmountEl ? payNewAmountEl.value : 0) || 0;
            if (!invId) { showToast('Please select an invoice', 'warning'); return; }
            if (newAmount <= 0) { showToast('Enter a valid payment amount', 'warning'); return; }
            var storedInvoices = JSON.parse(localStorage.getItem('rmk_invoices') || '[]');
            const idx = storedInvoices.findIndex(function(i) { return String(i.id) === String(invId); });
            if (idx !== -1) {
                storedInvoices[idx].receivedAmount = (parseFloat(storedInvoices[idx].receivedAmount) || 0) + newAmount;
                storedInvoices[idx].status = storedInvoices[idx].receivedAmount >= parseFloat(storedInvoices[idx].total) ? 'Paid' : 'Partial';
                localStorage.setItem('rmk_invoices', JSON.stringify(storedInvoices));
                showToast('Payment recorded successfully!', 'success');
                setTimeout(function() { window.location.href = 'admin-billing.html'; }, 1300);
            }
        });
    }
}
