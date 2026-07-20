/* ============================================================
   Navigation & Shared UI Logic
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    /* --- Mobile Nav Toggle --- */
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');
    if (toggle && links) {
        const closeMenu = () => {
            toggle.classList.remove('active');
            links.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        };

        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            links.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(links.classList.contains('open')));
        });
        links.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && links.classList.contains('open')) {
                closeMenu();
                toggle.focus();
            }
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

    /* --- Work, education, and research switchers --- */
    document.querySelectorAll('[data-profile-switcher]').forEach(profileSwitcher => {
        const tabs = Array.from(profileSwitcher.querySelectorAll('.experience-tab'));
        const panels = Array.from(profileSwitcher.querySelectorAll('[data-experience-panel]'));
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const setExperience = (selectedTab, shouldOpen, moveFocus = false, scrollTab = true) => {
            tabs.forEach(tab => {
                const isSelected = shouldOpen && tab === selectedTab;
                tab.classList.toggle('is-active', isSelected);
                tab.setAttribute('aria-expanded', String(isSelected));
            });

            panels.forEach(panel => {
                const isSelected = shouldOpen && panel.id === selectedTab.getAttribute('aria-controls');
                if (window.gsap) window.gsap.killTweensOf(panel);
                panel.classList.toggle('is-active', isSelected);

                if (isSelected) {
                    panel.hidden = false;
                    if (!prefersReducedMotion && window.gsap) {
                        window.gsap.fromTo(panel, { autoAlpha: 0, y: 12 }, {
                            autoAlpha: 1,
                            y: 0,
                            duration: 0.28,
                            ease: 'power2.out',
                            clearProps: 'transform,opacity,visibility'
                        });
                    }
                } else if (!panel.hidden && !prefersReducedMotion && window.gsap) {
                    window.gsap.to(panel, {
                        autoAlpha: 0,
                        y: -5,
                        duration: 0.16,
                        ease: 'power1.in',
                        onComplete: () => {
                            if (!panel.classList.contains('is-active')) panel.hidden = true;
                            window.gsap.set(panel, { clearProps: 'transform,opacity,visibility' });
                        }
                    });
                } else {
                    panel.hidden = true;
                }
            });

            if (scrollTab && shouldOpen) {
                selectedTab.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
            }
            if (moveFocus) selectedTab.focus();
        };

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                const shouldOpen = tab.getAttribute('aria-expanded') !== 'true';
                setExperience(tab, shouldOpen);
            });
            tab.addEventListener('keydown', event => {
                let nextIndex;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                if (nextIndex === undefined) return;
                event.preventDefault();
                setExperience(tabs[nextIndex], true, true);
            });
        });

        profileSwitcher.classList.add('experience-tabs-ready');
        setExperience(tabs.find(tab => tab.getAttribute('aria-expanded') === 'true') || tabs[0], true, false, false);
    });
});
