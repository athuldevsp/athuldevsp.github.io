/* ============================================================
   Interactive Animated Globe — D3-geo + Canvas
   Restructured for Country-Level detail on split layout.
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

    // Click tracking state
    let clickStart = { x: 0, y: 0 };
    let clickTime = 0;
    let selectedCountry = null;

    // --- Name Normalization ---
    function normalizeCountryName(country) {
        if (!country) return '';
        const c = country.toLowerCase();
        if (c.includes('india')) return 'India';
        if (c.includes('germany') || c.includes('deutschland')) return 'Germany';
        if (c.includes('switzerland') || c.includes('schweiz') || c.includes('suisse') || c.includes('svizzera')) return 'Switzerland';
        if (c.includes('iceland') || c.includes('ísland')) return 'Iceland';
        if (c.includes('france')) return 'France';
        if (c.includes('hungary') || c.includes('magyarország') || c.includes('magyarorszag')) return 'Hungary';
        if (c.includes('netherlands') || c.includes('nederland')) return 'Netherlands';
        if (c.includes('belgium') || c.includes('belgië') || c.includes('belgique') || c.includes('belgien')) return 'Belgium';
        if (c.includes('austria') || c.includes('österreich') || c.includes('osterreich')) return 'Austria';
        return country;
    }

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
            path = d3.geoPath(projection, ctx);
            console.log("Globe zoom factor adjusted:", zoomFactor);
        }
    }

    // --- Load World TopoJSON ---
    async function loadWorld() {
        try {
            const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
            if (!resp.ok) throw new Error("Failed to download world atlas data");
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
            const resp = await fetch('data/places.csv?v=' + Date.now());
            if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
            const text = await resp.text();
            const lines = text.trim().split('\n');

            // Quotes-aware CSV parsing helper
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
                { name: 'Reykjavík', lat: 64.1466, lng: -21.9426, country: 'Iceland', note: 'Trip to Iceland' }
            ];
        }
        calculateStats();
    }

    function calculateStats() {
        if (!places.length) return;

        const uniqueCountries = new Set(places.map(p => normalizeCountryName(p.country)));
        const countriesEl = document.getElementById('stats-countries');
        if (countriesEl) countriesEl.innerText = uniqueCountries.size;

        const citiesEl = document.getElementById('stats-cities');
        if (citiesEl) citiesEl.innerText = places.length;

        const northernmost = places.reduce((max, p) => p.lat > max.lat ? p : max, places[0]);
        const northEl = document.getElementById('stats-northmost');
        if (northEl) {
            northEl.innerHTML = `${northernmost.name} (${Math.round(northernmost.lat * 10) / 10}°N)`;
        }

        const southernmost = places.reduce((min, p) => p.lat < min.lat ? p : min, places[0]);
        const southEl = document.getElementById('stats-southmost');
        if (southEl) {
            southEl.innerHTML = `${southernmost.name} (${Math.round(southernmost.lat * 10) / 10}°N)`;
        }
    }

    // --- Drawing loop ---
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
        drawCountryLabels();

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
        if (!worldData) return;

        // Draw default land first
        ctx.beginPath();
        path(worldData.land);
        ctx.fillStyle = 'rgba(100, 255, 218, 0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.12)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Highlight visited countries
        for (const feature of worldData.countries.features) {
            const countryName = normalizeCountryName(feature.properties.name);
            const hasVisited = places.some(p => normalizeCountryName(p.country) === countryName);

            if (hasVisited) {
                ctx.beginPath();
                path(feature);

                // Highlight selected country differently
                if (selectedCountry && selectedCountry.id === feature.id) {
                    ctx.fillStyle = 'rgba(255, 169, 77, 0.25)';
                } else {
                    ctx.fillStyle = 'rgba(100, 255, 218, 0.18)';
                }
                ctx.fill();

                ctx.strokeStyle = 'rgba(100, 255, 218, 0.35)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }
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
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.03)';
        ctx.lineWidth = 0.4;
        ctx.stroke();
    }

    function drawCountryLabels() {
        // Only show country labels on the globe as you zoom in (zoomFactor >= 1.4)
        if (zoomFactor < 1.4 || !worldData) return;

        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.fillStyle = 'rgba(232, 234, 246, 0.75)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const feature of worldData.countries.features) {
            const countryName = normalizeCountryName(feature.properties.name);
            const hasVisited = places.some(p => normalizeCountryName(p.country) === countryName);

            if (hasVisited) {
                const centroid = d3.geoCentroid(feature);
                const coords = projection(centroid);

                if (coords) {
                    const d = d3.geoDistance(centroid, projection.invert([width / 2, height / 2]));
                    // Render label only if on the visible hemisphere
                    if (d < Math.PI / 2) {
                        const [px, py] = coords;
                        ctx.fillStyle = 'rgba(10, 14, 26, 0.5)';
                        const textW = ctx.measureText(feature.properties.name).width;
                        ctx.fillRect(px - textW/2 - 4, py - 6, textW + 8, 12);

                        ctx.fillStyle = 'rgba(232, 234, 246, 0.9)';
                        ctx.fillText(feature.properties.name, px, py);
                    }
                }
            }
        }
    }

    // --- Interactive Globe Clicks ---
    function handleGlobeClick(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const cx = width / 2;
        const cy = height / 2;
        const r = projection.scale();
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist > r) return; // Clicked outside globe sphere

        const coords = projection.invert([x, y]);
        if (!coords) return;

        // Check if clicked point is on visible hemisphere
        const d = d3.geoDistance(coords, projection.invert([width / 2, height / 2]));
        if (d > Math.PI / 2) return;

        if (worldData && worldData.countries) {
            const clickedFeature = worldData.countries.features.find(f => d3.geoContains(f, coords));
            if (clickedFeature) {
                const countryName = normalizeCountryName(clickedFeature.properties.name);
                const hasVisited = places.some(p => normalizeCountryName(p.country) === countryName);
                if (hasVisited) {
                    selectCountry(clickedFeature);
                }
            }
        }
    }

    // --- Selected Country Operations ---
    function selectCountry(countryFeature) {
        selectedCountry = countryFeature;
        const countryName = countryFeature.properties.name;
        const normName = normalizeCountryName(countryName);

        // Filter visited cities
        const countryPlaces = places.filter(p => normalizeCountryName(p.country) === normName);

        // Update UI Panel elements
        document.getElementById('selected-country-name').innerText = countryName;
        document.getElementById('selected-country-stats').innerText = `You have explored ${countryPlaces.length} cities/regions inside ${countryName}.`;

        document.getElementById('country-map-container').style.display = 'block';
        document.getElementById('places-list-header').style.display = 'block';

        // Render 2D Mercator projection country detail map
        renderCountryMap(countryFeature, countryPlaces);

        // Render places cards inside detail card
        renderCountryPlacesList(countryPlaces);
    }

    function renderCountryMap(countryFeature, countryPlaces) {
        const mapCanvas = document.getElementById('country-map-canvas');
        if (!mapCanvas) return;
        const mctx = mapCanvas.getContext('2d');
        const mrect = mapCanvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        mapCanvas.width = mrect.width * dpr;
        mapCanvas.height = mrect.height * dpr;
        mapCanvas.style.width = mrect.width + 'px';
        mapCanvas.style.height = mrect.height + 'px';
        mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        mctx.clearRect(0, 0, mrect.width, mrect.height);

        // Setup country fit Mercator projection
        const mProjection = d3.geoMercator()
            .fitSize([mrect.width - 40, mrect.height - 40], countryFeature)
            .translate([mrect.width / 2, mrect.height / 2]);
        const mPath = d3.geoPath(mProjection, mctx);

        // Draw country shape
        mctx.beginPath();
        mPath(countryFeature);
        mctx.fillStyle = 'rgba(100, 255, 218, 0.08)';
        mctx.fill();
        mctx.strokeStyle = 'rgba(100, 255, 218, 0.4)';
        mctx.lineWidth = 1.5;
        mctx.stroke();

        // Plot cities/markers
        for (const place of countryPlaces) {
            const coords = mProjection([place.lng, place.lat]);
            if (!coords) continue;
            const [px, py] = coords;

            // Outer glow halo
            mctx.beginPath();
            mctx.arc(px, py, 8, 0, Math.PI * 2);
            mctx.fillStyle = 'rgba(255, 169, 77, 0.25)';
            mctx.fill();

            // Core dot
            mctx.beginPath();
            mctx.arc(px, py, 3.5, 0, Math.PI * 2);
            mctx.fillStyle = 'rgba(255, 169, 77, 0.9)';
            mctx.fill();

            // Text label
            mctx.font = '10px "Space Grotesk", sans-serif';
            mctx.fillStyle = 'rgba(232, 234, 246, 0.85)';
            mctx.textAlign = 'center';
            mctx.textBaseline = 'top';

            // Check boundaries to avoid labels overlapping dots
            mctx.fillText(place.name, px, py + 6);
        }
    }

    function renderCountryPlacesList(countryPlaces) {
        const list = document.getElementById('places-list');
        if (!list) return;
        list.innerHTML = countryPlaces.map(p => `
            <div class="place-card">
                <h4>${p.name}</h4>
                ${p.note ? `<div class="place-note">${p.note}</div>` : ''}
            </div>
        `).join('');
    }

    // --- Drag & Zoom Mouse Event Bindings ---
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        clickStart = { x: e.clientX, y: e.clientY };
        clickTime = Date.now();
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

    window.addEventListener('mouseup', (e) => {
        isDragging = false;
        canvas.style.cursor = 'grab';

        // Perform click detection
        const dx = e.clientX - clickStart.x;
        const dy = e.clientY - clickStart.y;
        const dt = Date.now() - clickTime;
        if (Math.sqrt(dx * dx + dy * dy) < 5 && dt < 300) {
            handleGlobeClick(e);
        }
    });

    // Scroll Zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        adjustZoom(delta);
    }, { passive: false });

    // Touch and Pinch-to-Zoom
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
                path = d3.geoPath(projection, ctx);
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

    // --- Init ---
    async function init() {
        console.log("Initializing globe: sizing canvas...");
        resize();
        console.log("Loading world map and places CSV...");
        await Promise.all([loadWorld(), loadPlaces()]);
        console.log("Loaded " + places.length + " places. Starting draw loop...");
        
        // Select India by default if present
        if (worldData && worldData.countries) {
            const defaultCountry = worldData.countries.features.find(f => f.properties.name === "India");
            if (defaultCountry) {
                selectCountry(defaultCountry);
            }
        }
        
        draw(0);
    }

    window.addEventListener('resize', () => {
        cancelAnimationFrame(animFrame);
        resize();
        draw(0);
        if (selectedCountry) {
            const countryPlaces = places.filter(p => normalizeCountryName(p.country) === normalizeCountryName(selectedCountry.properties.name));
            renderCountryMap(selectedCountry, countryPlaces);
        }
    });

    init();
})();
