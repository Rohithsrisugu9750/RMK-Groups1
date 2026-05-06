/**
 * RMK GROUPS - Corporate UI Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    // --- CLOUD BOOT SYNCHRONIZER ---
    try {
        const _res = await fetch('/api/data');
        if(_res.ok) {
            const _cloudData = await _res.json();
            window._isCloudSyncing = true;
            for(let key in _cloudData) {
                localStorage.setItem(key, _cloudData[key]);
            }
            window._isCloudSyncing = false;
        }
    } catch(e) {}
    // -------------------------------
    const preloader = document.querySelector('.preloader');
    const header = document.querySelector('header');
    const heroBg = document.querySelector('.hero-bg');
    const revealElements = document.querySelectorAll('.reveal');

    // 0. Preloader Logic
    if (preloader) {
        window.addEventListener('load', () => {
            preloader.classList.add('fade-out');
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 600);
        });
    }

    // Fallback if load event takes too long
    setTimeout(() => {
        if (preloader && !preloader.classList.contains('fade-out')) {
            preloader.classList.add('fade-out');
        }
    }, 3000);

    // 1. Header Scrolled State
    const handleScroll = () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // 2. Subtle Parallax for Hero Background
        if (heroBg) {
            heroBg.style.transform = `translateY(${currentScroll * 0.15}px)`;
        }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    // 3. Intersection Observer for Reveal Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // stop observing once revealed for performance
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(el => revealObserver.observe(el));

    // 4. Mobile Menu Toggle Logic
    const mobileToggle = document.getElementById('mobile-toggle');
    const navMobile = document.getElementById('nav-mobile');
    const mobileBlur = document.getElementById('mobile-blur');

    if (mobileToggle && navMobile && mobileBlur) {
        const toggleMenu = () => {
            navMobile.classList.toggle('active');
            mobileBlur.classList.toggle('active');
            document.body.style.overflow = navMobile.classList.contains('active') ? 'hidden' : '';
        };

        mobileToggle.addEventListener('click', toggleMenu);
        mobileBlur.addEventListener('click', toggleMenu);

        // Close menu when clicking on a link
        navMobile.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', toggleMenu);
        });
    }

    // 5. Smooth Scroll for Navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            e.preventDefault();
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // 5. Add staggered animation to child elements for "reveal-group"
    // (Optional feature if we add specific group classes later)

    // 6. Scroll To Top Logic
    const scrollTopBtn = document.createElement('div');
    scrollTopBtn.className = 'scroll-top';
    scrollTopBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    document.body.appendChild(scrollTopBtn);

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollTopBtn.classList.add('active');
        } else {
            scrollTopBtn.classList.remove('active');
        }
    });

    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // 7. Dynamic Data for Clients Page
    const clientGrid = document.querySelector('.client-grid');
    const marqueeTrack = document.querySelector('.marquee-track');
    if (clientGrid || marqueeTrack) {
        const savedCustomers = JSON.parse(localStorage.getItem('rmk_customers') || '[]');
        if (savedCustomers.length > 0) {
            savedCustomers.forEach(customer => {
                // Add to Marquee
                if (marqueeTrack) {
                    const mItem = document.createElement('div');
                    mItem.className = 'marquee-item';
                    mItem.style.filter = 'none';
                    mItem.style.opacity = '1';
                    mItem.innerHTML = `<div style="font-weight:900; font-size:1.8rem; color:var(--primary); text-transform:uppercase; text-align:center;">${customer.company}</div>`;
                    marqueeTrack.appendChild(mItem);
                }

                // Add to Grid
                if (clientGrid) {
                    const card = document.createElement('div');
                    card.className = 'client-card reveal';
                    const initial = customer.company.substring(0, 2).toUpperCase();
                    card.innerHTML = `
                        <div class="client-logo-wrapper" style="font-size:3.5rem; font-weight:900; color:var(--primary); text-transform:uppercase;">
                            ${initial}
                        </div>
                        <span class="client-tag">${customer.state || 'Valued Client'}</span>
                        <h3>${customer.company}</h3>
                        <p>${customer.city && customer.city.toLowerCase() !== 'n/a' ? `Partnering from ${customer.city}. ` : ''}A proud partner of RMK Groups for industrial and construction excellence.</p>
                    `;
                    clientGrid.appendChild(card);
                    if (typeof revealObserver !== 'undefined' && revealObserver.observe) {
                        revealObserver.observe(card);
                    }
                }
            });
        }
    }
});
