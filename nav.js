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
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach(el => observer.observe(el));
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
