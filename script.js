document.addEventListener('DOMContentLoaded', () => {
    /* ==========================================================================
       1. Lucide Icons Setup
       ========================================================================== */
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    /* ==========================================================================
       2. Theme Management (Light / Dark)
       ========================================================================== */
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const htmlElement = document.documentElement;
    
    // Check local storage or system preferences
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const currentTheme = savedTheme || systemTheme;
    
    // Apply current theme
    htmlElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);

    // Click listener to toggle theme
    themeToggleBtn.addEventListener('click', () => {
        const nowTheme = htmlElement.getAttribute('data-theme');
        const newTheme = nowTheme === 'dark' ? 'light' : 'dark';
        
        htmlElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update Leaflet map tiles
        const isDark = newTheme === 'dark';
        updateMapTiles(isDark);
    });

    /* ==========================================================================
       3. Interactive Travel Map (Leaflet)
       ========================================================================== */
    const mapContainer = document.getElementById('travel-map');
    let map;
    let tileLayer;
    const markers = {};
    
    const locations = [
        {
            name: "San Francisco, USA",
            coords: [37.7749, -122.4194],
            desc: "<div class='map-popup'><strong>San Francisco, USA</strong><br>Google DeepMind Intern & NeurIPS Attendee</div>"
        },
        {
            name: "Zurich, Switzerland",
            coords: [47.3769, 8.5417],
            desc: "<div class='map-popup'><strong>Zurich, Switzerland</strong><br>Master's studies at ETH Zurich, hiking in the Alps</div>"
        },
        {
            name: "Mumbai, India",
            coords: [19.0760, 72.8777],
            desc: "<div class='map-popup'><strong>Mumbai, India</strong><br>IIT Bombay CSE B.Tech. studies</div>"
        },
        {
            name: "Tokyo, Japan",
            coords: [35.6762, 139.6503],
            desc: "<div class='map-popup'><strong>Tokyo, Japan</strong><br>Visiting and exploring local culture</div>"
        }
    ];

    function updateMapTiles(isDark) {
        if (!map) return;
        if (tileLayer) {
            map.removeLayer(tileLayer);
        }
        
        const tileUrl = isDark 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            
        tileLayer = L.tileLayer(tileUrl, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);
    }

    if (mapContainer) {
        // Initialize Map
        map = L.map('travel-map', {
            center: [25, 10], // Centered representation
            zoom: 2,
            minZoom: 1.5,
            maxZoom: 12,
            zoomControl: false,
            scrollWheelZoom: false
        });

        // Add Zoom Control at custom position
        L.control.zoom({ position: 'topright' }).addTo(map);

        // Load correct tile set based on initial theme
        const isThemeDark = htmlElement.getAttribute('data-theme') === 'dark';
        updateMapTiles(isThemeDark);

        // Custom DivIcon for glowing pulses on pins
        const customIcon = L.divIcon({
            className: 'custom-pin-marker',
            html: '<div class="pin-marker-glow"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });

        // Add markers
        locations.forEach(loc => {
            const marker = L.marker(loc.coords, { icon: customIcon })
                .bindPopup(loc.desc)
                .addTo(map);
            markers[loc.name] = marker;
        });

        // Pan map on gallery item click
        const galleryItems = document.querySelectorAll('.gallery-item');
        galleryItems.forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.getAttribute('data-lat'));
                const lng = parseFloat(item.getAttribute('data-lng'));
                const name = item.querySelector('h4').textContent;
                
                map.setView([lat, lng], 5, {
                    animate: true,
                    duration: 1.5
                });
                
                setTimeout(() => {
                    if (markers[name]) {
                        markers[name].openPopup();
                    }
                }, 1200);
            });
        });
        
        // Recalculate map size when section reveals to prevent gray load gaps
        const travelSection = document.getElementById('travel');
        const travelObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        map.invalidateSize();
                    }, 400);
                }
            });
        }, { threshold: 0.1 });
        travelObserver.observe(travelSection);
    }

    /* ==========================================================================
       4. Navigation, Scroll Reveal, and Scroll Spy
       ========================================================================== */
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    const sections = document.querySelectorAll('.content-section');
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    // Smooth scrolling navigation handler
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                // Determine layout scroll offset
                const headerOffset = window.innerWidth <= 768 ? 200 : 50;
                const elementPosition = targetSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                // Set immediate active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    // Intersection Observer for scroll animations
    const revealObserverOptions = {
        root: null,
        rootMargin: '-5% 0px -15% 0px',
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('section-visible');
                
                // If it's a timeline card, enable badge glow
                if (entry.target.classList.contains('timeline-item')) {
                    entry.target.classList.add('active-timeline');
                }
            }
        });
    }, revealObserverOptions);

    sections.forEach(sec => revealObserver.observe(sec));
    timelineItems.forEach(item => revealObserver.observe(item));

    // Scroll Spy: Highlight nav item matching viewport location
    window.addEventListener('scroll', () => {
        let currentSection = '';
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        const offsetAdjustment = window.innerWidth <= 768 ? 250 : 150;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (scrollPosition >= sectionTop - offsetAdjustment) {
                currentSection = section.getAttribute('id');
            }
        });

        if (currentSection) {
            navItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('href') === `#${currentSection}`) {
                    item.classList.add('active');
                }
            });
        }
    });

    /* ==========================================================================
       5. Mouse-Tracking Radial Card Glow Effect
       ========================================================================== */
    const glassCards = document.querySelectorAll('.glass-card, .about-card');
    
    glassCards.forEach(card => {
        // Create mouse glow overlay dynamic stylesheet variables
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    /* ==========================================================================
       6. Publications Filter System
       ========================================================================== */
    const filterBtns = document.querySelectorAll('.filter-btn');
    const pubItems = document.querySelectorAll('.pub-item');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active tag class
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filterValue = btn.getAttribute('data-filter');

            pubItems.forEach(item => {
                const category = item.getAttribute('data-category');
                
                if (filterValue === 'all' || category === filterValue) {
                    item.style.display = 'flex';
                    // Re-trigger scroll observer to ensure filter displays are shown correctly
                    revealObserver.observe(item);
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    /* ==========================================================================
       7. BibTeX Accordion Code Blocks
       ========================================================================== */
    const bibtexBtns = document.querySelectorAll('.bibtex-trigger');

    bibtexBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const pubDetailContainer = btn.closest('.pub-details');
            const codeBlock = pubDetailContainer.querySelector('.bibtex-code');
            
            const isOpen = codeBlock.classList.contains('open');
            
            // Toggle element class
            codeBlock.classList.toggle('open');

            // Update button icons & text context
            if (!isOpen) {
                btn.innerHTML = '<i data-lucide="chevron-up"></i> Hide BibTeX';
            } else {
                btn.innerHTML = '<i data-lucide="quote"></i> BibTeX';
            }
            
            // Re-render icons since HTML content changes
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });
    });
});
