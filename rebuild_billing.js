const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'admin-billing.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the line with "Record Payment Modal" comment
let cutLine = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Record Payment Modal') && lines[i].includes('<!--')) {
        cutLine = i;
        break;
    }
}

if (cutLine === -1) {
    console.error('Could not find cut point!');
    process.exit(1);
}

console.log(`Cutting at line ${cutLine + 1}: ${lines[cutLine].trim()}`);

// Keep everything up to (but not including) the Record Payment Modal
const top = lines.slice(0, cutLine).join('\n');

const bottom = `    <!-- Record Payment Modal -->
    <div class="modal" id="paymentModal">
        <div class="modal-overlay"></div>
        <div class="modal-container" style="max-width: 400px;">
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
                            <label>New Received Amount (&#8377;) *</label>
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

    <!-- Success Toast -->
    <div class="toast" id="successToast">
        <i class="fas fa-check-circle"></i>
        <span>Action successful!</span>
    </div>

    <!-- Create Invoice Modal -->
    <div class="modal" id="invoiceModal">
        <div class="modal-overlay"></div>
        <div class="modal-container">
            <div class="modal-header">
                <h2 class="modal-title">
                    <i class="fas fa-file-invoice-dollar"></i>
                    Create New Invoice
                </h2>
                <button class="modal-close" id="closeInvoiceModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="invoiceForm">
                    <div class="form-section">
                        <h3 class="form-section-title">Customer Information</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Customer Name *</label>
                                <select id="invCustomerName" class="form-control" required>
                                    <option value="">Select Customer</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Invoice Date *</label>
                                <input type="date" id="invDate" class="form-control" required>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Due Date *</label>
                                <input type="date" id="invDueDate" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label>Invoice Number *</label>
                                <input type="text" id="invNumber" class="form-control" placeholder="Auto-generated" required>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3 class="form-section-title">Product Details</h3>
                        <div id="invProductItems"></div>
                        <button type="button" class="btn btn-outline" id="invAddProductBtn">
                            <i class="fas fa-plus"></i> Add Product
                        </button>
                    </div>

                    <div class="form-section">
                        <h3 class="form-section-title">Tax &amp; Total</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Apply GST</label>
                                <div class="toggle-switch">
                                    <input type="checkbox" id="invGstToggle" class="toggle-input">
                                    <label for="invGstToggle" class="toggle-label"></label>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="invGstRate">GST Rate (%)</label>
                                <select id="invGstRate" class="form-control" disabled>
                                    <option value="0">0%</option>
                                    <option value="5">5%</option>
                                    <option value="12">12%</option>
                                    <option value="18" selected>18%</option>
                                    <option value="28">28%</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="invTaxType">Tax Type</label>
                                <select id="invTaxType" class="form-control">
                                    <option value="intra">Intrastate (CGST + SGST)</option>
                                    <option value="inter">Interstate (IGST)</option>
                                </select>
                            </div>
                        </div>
                        <div class="calculation-summary">
                            <div class="calc-row">
                                <span>Subtotal:</span>
                                <strong id="invSubtotalAmount">&#8377;0.00</strong>
                            </div>
                            <div id="invTaxSplitRows">
                                <div class="calc-row inv-intra-only">
                                    <span>CGST (<span class="inv-half-gst">0</span>%):</span>
                                    <strong class="inv-cgst-amount">&#8377;0.00</strong>
                                </div>
                                <div class="calc-row inv-intra-only">
                                    <span>SGST (<span class="inv-half-gst">0</span>%):</span>
                                    <strong class="inv-sgst-amount">&#8377;0.00</strong>
                                </div>
                                <div class="calc-row inv-inter-only" style="display:none">
                                    <span>IGST (<span id="invGstPercentage">0</span>%):</span>
                                    <strong id="invGstAmount">&#8377;0.00</strong>
                                </div>
                            </div>
                            <div class="calc-row total">
                                <span>Grand Total:</span>
                                <strong id="invTotalAmount">&#8377;0.00</strong>
                            </div>
                            <div class="calc-row" style="margin-top:10px; align-items:center;">
                                <span>Amount Received (&#8377;):</span>
                                <input type="number" id="invReceivedAmount" class="form-control" style="width:120px; text-align:right; margin:0;" placeholder="0.00" value="0">
                            </div>
                            <div class="calc-row total" style="color:#e74c3c;">
                                <span>Balance Due:</span>
                                <strong id="invBalanceAmount">&#8377;0.00</strong>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3 class="form-section-title">Payment Terms</h3>
                        <div class="form-group">
                            <textarea id="invNotes" class="form-control" rows="3">Payment due within 15 days. Interest @18% pa will be charged on delayed payments.</textarea>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="cancelInvoiceBtn">Cancel</button>
                        <button type="button" class="btn btn-primary" id="shareInvoiceWhatsappBtn" style="background:#25D366; color:white;">
                            <i class="fab fa-whatsapp"></i> Share
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-print"></i> Create &amp; Print Invoice
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Printable Invoice Template (Hidden until printed) -->
    <div id="printTemplate" class="print-only">
        <div class="new-print-layout">
            <div class="n-header-wrap">
                <div class="n-header-left">
                    <img src="logo.png" id="printLogo" class="n-logo" alt="Logo">
                    <div class="n-brand-text">Most Trusted Brand</div>
                </div>
                <div class="n-header-center">
                    <h2 class="n-company-name">RMK Fly Ash Bricks &amp; Paver Blocks</h2>
                    <p id="pCompanyAddress">Tamil Nadu, India<br>91-99520 68848 | rmkgroups1987@gmail.com</p>
                    <p id="pCompanyGstContainer" style="display:none; margin-top:2px;"><strong>GSTIN: </strong><span id="pCompanyGst"></span></p>
                </div>
            </div>

            <div class="n-divider-line"></div>

            <div class="n-meta-row">
                <div class="n-meta-box">
                    <div class="n-meta-item"><span>#:</span> <strong id="pInvNumber"></strong></div>
                    <div class="n-meta-item"><span>Date:</span> <strong id="pInvDate"></strong></div>
                </div>
                <div class="n-doc-subtitle">
                    <h1 id="pDocTitle">QUOTE</h1>
                </div>
            </div>

            <div class="n-bill-to-row">
                <div class="n-bill-to-title">Bill To</div>
                <div class="n-bill-to-name" id="pCustomerName" style="font-weight:800; font-size:11px;"></div>
                <div id="pCustomerAddress" style="font-size:9px; margin-top:2px;"></div>
                <div id="pCustomerGstContainer" style="display:none; font-size:8px; margin-top:2px;">
                    <strong>GSTIN: </strong><span id="pCustomerGst"></span>
                </div>
            </div>

            <table class="n-print-table">
                <thead>
                    <tr>
                        <th style="width:5%">#</th>
                        <th style="text-align:left; width:55%">Item &amp; Description</th>
                        <th style="text-align:right; width:10%">Qty</th>
                        <th style="text-align:right; width:10%">Rate</th>
                        <th style="text-align:right; width:20%">Amount</th>
                    </tr>
                </thead>
                <tbody id="pProductRows"></tbody>
            </table>

            <div class="n-bottom-split">
                <div class="n-bottom-left">
                    <div class="n-total-words">
                        <div>Total In Words</div>
                        <strong id="pTotalWords"></strong>
                    </div>
                    <div class="n-notes-section">
                        <div class="n-notes-title">Notes</div>
                        <div class="n-notes-content">
                            Thanking You,<br>
                            RMK Fly Ash Bricks &amp; Paver Blocks,<br>
                            Karthick (MD) Phone no: 9942068848<br>
                            Customer Care: 8248838593
                        </div>
                    </div>
                    <div class="n-terms-section">
                        <div class="n-terms-title">Terms &amp; Conditions</div>
                        <div class="n-terms-content" id="pTerms"></div>
                    </div>
                </div>
                <div class="n-bottom-right">
                    <table class="n-totals-table">
                        <tr><td class="n-tot-label">Sub Total</td><td class="n-tot-val" id="pSubtotal"></td></tr>
                        <tr id="rowCgst" style="display:none;"><td class="n-tot-label">CGST <span id="pCgstLabel"></span></td><td class="n-tot-val" id="pCgst"></td></tr>
                        <tr id="rowSgst" style="display:none;"><td class="n-tot-label">SGST <span id="pSgstLabel"></span></td><td class="n-tot-val" id="pSgst"></td></tr>
                        <tr id="rowIgst" style="display:none;"><td class="n-tot-label">IGST <span id="pIgstLabel"></span></td><td class="n-tot-val" id="pIgst"></td></tr>
                        <tr id="pRowReceived" style="display:none;"><td class="n-tot-label">Received</td><td class="n-tot-val" id="pReceived"></td></tr>
                        <tr id="pRowBalance" style="display:none;"><td class="n-tot-label">Balance Due</td><td class="n-tot-val" id="pBalance" style="color:#c0392b;"></td></tr>
                        <tr class="n-grandtotal-row"><td class="n-tot-label">Total</td><td class="n-tot-val" id="pTotal"></td></tr>
                    </table>
                    <div class="n-signature-box">
                        <img id="printSignature" src="" alt="" style="max-height:40px; display:none; margin:0 auto; padding-bottom:5px;">
                        <div class="n-sig-line">Authorized Signature</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="admin.js"></script>
</body>
</html>`;

const final = top + '\n' + bottom;
fs.writeFileSync(filePath, final);
console.log(`Done. File written. Total lines: ${final.split('\n').length}`);
