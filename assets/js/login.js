document.addEventListener('DOMContentLoaded', async () => {
    // --- CLOUD BOOT SYNCHRONIZER (IMPROVED) ---
    async function performLoginSync() {
        try {
            // Try endpoints in sequence
            let res = await fetch('/rmk-cloud-sync').catch(() => null);
            
            if (!res || !res.ok) {
                res = await fetch('/sync.php').catch(() => null);
            }

            if (!res || !res.ok) {
                res = await fetch('sync.php').catch(() => null);
            }

            if (!res || !res.ok) {
                res = await fetch('https://rmkgroups.in/sync.php').catch(() => null);
            }

            if(res && res.ok) {
                const data = await res.json();
                window._isCloudSyncing = true;
                for(let key in data) {
                    if (key !== 'rmk_session') localStorage.setItem(key, data[key]);
                }
                window._isCloudSyncing = false;
                console.log("Login Sync Successful");
            } else {
                throw new Error("All endpoints failed or returned non-ok status");
            }
        } catch(e) { console.warn("Login Sync Failed (Offline Mode)", e); }
    }
    performLoginSync();
    // -------------------------------
    const loginForm = document.getElementById('loginForm');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const usernameInput = document.getElementById('username');
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');

    // 1. Password Visibility Toggle
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        // Toggle icon
        const icon = togglePasswordBtn.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });

    // 2. Form Submission
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        // Reset state
        errorContainer.style.display = 'none';
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span>Checking...</span><i class="fas fa-spinner fa-spin"></i>';

        // Login Logic - Checking dynamic users from localStorage
        setTimeout(() => {
            let userRole = null;
            let displayName = '';

            // Get users from localStorage
            let users = JSON.parse(localStorage.getItem('rmk_users') || '[]');

            // Hardcoded fallbacks if no users exist yet or for standard usage
            const fallbacks = [
                { userId: 'admin', password: 'admin123', role: 'Admin', name: 'Main Admin' },
                { userId: 'staff', password: 'staff123', role: 'Staff', name: 'Staff User' },
                { userId: 'admin@rmkgroups.in', password: 'admin123', role: 'Admin', name: 'Main Admin' }
            ];

            // Find matching user
            const dynamicUser = users.find(u => u.userId === username && u.password === password);
            const fallbackUser = fallbacks.find(u => u.userId === username && u.password === password);

            const user = dynamicUser || fallbackUser;

            if (user) {
                userRole = user.role;
                displayName = user.name || user.userId;
            }

            if (userRole) {
                // Success - Save session info
                const sessionData = {
                    username: username,
                    name: displayName,
                    role: userRole,
                    loginTime: new Date().toISOString()
                };
                localStorage.setItem('rmk_session', JSON.stringify(sessionData));

                // Redirect to dashboard
                window.location.href = 'admin-billing.html';
            } else {
                // Failure
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right"></i>';

                errorContainer.style.display = 'flex';
                errorMessage.textContent = 'Invalid username or password. Please try again.';

                // Add shake effect to card
                const card = document.querySelector('.login-card');
                card.style.animation = 'shake 0.4s ease-in-out';
                setTimeout(() => card.style.animation = '', 400);
            }
        }, 800);
    });

    // Handle Forgot Password click
    document.getElementById('forgotPassword').addEventListener('click', (e) => {
        e.preventDefault();
        alert('Please contact the IT administrator to reset your password.');
    });
});

// Add shake animation CSS dynamically
const style = document.createElement('style');
style.textContent = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    50% { transform: translateX(8px); }
    75% { transform: translateX(-8px); }
}`;
document.head.appendChild(style);
