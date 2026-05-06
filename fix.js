const fs = require('fs');

const filename = 'admin-billing.html';
const text = fs.readFileSync(filename, 'utf8');

const startMarker = '    <!-- Create Invoice Modal -->';
const endMarker = '    <!-- Record Payment Modal -->';

if (text.includes(startMarker) && text.includes(endMarker)) {
    const startIdx = text.indexOf(startMarker);
    const endIdx = text.indexOf(endMarker);
    
    // We want to replace the whole string from startMarker to endMarker.
    
    const newModal = `    <!-- Create Invoice Modal -->
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
                                <label>Customer Name</label>
                                <select id="invCustomerName" class="form-control">
                                    <option value="">-- Select saved customer --</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Or Custom Client Name *</label>
                                <input type="text" id="invCustomClientName" class="form-control" placeholder="Type client name directly..." autocomplete="off">
                                <small style="color:var(--text-light); font-size:0.78rem; margin-top:3px; display:block;">Leave blank to use selected customer above.</small>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Invoice Date *</label>
                                <input type="date" id="invDate" class="form-control" required>
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
                                <span>Subtotal (Taxable Value):</span>
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
                        <button type="button" class="btn btn-primary" id="shareInvoiceWhatsappBtn" style="background:#25D366; color:white; border-color: #25D366;">
                            <i class="fab fa-whatsapp"></i> Share
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-print"></i> Create &amp; Print Invoice
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>\n\n`;
    
    const newText = text.substring(0, startIdx) + newModal + text.substring(endIdx);
    fs.writeFileSync(filename, newText, 'utf8');
    console.log('Successfully replaced invoiceModal!');
} else {
    console.log('Failed to find markers');
}
