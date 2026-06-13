document.addEventListener('DOMContentLoaded', () => {
    /* ==========================================================================
       1. HTML5 Canvas: ATLAS Detector Collision Particle Simulator
       ========================================================================== */
    const canvas = document.getElementById('collision-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        
        let particles = [];
        
        // Handle screen resizing
        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });
        
        class Particle {
            constructor(x, y, angle, speed, charge, color) {
                this.x = x;
                this.y = y;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.charge = charge; // -1 (bend left), 0 (straight), 1 (bend right)
                this.color = color;
                this.alpha = 1.0;
                this.decay = 0.006 + Math.random() * 0.008;
                this.history = [];
                this.maxHistory = 15 + Math.floor(Math.random() * 15);
            }
            
            update() {
                this.history.push({ x: this.x, y: this.y });
                if (this.history.length > this.maxHistory) {
                    this.history.shift();
                }
                
                // Bend in magnetic field (Lorentz Force simulation)
                if (this.charge !== 0) {
                    const bendAngle = 0.035 * this.charge;
                    const cos = Math.cos(bendAngle);
                    const sin = Math.sin(bendAngle);
                    const newVx = this.vx * cos - this.vy * sin;
                    const newVy = this.vx * sin + this.vy * cos;
                    this.vx = newVx;
                    this.vy = newVy;
                }
                
                this.x += this.vx;
                this.y += this.vy;
                this.alpha -= this.decay;
            }
            
            draw() {
                if (this.history.length < 2) return;
                
                ctx.beginPath();
                ctx.moveTo(this.history[0].x, this.history[0].y);
                for (let i = 1; i < this.history.length; i++) {
                    ctx.lineTo(this.history[i].x, this.history[i].y);
                }
                ctx.strokeStyle = this.color.replace('ALPHA', this.alpha.toFixed(2));
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 8;
                ctx.shadowColor = this.color.replace('ALPHA', '0.5');
                ctx.stroke();
                ctx.shadowBlur = 0; // Reset shadow
            }
        }
        
        // Spawn collision event at coordinates (x, y)
        function spawnCollision(x, y) {
            const count = 8 + Math.floor(Math.random() * 8);
            const colors = [
                'rgba(34, 211, 238, ALPHA)',  // Cyan
                'rgba(168, 85, 247, ALPHA)', // Violet
                'rgba(255, 42, 95, ALPHA)'    // Coral
            ];
            
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1.5 + Math.random() * 3.5;
                const charge = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
                const color = colors[Math.floor(Math.random() * colors.length)];
                particles.push(new Particle(x, y, angle, speed, charge, color));
            }
        }
        
        // Loop physics & drawing
        function animate() {
            ctx.clearRect(0, 0, width, height);
            
            particles.forEach((p, idx) => {
                p.update();
                p.draw();
                if (p.alpha <= 0) {
                    particles.splice(idx, 1);
                }
            });
            
            requestAnimationFrame(animate);
        }
        
        animate();
        
        // Spawn collision on window click
        window.addEventListener('click', (e) => {
            spawnCollision(e.clientX, e.clientY);
        });
        
        // Spawn auto collisions on interval near center
        setInterval(() => {
            if (particles.length < 40) {
                const cx = width / 2 + (Math.random() - 0.5) * 200;
                const cy = height / 2 + (Math.random() - 0.5) * 200;
                spawnCollision(cx, cy);
            }
        }, 3000);
        
        // Spawn collisions when hovering on glass boxes
        document.querySelectorAll('.glass-box, .profile-card, .timeline-card').forEach(box => {
            box.addEventListener('mouseenter', (e) => {
                const rect = box.getBoundingClientRect();
                spawnCollision(rect.left + rect.width / 2, rect.top + rect.height / 2);
            });
        });
    }

    /* ==========================================================================
       2. Lucide Icons Setup
       ========================================================================== */
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    /* ==========================================================================
       3. Responsive Mobile Drawer Menu Toggle
       ========================================================================== */
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const navLinksContainer = document.querySelector('.nav-links');
    
    if (menuToggleBtn && navLinksContainer) {
        menuToggleBtn.addEventListener('click', () => {
            navLinksContainer.classList.toggle('active');
            const icon = menuToggleBtn.querySelector('i');
            if (icon) {
                if (navLinksContainer.classList.contains('active')) {
                    icon.setAttribute('data-lucide', 'x');
                } else {
                    icon.setAttribute('data-lucide', 'menu');
                }
                lucide.createIcons();
            }
        });
        
        // Close menu when clicking nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navLinksContainer.classList.remove('active');
                const icon = menuToggleBtn.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-lucide', 'menu');
                    lucide.createIcons();
                }
            });
        });
    }

    /* ==========================================================================
       4. Navigation, Scroll Reveal, and Scroll Spy
       ========================================================================== */
    const navItems = document.querySelectorAll('.nav-links .nav-link');
    const sections = document.querySelectorAll('.page-section');
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    // Smooth scrolling navigation handler
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerOffset = 80;
                const elementPosition = targetSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    // Intersection Observer for scroll animations
    const revealObserverOptions = {
        root: null,
        rootMargin: '-5% 0px -15% 0px',
        threshold: 0.08
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

    // Scroll Spy: Highlight active nav item
    window.addEventListener('scroll', () => {
        let currentSection = '';
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        const offsetAdjustment = 150;

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
       5. Mouse-Tracking Radial Spotlights
       ========================================================================== */
    const interactiveBoxes = document.querySelectorAll('.glass-box, .profile-card, .timeline-card');
    
    interactiveBoxes.forEach(box => {
        box.addEventListener('mousemove', (e) => {
            const rect = box.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            box.style.setProperty('--mouse-x', `${x}px`);
            box.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    /* ==========================================================================
       6. Tactical HUD Map & Animated Laser Beams Setup
       ========================================================================== */
    const mapContainer = document.getElementById('travel-map');
    let map;
    let tileLayer;
    let markersLayer = L.layerGroup();
    let pathsLayer = L.layerGroup();
    
    // Visited locations from CV
    const travelDestinations = {
        H1: { name: "Göttingen, Germany", coords: [51.5413, 9.9079], desc: "<strong>Göttingen, Germany</strong><br>PhD Studies & MSc at Göttingen University" },
        H2: { name: "Geneva, Switzerland (CERN)", coords: [46.2330, 6.0556], desc: "<strong>Geneva, Switzerland</strong><br>CERN / ATLAS Collaboration detector analysis & trigger work" },
        H3: { name: "Delhi, India", coords: [28.6139, 77.2090], desc: "<strong>Delhi, India</strong><br>IUAC Intern - electron solid interactions simulated via MC-XRAY" },
        H4: { name: "Coimbatore, India", coords: [11.0168, 76.9558], desc: "<strong>Coimbatore, India</strong><br>Amrita University - Bachelors in Physics, cosmology thesis" },
        H5: { name: "Chennai, India", coords: [13.0827, 80.2707], desc: "<strong>Chennai, India</strong><br>Swamy's School - High school, athletics, & 4-year robotics" },
        H6: { name: "Bangalore, India", coords: [12.9716, 77.5946], desc: "<strong>Bangalore, India</strong><br>SSERD Intern - exoplanet stability simulations" }
    };

    if (mapContainer) {
        // Initialize tactical Leaflet map
        map = L.map('travel-map', {
            center: [25, 45], // Centered between Europe and Asia
            zoom: 2.5,
            minZoom: 1.5,
            maxZoom: 10,
            zoomControl: false,
            scrollWheelZoom: false
        });

        L.control.zoom({ position: 'topright' }).addTo(map);

        // Load CartoDB Positron maps (will be filtered in CSS to look like glowing vector grids)
        tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        markersLayer.addTo(map);
        pathsLayer.addTo(map);

        const customIcon = L.divIcon({
            className: 'custom-pin-marker',
            html: '<div class="pin-marker-glow"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            popupAnchor: [0, -8]
        });

        // Function to draw coordinates and connecting trajectories
        function plotTravelNetwork() {
            markersLayer.clearLayers();
            pathsLayer.clearLayers();
            
            const origin = travelDestinations.H1; // Göttingen is the research hub
            
            // Add Göttingen Hub
            const originMarker = L.marker(origin.coords, { icon: customIcon })
                .bindPopup(origin.desc)
                .addTo(markersLayer);
                
            // Plot other hubs and connect with animated laser beams
            Object.keys(travelDestinations).forEach(key => {
                if (key === 'H1') return; // Skip origin since it's already plotted
                
                const target = travelDestinations[key];
                
                // Add marker
                L.marker(target.coords, { icon: customIcon })
                    .bindPopup(target.desc)
                    .addTo(markersLayer);
                
                // Add animated laser polyline connecting them
                L.polyline([origin.coords, target.coords], {
                    color: '#22d3ee', // Cyan beam
                    weight: 1.5,
                    opacity: 0.8,
                    className: 'animated-beam'
                }).addTo(pathsLayer);
            });
        }

        // Plot initial network
        plotTravelNetwork();

        // Pan map when clicking hub cards
        document.querySelectorAll('.hub-card').forEach(card => {
            card.addEventListener('click', () => {
                const lat = parseFloat(card.getAttribute('data-lat'));
                const lng = parseFloat(card.getAttribute('data-lng'));
                
                map.setView([lat, lng], 5, {
                    animate: true,
                    duration: 1.2
                });
            });
        });

        // Invalidate map size on section entrance
        const travelSection = document.getElementById('travel');
        const travelObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        map.invalidateSize();
                    }, 400);
                }
            });
        }, { threshold: 0.05 });
        travelObserver.observe(travelSection);
    }

    /* ==========================================================================
       7. Google Sign-In & Location History Sync Simulation
       ========================================================================== */
    const googleBtn = document.getElementById('custom-google-signin-btn');
    const termBody = document.getElementById('terminal-body');

    function appendTerminalLog(text, type = 'info', delay = 0) {
        return new Promise(resolve => {
            setTimeout(() => {
                const line = document.createElement('span');
                line.className = `term-line ${type}`;
                
                if (type === 'prompt') {
                    line.textContent = `guest@cern.ch:~$ ${text}`;
                } else if (type === 'success') {
                    line.textContent = `[+] SUCCESS: ${text}`;
                } else if (type === 'loading') {
                    line.textContent = `[*] SYNCING: ${text}`;
                } else {
                    line.textContent = `[i] LOG: ${text}`;
                }
                
                termBody.appendChild(line);
                termBody.scrollTop = termBody.scrollHeight;
                resolve();
            }, delay);
        });
    }

    if (googleBtn && termBody) {
        googleBtn.addEventListener('click', async () => {
            // Disable button during synchronization process
            googleBtn.disabled = true;
            googleBtn.style.opacity = 0.5;

            // Clear prompt
            termBody.innerHTML = '';
            
            await appendTerminalLog("./sync_locations.sh", "prompt", 200);
            await appendTerminalLog("Connecting to Google Accounts Auth (OAuth 2.0)...", "info", 600);
            await appendTerminalLog("Opening Google Sign-In secure popup window...", "info", 500);
            
            // Simulating real Google OAuth login delay
            setTimeout(async () => {
                await appendTerminalLog("User Authenticated successfully (email: athul.dev.sudhakar.ponnu@cern.ch).", "success", 200);
                await appendTerminalLog("Requesting Google Maps timeline archive database...", "info", 400);
                await appendTerminalLog("Querying historical location telemetry logs...", "loading", 500);
                
                setTimeout(async () => {
                    await appendTerminalLog("Successfully parsed location telemetry checkpoints.", "success", 300);
                    await appendTerminalLog("Discovered travel coordinates around Götitngen, Geneva, Delhi, Coimbatore, Chennai, and Bangalore.", "info", 400);
                    await appendTerminalLog("Exporting coordinates to map markers Layer...", "loading", 600);
                    
                    // Trigger map update animations
                    if (map) {
                        map.setView([25, 45], 2.5, { animate: true, duration: 1.5 });
                        plotTravelNetwork();
                        
                        // Add glowing success pulse to map container
                        mapContainer.parentElement.style.boxShadow = "0 0 25px rgba(16, 185, 129, 0.3)";
                        setTimeout(() => {
                            mapContainer.parentElement.style.boxShadow = "";
                        }, 2000);
                    }
                    
                    await appendTerminalLog("Map updated! 6 tracking coordinates synced. Trajectory beams running.", "success", 400);
                    await appendTerminalLog("Sync task finished. Connection closed.", "info", 300);
                    
                    // Reset button style
                    googleBtn.style.opacity = 1;
                    googleBtn.disabled = false;
                    googleBtn.innerHTML = '<i data-lucide="check"></i><span>Synced With Google</span>';
                    lucide.createIcons();
                }, 2000);
            }, 1500);
        });
    }
});
