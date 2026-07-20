/* ============================================================
   Navigation & Shared UI Logic
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    /* --- Mobile Nav Toggle --- */
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');
    if (toggle && links) {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            links.classList.toggle('open');
        });
        links.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                toggle.classList.remove('active');
                links.classList.remove('open');
            });
        });
    }

    /* --- Scroll: Nav background --- */
    const nav = document.getElementById('main-nav');
    if (nav) {
        const onScroll = () => {
            nav.classList.toggle('scrolled', window.scrollY > 60);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* --- Scroll Reveal --- */
    const revealEls = document.querySelectorAll('.reveal-up');
    if (revealEls.length) {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion || !('IntersectionObserver' in window)) {
            revealEls.forEach(el => el.classList.add('revealed'));
        } else {
            let remaining = revealEls.length;
            const fallbackTimeout = window.setTimeout(() => {
                revealEls.forEach(el => el.classList.add('revealed'));
            }, 2000);

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                    remaining -= 1;
                    if (remaining === 0) window.clearTimeout(fallbackTimeout);
                });
            }, { threshold: 0.14, rootMargin: '0px 0px -24px 0px' });

            revealEls.forEach(el => observer.observe(el));
        }
    }

    /* --- Active nav link highlight --- */
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
        const href = a.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            a.classList.add('active');
        } else {
            a.classList.remove('active');
        }
    });
});
