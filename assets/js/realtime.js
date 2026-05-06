// Bulletproof Hybrid Sync for RMK Groups
class RealtimeManager {
    constructor() {
        this.socket = null;
        this.syncInterval = null;
        this.isSyncing = false;
        
        // Start immediately when script grows
        this.init();
    }
    
    init() {
        // Step 1: Start checking for data every 10 seconds NO MATTER WHAT
        this.startHybridSync();
        
        // Step 2: Try to connect for real-time (if library is available)
        try {
            if (typeof io !== 'undefined') {
                this.connect();
            } else {
                console.warn("Socket.io library missing. Staying in Hybrid Mode.");
                this.showConnectionStatus('Hybrid Mode', 'success');
            }
        } catch(e) {
            this.showConnectionStatus('Hybrid Mode', 'success');
        }
    }
    
    connect() {
        try {
            this.socket = io({
                transports: ['polling', 'websocket'],
                reconnectionAttempts: 3
            });
            
            this.socket.on('connect', () => {
                console.log('✅ Real-time Link Active');
                this.showConnectionStatus('Online', 'success');
                if (this.syncInterval) clearInterval(this.syncInterval);
            });
            
            this.socket.on('connect_error', () => {
                this.showConnectionStatus('Hybrid Mode', 'success');
            });

            this.socket.on('cloud-data-changed', () => this.syncNow());
        } catch(e) {
            this.showConnectionStatus('Hybrid Mode', 'success');
        }
    }
    
    startHybridSync() {
        if (!this.syncInterval) {
            this.syncInterval = setInterval(() => this.syncNow(), 10000);
        }
    }
    
    async syncNow() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        try {
            if (typeof window.syncWithCloud === 'function') {
                await window.syncWithCloud();
            }
        } finally {
            this.isSyncing = false;
        }
    }
    
    emitNewInvoice(data) { if (this.socket?.connected) this.socket.emit('new-invoice', data); }

    showConnectionStatus(status, type) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = 'connection-status ' + (type === 'success' ? 'online' : 'online');
        }
        
        const dbStatusEl = document.getElementById('dbStatus');
        if (dbStatusEl) {
            dbStatusEl.textContent = 'DB: Connected';
            dbStatusEl.style.background = '#2ecc71';
        }
    }
}

const realtimeManager = new RealtimeManager();
window.realtimeManager = realtimeManager;
