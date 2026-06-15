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
    let detailedWorldData = null; // Cache for high-resolution country borders (50m dataset)
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

    // Hover & Click tracking state
    let clickStart = { x: 0, y: 0 };
    let clickTime = 0;
    let selectedCountry = null;
    let hoveredCountry = null;
    let isMouseOverGlobe = false;
    let borderOpacity = 0.04; // Smooth transition state for borders

    // Country Detail Map Zoom State
    let countryZoomTransform = d3.zoomIdentity;
    let countryZoom = null;
    let countryVideos = {}; // country key -> { label, url }

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

    let indiaSOI = null;

    async function loadIndiaSOI() {
        try {
            const resp = await fetch('data/india-soi.geojson?v=' + Date.now());
            if (resp.ok) {
                const geojson = await resp.json();
                if (geojson && geojson.features && geojson.features.length > 0) {
                    indiaSOI = geojson.features[0];
                }
            }
        } catch (err) {
            console.error('Failed to load official India boundaries:', err);
        }
    }

    // --- Load Country Videos CSV ---
    async function loadCountryVideos() {
        try {
            const resp = await fetch('data/country_videos.csv?v=' + Date.now());
            if (!resp.ok) return;
            const text = await resp.text();
            const lines = text.trim().split('\n');
            // Header: country,label,video_url
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length < 1) continue;
                const country = cols[0].trim();
                const label   = cols[1] ? cols[1].trim() : country;
                // URL may contain commas (e.g. query params) — rejoin remaining cols
                const url = cols.slice(2).join(',').trim();
                if (country) countryVideos[country.toLowerCase()] = { label, url };
            }
        } catch (err) {
            console.error('Failed to load country videos CSV:', err);
        }
    }

    // --- Classify URL type ---
    function classifyUrl(rawUrl) {
        if (!rawUrl || !rawUrl.trim()) return 'none';
        const u = rawUrl.trim();
        if (u.includes('photos.google.com') || u.includes('photos.app.goo.gl')) return 'gphoto';
        if (u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed|youtube-nocookie\.com\/embed)/)) return 'youtube';
        if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return 'direct';
        return 'iframe'; // generic iframe fallback (Vimeo etc.)
    }

    // --- Render Country Video Pane ---
    function renderCountryVideo(normName, countryDisplayName) {
        const pane   = document.getElementById('country-video-pane');
        const area   = document.getElementById('video-embed-area');
        const noLink = document.getElementById('video-no-link');
        const title  = document.getElementById('video-pane-title');
        if (!pane || !area) return;

        const key    = normName.toLowerCase();
        const entry  = countryVideos[key];
        const rawUrl = entry ? entry.url : '';
        const label  = (entry && entry.label) ? entry.label : countryDisplayName;

        if (title) title.textContent = label;
        pane.style.display = 'block';
        area.innerHTML = '';

        const type = classifyUrl(rawUrl);
        const u    = rawUrl ? rawUrl.trim() : '';

        if (type === 'none') {
            if (noLink) noLink.style.display = 'flex';
            return;
        }
        if (noLink) noLink.style.display = 'none';

        // --- Google Photos: blocks iframe embedding (X-Frame-Options: DENY / 403) ---
        // Show a styled clickable card that opens in a new tab instead.
        if (type === 'gphoto') {
            area.innerHTML = `
                <a href="${u}" target="_blank" rel="noopener" class="video-external-card">
                    <div class="video-external-icon">
                        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                            <circle cx="12" cy="12" r="10"/>
                            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
                        </svg>
                    </div>
                    <div class="video-external-info">
                        <div class="video-external-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px"><path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"/></svg>
                            Google Photos
                        </div>
                        <div class="video-external-label">${label}</div>
                        <div class="video-external-hint">Click to watch in Google Photos &nbsp;↗</div>
                    </div>
                </a>`;
            return;
        }

        // --- YouTube: embed via privacy-enhanced nocookie domain ---
        if (type === 'youtube') {
            const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
            const embedUrl = ytMatch
                ? `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytMatch[1]}&controls=1`
                : (u.includes('autoplay') ? u : u + (u.includes('?') ? '&' : '?') + 'autoplay=1&mute=1');
            const frame = document.createElement('iframe');
            frame.src = embedUrl;
            frame.className = 'country-video-frame';
            frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
            frame.allowFullscreen = true;
            frame.setAttribute('loading', 'lazy');
            area.appendChild(frame);
            return;
        }

        // --- Direct video file (.mp4 / .webm / .ogg) ---
        if (type === 'direct') {
            const vid = document.createElement('video');
            vid.src = u;
            vid.autoplay = true;
            vid.muted = true;
            vid.loop = true;
            vid.controls = true;
            vid.playsInline = true;
            vid.className = 'country-video-player';
            area.appendChild(vid);
            vid.play().catch(() => {});
            return;
        }

        // --- Generic iframe fallback (Vimeo, etc.) ---
        const frame = document.createElement('iframe');
        frame.src = u;
        frame.className = 'country-video-frame';
        frame.allow = 'autoplay; fullscreen; encrypted-media';
        frame.allowFullscreen = true;
        area.appendChild(frame);
    }

    // --- Load World TopoJSON ---
    async function loadWorld() {
        try {
            // Load official India boundaries first
            await loadIndiaSOI();

            const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
            if (!resp.ok) throw new Error("Failed to download world atlas data");
            const topo = await resp.json();
            worldData = {
                land: topojson.feature(topo, topo.objects.land),
                countries: topojson.feature(topo, topo.objects.countries),
                borders: topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b)
            };

            // Inject official India geometry if loaded successfully
            if (indiaSOI && worldData.countries && worldData.countries.features) {
                const indiaFeature = worldData.countries.features.find(f => normalizeCountryName(f.properties.name) === 'India');
                if (indiaFeature) {
                    indiaFeature.geometry = indiaSOI.geometry;
                    console.log("Successfully replaced India's borders on the globe with the official Survey of India boundaries!");
                }
            }
            window.worldDataTest = worldData;
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
                        const note = cols[4] || '';
                        // Extract record count from note, e.g. "Visited during timeline history (123 records)"
                        const countMatch = note.match(/(\d+)\s+record/);
                        const records = countMatch ? parseInt(countMatch[1], 10) : 1;
                        places.push({
                            name: cols[0],
                            lat, lng,
                            country: cols[3] || '',
                            note,
                            records
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

            // Mask out other countries' borders/lands inside India's official boundaries
            if (indiaSOI) {
                // Erase borders under India
                ctx.beginPath();
                path(indiaSOI);
                ctx.fillStyle = 'rgba(8, 12, 28, 1.0)'; // globe background color
                ctx.fill();

                // Restore default land color on top of erased area
                ctx.fillStyle = 'rgba(100, 255, 218, 0.03)';
                ctx.fill();
            }

            drawVisitedCountries();
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
        ctx.fillStyle = 'rgba(100, 255, 218, 0.03)';
        ctx.fill();
    }

    function drawVisitedCountries() {
        if (!worldData) return;

        // Highlight visited countries
        for (const feature of worldData.countries.features) {
            const countryName = normalizeCountryName(feature.properties.name);
            const hasVisited = places.some(p => normalizeCountryName(p.country) === countryName);

            if (hasVisited) {
                ctx.beginPath();
                path(feature);

                // Highlight selected and hovered states differently
                if (selectedCountry && selectedCountry.id === feature.id) {
                    ctx.fillStyle = 'rgba(255, 169, 77, 0.3)'; // Selected country (warm orange)
                } else if (hoveredCountry && hoveredCountry.id === feature.id) {
                    ctx.fillStyle = 'rgba(100, 255, 218, 0.25)'; // Hovered country (glowing green)
                } else {
                    ctx.fillStyle = 'rgba(100, 255, 218, 0.12)'; // Default visited country (soft green)
                }
                ctx.fill();

                // Glow outline on hover / selection
                if (hoveredCountry && hoveredCountry.id === feature.id) {
                    ctx.strokeStyle = 'rgba(100, 255, 218, 0.8)';
                    ctx.lineWidth = 1.2;
                } else if (selectedCountry && selectedCountry.id === feature.id) {
                    ctx.strokeStyle = 'rgba(255, 169, 77, 0.8)';
                    ctx.lineWidth = 1.0;
                } else {
                    ctx.strokeStyle = 'rgba(100, 255, 218, 0.25)';
                    ctx.lineWidth = 0.6;
                }
                ctx.stroke();
            }
        }
    }

    function drawBorders() {
        // Smoothly fade borders in and out based on hover state
        const targetOpacity = isMouseOverGlobe ? 0.35 : 0.04;
        borderOpacity += (targetOpacity - borderOpacity) * 0.15;

        ctx.beginPath();
        path(worldData.borders);
        ctx.strokeStyle = `rgba(100, 255, 218, ${borderOpacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    function drawGraticule() {
        const graticule = d3.geoGraticule().step([20, 20])();
        ctx.beginPath();
        path(graticule);
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.02)';
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
                } else {
                    deselectCountry();
                }
            } else {
                deselectCountry();
            }
        }
    }

    // --- Selected Country Operations ---
    async function selectCountry(countryFeature) {
        selectedCountry = countryFeature;
        const countryName = countryFeature.properties.name;
        const normName = normalizeCountryName(countryName);

        // Filter visited cities
        const countryPlaces = places.filter(p => normalizeCountryName(p.country) === normName);

        // Update UI Panel elements
        document.getElementById('selected-country-name').innerText = countryName;
        document.getElementById('selected-country-stats').innerText = `${countryPlaces.length} ${countryPlaces.length === 1 ? 'location' : 'locations'} visited in ${countryName}.`;

        document.getElementById('country-map-container').style.display = 'block';

        // Reset D3 zoom state to identity before rendering the new country
        const mapCanvas = document.getElementById('country-map-canvas');
        if (mapCanvas && countryZoom) {
            d3.select(mapCanvas).call(countryZoom.transform, d3.zoomIdentity);
        }

        // Show detail column and adjust layout
        const layout = document.querySelector('.travel-layout');
        if (layout) {
            layout.classList.add('has-selection');
        }

        // Load high-resolution boundaries for the detail map
        let renderFeature = countryFeature;
        if (normName === 'India') {
            try {
                const resp = await fetch('data/india-soi-fine.geojson?v=' + Date.now());
                if (resp.ok) {
                    const fineGeojson = await resp.json();
                    if (fineGeojson && fineGeojson.features && fineGeojson.features.length > 0) {
                        renderFeature = {
                            ...countryFeature,
                            geometry: fineGeojson.features[0].geometry
                        };
                        selectedCountry = renderFeature; // Update state so zooms use high-res
                    }
                }
            } catch (err) {
                console.error("Failed to load fine-resolution India boundaries:", err);
            }
        } else {
            try {
                if (!detailedWorldData) {
                    const resp = await fetch('data/countries-50m.json?v=' + Date.now());
                    if (resp.ok) {
                        const topo = await resp.json();
                        detailedWorldData = topojson.feature(topo, topo.objects.countries);
                    }
                }
                if (detailedWorldData) {
                    const fineFeature = detailedWorldData.features.find(f => normalizeCountryName(f.properties.name) === normName);
                    if (fineFeature) {
                        renderFeature = {
                            ...countryFeature,
                            geometry: fineFeature.geometry
                        };
                        selectedCountry = renderFeature; // Update state so zooms use high-res
                    }
                }
            } catch (err) {
                console.error("Failed to load high-resolution country boundaries:", err);
            }
        }

        // Show video pane for this country
        renderCountryVideo(normName, countryName);

        // Delay slightly to let the CSS display block apply and compute layout width
        setTimeout(() => {
            resize();
            renderCountryMap(renderFeature, countryPlaces);
        }, 100);
    }
    window.selectCountryTest = selectCountry;

    function deselectCountry() {
        selectedCountry = null;
        const layout = document.querySelector('.travel-layout');
        if (layout) layout.classList.remove('has-selection');
        // Hide video pane and stop playback
        const pane = document.getElementById('country-video-pane');
        if (pane) {
            pane.style.display = 'none';
            const area = document.getElementById('video-embed-area');
            if (area) area.innerHTML = ''; // stops video playback
        }
        setTimeout(() => resize(), 100);
    }

    function renderCountryMap(countryFeature, countryPlaces) {
        const mapCanvas = document.getElementById('country-map-canvas');
        if (!mapCanvas) return;
        const mctx = mapCanvas.getContext('2d');
        const mrect = mapCanvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Ensure map dimensions are never zero or negative to prevent D3 projection crash
        const mapWidth = Math.max(100, mrect.width || mapCanvas.parentElement.clientWidth || 300);
        const mapHeight = Math.max(100, mrect.height || mapCanvas.parentElement.clientHeight || 250);
        
        mapCanvas.width = mapWidth * dpr;
        mapCanvas.height = mapHeight * dpr;
        mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        mctx.clearRect(0, 0, mapWidth, mapHeight);

        // Setup country fit Mercator projection
        const mProjection = d3.geoMercator()
            .fitSize([mapWidth - 40, mapHeight - 40], countryFeature);
        const mPath = d3.geoPath(mProjection, mctx);

        // Draw country shape (zoomed context)
        mctx.save();
        mctx.translate(countryZoomTransform.x, countryZoomTransform.y);
        mctx.scale(countryZoomTransform.k, countryZoomTransform.k);
        
        mctx.beginPath();
        mPath(countryFeature);
        mctx.fillStyle = 'rgba(100, 255, 218, 0.08)';
        mctx.fill();
        mctx.strokeStyle = 'rgba(100, 255, 218, 0.4)';
        mctx.lineWidth = 1.5 / countryZoomTransform.k;
        mctx.stroke();
        
        mctx.restore();

        if (!countryPlaces.length) return;

        // --- Heatmap: scale glow by log of record count ---
        const maxRecords = Math.max(...countryPlaces.map(p => p.records || 1));
        const logMax = Math.log1p(maxRecords);

        // Sort by records ascending so high-weight places render on top
        const sorted = [...countryPlaces].sort((a, b) => (a.records || 1) - (b.records || 1));

        // Pass 1 — heatmap glow blobs using 'lighter' blend so dense clusters
        // accumulate intensity naturally without needing huge radii
        mctx.globalCompositeOperation = 'lighter';

        for (const place of sorted) {
            const coords = mProjection([place.lng, place.lat]);
            if (!coords) continue;
            const [x, y] = coords;
            const px = x * countryZoomTransform.k + countryZoomTransform.x;
            const py = y * countryZoomTransform.k + countryZoomTransform.y;
            if (px < -80 || px > mapWidth + 80 || py < -80 || py > mapHeight + 80) continue;

            const records = place.records || 1;
            const t = Math.log1p(records) / logMax; // 0..1 on log scale

            // Tight radius: 8px (cold) → 28px (hot), zoom-scaled
            const baseGlow = 8 + t * 20;
            const glowRadius = baseGlow * Math.max(1, countryZoomTransform.k);

            // Colour: teal → amber → coral-red
            const r = Math.round(80  + t * 175);   // 80  → 255
            const g = Math.round(220 - t * 151);   // 220 → 69
            const b = Math.round(200 - t * 200);   // 200 → 0

            // Sharp centre, fast falloff — alpha intentionally low so 'lighter'
            // accumulation does the heavy lifting in dense areas
            const peakA = (0.06 + t * 0.18).toFixed(3);
            const midA  = (0.02 + t * 0.06).toFixed(3);

            const grad = mctx.createRadialGradient(px, py, 0, px, py, glowRadius);
            grad.addColorStop(0,    `rgba(${r}, ${g}, ${b}, ${peakA})`);
            grad.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${midA})`);
            grad.addColorStop(1,    'rgba(0,0,0,0)');

            mctx.beginPath();
            mctx.arc(px, py, glowRadius, 0, Math.PI * 2);
            mctx.fillStyle = grad;
            mctx.fill();
        }

        // Restore normal blending for dots and labels
        mctx.globalCompositeOperation = 'source-over';

        // Pass 2 — crisp core dots + labels on top
        for (const place of sorted) {
            const coords = mProjection([place.lng, place.lat]);
            if (!coords) continue;
            const [x, y] = coords;
            const px = x * countryZoomTransform.k + countryZoomTransform.x;
            const py = y * countryZoomTransform.k + countryZoomTransform.y;
            if (px < -50 || px > mapWidth + 50 || py < -50 || py > mapHeight + 50) continue;

            const records = place.records || 1;
            const t = Math.log1p(records) / logMax;

            const r = Math.round(80  + t * 175);
            const g = Math.round(220 - t * 151);
            const b = Math.round(200 - t * 200);

            // Dot: 2px (cold) → 5px (hot)
            const dotR = 2 + t * 3;
            mctx.beginPath();
            mctx.arc(px, py, dotR, 0, Math.PI * 2);
            mctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
            mctx.fill();

            // Label: always show top-quarter places; others only when zoomed in
            const showLabel = t > 0.75 || countryZoomTransform.k >= 1.5;
            if (showLabel) {
                const fontSize = Math.round(8 + t * 4);
                mctx.font = `${fontSize}px "Space Grotesk", sans-serif`;
                mctx.fillStyle = 'rgba(232, 234, 246, 0.88)';
                mctx.textAlign = 'center';
                mctx.textBaseline = 'top';
                mctx.shadowColor = 'rgba(8, 12, 28, 1)';
                mctx.shadowBlur = 4;
                mctx.fillText(place.name, px, py + dotR + 2);
                mctx.shadowBlur = 0;
            }
        }
    }

    // renderCountryPlacesList removed — place names shown on map canvas

    // --- Mouse & Touch Event Bindings ---
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
        const sensitivity = 0.4 / zoomFactor;
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

    // Hover detection
    canvas.addEventListener('mouseenter', () => {
        isMouseOverGlobe = true;
    });

    canvas.addEventListener('mouseleave', () => {
        isMouseOverGlobe = false;
        hoveredCountry = null;
        canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) return; // Do not calculate hover during drag

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const cx = width / 2;
        const cy = height / 2;
        const r = projection.scale();
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

        if (dist > r) {
            if (hoveredCountry) {
                hoveredCountry = null;
                canvas.style.cursor = 'grab';
            }
            return;
        }

        const coords = projection.invert([x, y]);
        if (!coords) return;

        const d = d3.geoDistance(coords, projection.invert([width / 2, height / 2]));
        if (d > Math.PI / 2) {
            if (hoveredCountry) {
                hoveredCountry = null;
                canvas.style.cursor = 'grab';
            }
            return;
        }

        if (worldData && worldData.countries) {
            const country = worldData.countries.features.find(f => d3.geoContains(f, coords));
            if (country) {
                const countryName = normalizeCountryName(country.properties.name);
                const hasVisited = places.some(p => normalizeCountryName(p.country) === countryName);
                if (hasVisited) {
                    if (!hoveredCountry || hoveredCountry.id !== country.id) {
                        hoveredCountry = country;
                        canvas.style.cursor = 'pointer';
                    }
                } else {
                    if (hoveredCountry) {
                        hoveredCountry = null;
                        canvas.style.cursor = 'grab';
                    }
                }
            } else {
                if (hoveredCountry) {
                    hoveredCountry = null;
                    canvas.style.cursor = 'grab';
                }
            }
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
            const sensitivity = 0.4 / zoomFactor;
            currentRotation[0] = rotationStart[0] + dx * sensitivity;
            currentRotation[1] = Math.max(-60, Math.min(60, rotationStart[1] - dy * sensitivity));
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

    // --- Video Pane Close Button ---
    (function() {
        const closeBtn = document.getElementById('video-pane-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const pane = document.getElementById('country-video-pane');
                const area = document.getElementById('video-embed-area');
                if (pane) pane.style.display = 'none';
                if (area) area.innerHTML = '';
            });
        }
    })();

    function initCountryMapZoom() {
        const mapCanvas = document.getElementById('country-map-canvas');
        if (!mapCanvas) return;

        countryZoom = d3.zoom()
            .scaleExtent([1, 12]) // Zoom limits
            .on('zoom', (event) => {
                countryZoomTransform = event.transform;
                if (selectedCountry) {
                    const countryPlaces = places.filter(p => normalizeCountryName(p.country) === normalizeCountryName(selectedCountry.properties.name));
                    renderCountryMap(selectedCountry, countryPlaces);
                }
            });

        d3.select(mapCanvas).call(countryZoom);
    }

    // --- Init ---
    async function init() {
        console.log("Initializing globe: sizing canvas...");
        resize();
        initCountryMapZoom();
        console.log("Loading world map and places CSV...");
        await Promise.all([loadWorld(), loadPlaces(), loadCountryVideos()]);
        console.log("Loaded " + places.length + " places. Starting draw loop...");
        draw(0);
    }

    window.addEventListener('resize', () => {
        resize();
        if (selectedCountry) {
            const countryPlaces = places.filter(p => normalizeCountryName(p.country) === normalizeCountryName(selectedCountry.properties.name));
            renderCountryMap(selectedCountry, countryPlaces);
        }
    });

    init();
})();
