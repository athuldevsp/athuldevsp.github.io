/* ============================================================
   Interactive Animated Globe — D3-geo + Canvas
   Uses proper orthographic projection with Natural Earth 110m
   topojson world map data for accurate country rendering.
   Places are loaded from data/places.csv.
   ============================================================ */

(function () {
    const canvas = document.getElementById('globe-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // --- State ---
    let width, height;
    let projection, path;
    let worldData = null;
    let places = [];
    let autoRotate = true;
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let rotationStart = [0, 0];
    let currentRotation = [0, -20, 0]; // [lambda, phi, gamma]
    let velocity = 0.2; // degrees per frame for auto-rotate
    let animFrame;
    let lastTime = 0;
    let zoomFactor = 1.0;
    let baseRadius = 0;
    let initialTouchDistance = null;
    let initialZoomFactor = 1.0;

    // --- Sizing ---
    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        width = rect.width;
        height = rect.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        baseRadius = Math.min(width, height) * 0.42;
        projection = d3.geoOrthographic()
            .translate([width / 2, height / 2])
            .scale(baseRadius * zoomFactor)
            .rotate(currentRotation)
            .clipAngle(90);

        path = d3.geoPath(projection, ctx);
    }

    function adjustZoom(delta) {
        zoomFactor = Math.max(0.4, Math.min(6.0, zoomFactor + delta));
        if (projection) {
            projection.scale(baseRadius * zoomFactor);
        }
    }

    // --- Load World TopoJSON ---
    async function loadWorld() {
        try {
            const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
            const topo = await resp.json();
            worldData = {
                land: topojson.feature(topo, topo.objects.land),
                countries: topojson.feature(topo, topo.objects.countries),
                borders: topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b)
            };
        } catch (err) {
            console.error('Failed to load world data:', err);
        }
    }

    // --- Load Places from CSV ---
    async function loadPlaces() {
        try {
            // Fetch with cache-buster to prevent stale responses
            const resp = await fetch('data/places.csv?v=' + Date.now());
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            const text = await resp.text();
            const lines = text.trim().split('\n');

            // Simple parser that respects quotes
            const parseCSVLine = (line) => {
                let cols = [];
                let insideQuote = false;
                let entry = '';
                for (let i = 0; i < line.length; i++) {
                    let char = line[i];
                    if (char === '"') {
                        insideQuote = !insideQuote;
                    } else if (char === ',' && !insideQuote) {
                        cols.push(entry.trim());
                        entry = '';
                    } else {
                        entry += char;
                    }
                }
                cols.push(entry.trim());
                return cols.map(s => s.replace(/^"|"$/g, '').trim());
            };

            // Skip header
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = parseCSVLine(line);
                if (cols.length >= 3) {
                    const lat = parseFloat(cols[1]);
                    const lng = parseFloat(cols[2]);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        places.push({
                            name: cols[0],
                            lat, lng,
                            country: cols[3] || '',
                            note: cols[4] || ''
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load places CSV:', err);
            // Fallback defaults
            places = [
                { name: 'Göttingen', lat: 51.5339, lng: 9.9356, country: 'Germany', note: 'PhD & Masters' },
                { name: 'Geneva (CERN)', lat: 46.2044, lng: 6.1432, country: 'Switzerland', note: 'ATLAS Experiment' },
                { name: 'Chennai', lat: 13.0827, lng: 80.2707, country: 'India', note: 'Hometown' },
            ];
        }
        renderPlacesList();
    }

    // --- Drawing ---
    function draw(time) {
        ctx.clearRect(0, 0, width, height);

        // Auto-rotation
        if (autoRotate && !isDragging) {
            const dt = time - lastTime;
            currentRotation[0] += velocity * (dt / 16);
            projection.rotate(currentRotation);
        }
        lastTime = time;

        drawGlobe();
        if (worldData) {
            drawLand();
            drawBorders();
        }
        drawGraticule();
        drawArcs();
        drawPlaceMarkers(time);

        animFrame = requestAnimationFrame(draw);
    }

    function drawGlobe() {
        const cx = width / 2;
        const cy = height / 2;
        const r = projection.scale();

        // Outer glow
        const glow = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.4);
        glow.addColorStop(0, 'rgba(100, 255, 218, 0.04)');
        glow.addColorStop(0.6, 'rgba(100, 255, 218, 0.01)');
        glow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Globe sphere
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8, 12, 28, 0.6)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function drawLand() {
        ctx.beginPath();
        path(worldData.land);
        ctx.fillStyle = 'rgba(100, 255, 218, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.18)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
    }

    function drawBorders() {
        ctx.beginPath();
        path(worldData.borders);
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.08)';
        ctx.lineWidth = 0.3;
        ctx.stroke();
    }

    function drawGraticule() {
        const graticule = d3.geoGraticule().step([20, 20])();
        ctx.beginPath();
        path(graticule);
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.04)';
        ctx.lineWidth = 0.4;
        ctx.stroke();
    }

    function drawArcs() {
        if (places.length < 2) return;

        ctx.strokeStyle = 'rgba(255, 169, 77, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);

        for (let i = 0; i < places.length - 1; i++) {
            const a = places[i];
            const b = places[i + 1];
            const line = {
                type: 'LineString',
                coordinates: [[a.lng, a.lat], [b.lng, b.lat]]
            };
            ctx.beginPath();
            path(line);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    function drawPlaceMarkers(time) {
        for (const place of places) {
            const coords = projection([place.lng, place.lat]);
            if (!coords) continue;

            // Check if point is on the visible hemisphere
            const d = d3.geoDistance(
                [place.lng, place.lat],
                projection.invert([width / 2, height / 2])
            );
            if (d > Math.PI / 2) continue;

            const [px, py] = coords;
            const pulse = Math.sin(time / 500 + place.lat * 0.1) * 0.35 + 0.65;

            // Glow halo
            const grad = ctx.createRadialGradient(px, py, 0, px, py, 16);
            grad.addColorStop(0, `rgba(255, 169, 77, ${0.5 * pulse})`);
            grad.addColorStop(0.4, `rgba(255, 107, 107, ${0.15 * pulse})`);
            grad.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(px, py, 16, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Core dot
            const dotR = 3.5 * pulse + 1.5;
            ctx.beginPath();
            ctx.arc(px, py, dotR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 169, 77, 0.95)`;
            ctx.fill();

            // White center
            ctx.beginPath();
            ctx.arc(px, py, dotR * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fill();

            // Label
            ctx.font = '12px "Space Grotesk", sans-serif';
            ctx.fillStyle = 'rgba(232, 234, 246, 0.85)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            // Background for label
            const textW = ctx.measureText(place.name).width;
            ctx.fillStyle = 'rgba(10, 14, 26, 0.6)';
            ctx.fillRect(px + dotR + 6, py - 8, textW + 8, 16);

            ctx.fillStyle = 'rgba(232, 234, 246, 0.9)';
            ctx.fillText(place.name, px + dotR + 10, py);
        }
    }

    // --- Drag & Zoom Interaction ---
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        rotationStart = [...currentRotation];
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const sensitivity = 0.4;
        currentRotation[0] = rotationStart[0] + dx * sensitivity;
        currentRotation[1] = Math.max(-60, Math.min(60, rotationStart[1] - dy * sensitivity));
        projection.rotate(currentRotation);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });

    // Scroll Zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        adjustZoom(delta);
    }, { passive: false });

    // Touch and Pinch-to-Zoom Helper
    function getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            isDragging = false;
            initialTouchDistance = getTouchDistance(e.touches);
            initialZoomFactor = zoomFactor;
        } else {
            isDragging = true;
            const t = e.touches[0];
            dragStart = { x: t.clientX, y: t.clientY };
            rotationStart = [...currentRotation];
        }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialTouchDistance !== null) {
            const currentDist = getTouchDistance(e.touches);
            const ratio = currentDist / initialTouchDistance;
            zoomFactor = Math.max(0.4, Math.min(6.0, initialZoomFactor * ratio));
            if (projection) {
                projection.scale(baseRadius * zoomFactor);
            }
        } else if (isDragging && e.touches.length === 1) {
            const t = e.touches[0];
            const dx = t.clientX - dragStart.x;
            const dy = t.clientY - dragStart.y;
            currentRotation[0] = rotationStart[0] + dx * 0.4;
            currentRotation[1] = Math.max(-60, Math.min(60, rotationStart[1] - dy * 0.4));
            projection.rotate(currentRotation);
        }
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialTouchDistance = null;
        }
        if (e.touches.length === 0) {
            isDragging = false;
        }
    });

    canvas.style.cursor = 'grab';

    // --- Controls ---
    document.querySelectorAll('.globe-controls button').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'rotate' || action === 'drag') {
                document.querySelectorAll('.globe-controls button').forEach(b => {
                    if (b.dataset.action === 'rotate' || b.dataset.action === 'drag') {
                        b.classList.remove('active');
                    }
                });
                btn.classList.add('active');
                autoRotate = action === 'rotate';
            } else if (action === 'zoom-in') {
                adjustZoom(0.3);
            } else if (action === 'zoom-out') {
                adjustZoom(-0.3);
            }
        });
    });

    // --- Render place cards ---
    function renderPlacesList() {
        const list = document.getElementById('places-list');
        if (!list) return;
        list.innerHTML = places.map(p => `
            <div class="place-card">
                <h4>${p.name}</h4>
                ${p.country ? `<div class="place-country">${p.country}</div>` : ''}
                ${p.note ? `<div class="place-note">${p.note}</div>` : ''}
            </div>
        `).join('');
    }

    // --- Init ---
    async function init() {
        resize();
        await Promise.all([loadWorld(), loadPlaces()]);
        draw(0);
    }

    window.addEventListener('resize', () => {
        cancelAnimationFrame(animFrame);
        resize();
        draw(0);
    });

    init();
})();
