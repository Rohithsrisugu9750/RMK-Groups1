// Intercept LocalStorage to push to Cloud Backend
if (!window._cloudOverride) {
    window._cloudOverride = true;
    const origSetItem = localStorage.setItem;
    
    // Automatically replicate local storage onto Cloud Storage endpoint
    localStorage.setItem = function(key, value) {
        origSetItem.call(localStorage, key, value);
        
        // Skip syncing during initial boot download or session-only variables
        if(window._isCloudSyncing || key === 'rmk_session') return;
        
        // Background sync to server
        fetch('/api/sync', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ key, value })
        }).catch(e => console.warn("Cloud Ping Warning: Currently Offline"));
    };
}
