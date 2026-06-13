/* ============================================================
   Interactive Animated Globe — Pure Canvas + D3-geo-like math
   Renders an animated wireframe globe with location markers,
   arcs between places, and smooth rotation.
   No external 3D libraries — just Canvas 2D + spherical math.
   ============================================================ */

(function () {
    const canvas = document.getElementById('globe-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // --- Default Places (from CV locations) ---
    let places = [
        { name: 'Göttingen', lat: 51.5339, lng: 9.9356, country: 'Germany', note: 'PhD & Masters — University of Göttingen' },
        { name: 'Geneva (CERN)', lat: 46.2044, lng: 6.1432, country: 'Switzerland', note: 'ATLAS Experiment at CERN' },
        { name: 'Delhi', lat: 28.6139, lng: 77.209, country: 'India', note: 'Summer Intern — IUAC' },
        { name: 'Coimbatore', lat: 11.0168, lng: 76.9558, country: 'India', note: 'BSc Physics — Amrita University' },
        { name: 'Chennai', lat: 13.0827, lng: 80.2707, country: 'India', note: 'Hometown — Higher Secondary' },
        { name: 'Bangalore', lat: 12.9716, lng: 77.5946, country: 'India', note: 'Research Intern — SSERD' },
        { name: 'Dortmund', lat: 51.5136, lng: 7.4653, country: 'Germany', note: 'DPG Spring Meeting 2024' },
    ];

    // --- Globe Config ---
    let width, height, cx, cy, radius;
    let rotation = { x: -20, y: 30 }; // lon, lat view angles
    let autoRotate = true;
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let rotStart = { x: 0, y: 0 };
    let hoverPlace = null;

    // --- GeoJSON-like data: simplified continents ---
    // We'll draw graticules + land outlines from simplified coordinates
    const DEG = Math.PI / 180;

    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        width = rect.width;
        height = rect.height;
        cx = width / 2;
        cy = height / 2;
        radius = Math.min(width, height) * 0.38;
    }

    // --- Spherical → Screen projection (orthographic) ---
    function project(lat, lng) {
        const lambda = (lng + rotation.x) * DEG;
        const phi = lat * DEG;
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);
        const cosLambda = Math.cos(lambda);
        const sinLambda = Math.sin(lambda);

        const rotY = rotation.y * DEG;
        const cosRotY = Math.cos(rotY);
        const sinRotY = Math.sin(rotY);

        // Orthographic projection with tilt
        const x = cosPhi * sinLambda;
        const y = sinPhi * cosRotY - cosPhi * cosLambda * sinRotY;
        const z = sinPhi * sinRotY + cosPhi * cosLambda * cosRotY;

        if (z < -0.05) return null; // behind globe

        return {
            x: cx + x * radius,
            y: cy - y * radius,
            z: z,
            scale: (z + 1) / 2
        };
    }

    // --- Draw Graticules ---
    function drawGraticules() {
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.06)';
        ctx.lineWidth = 0.5;

        // Latitude lines
        for (let lat = -80; lat <= 80; lat += 20) {
            ctx.beginPath();
            let started = false;
            for (let lng = -180; lng <= 180; lng += 3) {
                const p = project(lat, lng);
                if (p) {
                    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                    else ctx.lineTo(p.x, p.y);
                } else {
                    started = false;
                }
            }
            ctx.stroke();
        }

        // Longitude lines
        for (let lng = -180; lng < 180; lng += 30) {
            ctx.beginPath();
            let started = false;
            for (let lat = -90; lat <= 90; lat += 3) {
                const p = project(lat, lng);
                if (p) {
                    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                    else ctx.lineTo(p.x, p.y);
                } else {
                    started = false;
                }
            }
            ctx.stroke();
        }
    }

    // --- Simplified continent outlines ---
    // Major landmass boundary points (very simplified for performance)
    const CONTINENTS = [
        // Europe (simplified)
        [[71,28],[70,30],[65,28],[60,30],[55,23],[50,5],[48,0],[43,-9],[36,-6],[36,0],[38,10],[39,20],[40,26],[42,28],[45,30],[48,28],[52,20],[54,12],[56,10],[58,20],[60,25],[65,28],[70,30],[71,28]],
        // Africa
        [[37,-10],[35,10],[33,13],[30,32],[25,33],[20,37],[15,40],[10,42],[5,40],[0,42],[-5,40],[-10,35],[-15,35],[-20,30],[-25,28],[-30,25],[-34,18],[-34,24],[-30,30],[-25,33],[-20,35],[-15,40],[-10,42],[-5,42],[0,45],[5,50],[10,50],[15,50],[20,40],[25,37],[30,33],[33,20],[35,15],[37,-10]],
        // Asia (simplified)
        [[50,40],[45,50],[40,55],[35,55],[30,50],[25,55],[22,60],[20,65],[15,75],[10,80],[5,100],[0,105],[-5,106],[-8,115],[0,120],[5,120],[10,125],[15,120],[20,110],[23,113],[25,105],[30,100],[35,105],[38,115],[40,125],[42,130],[45,135],[50,140],[55,135],[60,140],[65,170],[70,180],[72,170],[72,140],[70,120],[68,100],[65,80],[60,65],[55,60],[50,50],[50,40]],
        // North America (simplified)
        [[60,-170],[55,-165],[50,-130],[45,-125],[40,-125],[35,-120],[30,-115],[25,-110],[20,-105],[15,-90],[18,-88],[20,-87],[22,-85],[25,-80],[27,-80],[30,-82],[30,-85],[32,-90],[30,-95],[28,-97],[26,-97],[20,-100],[25,-110],[30,-115],[33,-118],[37,-122],[40,-124],[45,-125],[48,-124],[50,-127],[55,-130],[58,-135],[60,-145],[65,-170],[70,-170],[72,-160],[72,-140],[70,-130],[68,-115],[65,-90],[60,-75],[55,-65],[50,-60],[47,-55],[45,-60],[43,-65],[42,-70],[40,-72],[37,-76],[35,-75],[30,-80],[30,-82]],
        // South America (simplified)
        [[12,-70],[10,-75],[5,-77],[0,-80],[-5,-80],[-10,-77],[-15,-75],[-20,-70],[-25,-65],[-30,-60],[-35,-57],[-40,-62],[-45,-65],[-50,-70],[-55,-67],[-55,-63],[-50,-60],[-45,-58],[-40,-55],[-35,-50],[-30,-48],[-25,-45],[-20,-40],[-15,-35],[-10,-35],[-5,-35],[0,-50],[5,-60],[10,-65],[12,-70]],
        // Australia
        [[-15,130],[-20,115],[-25,115],[-30,115],[-33,120],[-35,135],[-38,145],[-37,150],[-33,152],[-28,153],[-23,150],[-18,148],[-15,145],[-12,142],[-12,135],[-15,130]],
    ];

    function drawContinents() {
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.15)';
        ctx.fillStyle = 'rgba(100, 255, 218, 0.03)';
        ctx.lineWidth = 0.8;

        for (const continent of CONTINENTS) {
            ctx.beginPath();
            let started = false;
            let allVisible = true;
            const projected = [];

            for (const [lat, lng] of continent) {
                const p = project(lat, lng);
                if (p) {
                    projected.push(p);
                    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                    else ctx.lineTo(p.x, p.y);
                } else {
                    allVisible = false;
                    started = false;
                }
            }

            if (projected.length > 2) {
                ctx.fill();
                ctx.stroke();
            }
        }
    }

    // --- Draw Location Markers ---
    function drawPlaces(time) {
        hoverPlace = null;

        for (const place of places) {
            const p = project(place.lat, place.lng);
            if (!p || p.z < 0) continue;

            // Pulsing dot
            const pulse = Math.sin(time / 600 + place.lat) * 0.3 + 0.7;
            const dotRadius = 4 * p.scale * pulse + 2;

            // Glow
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, dotRadius * 3);
            grad.addColorStop(0, `rgba(255, 169, 77, ${0.6 * p.scale})`);
            grad.addColorStop(0.5, `rgba(255, 107, 107, ${0.2 * p.scale})`);
            grad.addColorStop(1, 'rgba(255, 107, 107, 0)');
            ctx.beginPath();
            ctx.arc(p.x, p.y, dotRadius * 3, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 169, 77, ${0.9 * p.scale})`;
            ctx.fill();

            // Label (only for front-facing)
            if (p.z > 0.3) {
                ctx.font = `${Math.round(11 * p.scale + 1)}px "Space Grotesk", sans-serif`;
                ctx.fillStyle = `rgba(232, 234, 246, ${0.8 * p.scale})`;
                ctx.textAlign = 'left';
                ctx.fillText(place.name, p.x + dotRadius + 6, p.y + 4);
            }
        }
    }

    // --- Draw arcs between connected places ---
    function drawArcs(time) {
        if (places.length < 2) return;

        ctx.strokeStyle = 'rgba(100, 255, 218, 0.08)';
        ctx.lineWidth = 0.8;

        // Connect in order
        for (let i = 0; i < places.length - 1; i++) {
            const a = places[i];
            const b = places[i + 1];
            drawGreatCircleArc(a.lat, a.lng, b.lat, b.lng, time);
        }
    }

    function drawGreatCircleArc(lat1, lng1, lat2, lng2, time) {
        ctx.beginPath();
        let started = false;
        const steps = 30;

        for (let t = 0; t <= steps; t++) {
            const frac = t / steps;
            const lat = lat1 + (lat2 - lat1) * frac;
            const lng = lng1 + (lng2 - lng1) * frac;
            const p = project(lat, lng);
            if (p && p.z > -0.1) {
                if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                else ctx.lineTo(p.x, p.y);
            } else {
                started = false;
            }
        }
        ctx.stroke();
    }

    // --- Globe sphere outline & glow ---
    function drawGlobeSphere() {
        // Outer glow
        const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.3);
        glowGrad.addColorStop(0, 'rgba(100, 255, 218, 0.02)');
        glowGrad.addColorStop(0.5, 'rgba(100, 255, 218, 0.01)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // Globe disc (dark fill)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 14, 26, 0.4)';
        ctx.fill();

        // Border ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(100, 255, 218, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // --- Animation Loop ---
    let animFrame;
    function animate(time) {
        // Reset transform for each frame
        ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        if (autoRotate && !isDragging) {
            rotation.x += 0.15;
        }

        drawGlobeSphere();
        drawGraticules();
        drawContinents();
        drawArcs(time);
        drawPlaces(time);

        animFrame = requestAnimationFrame(animate);
    }

    // --- Mouse / Touch Interaction ---
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        rotStart = { ...rotation };
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        rotation.x = rotStart.x + dx * 0.3;
        rotation.y = Math.max(-80, Math.min(80, rotStart.y + dy * 0.3));
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        dragStart = { x: touch.clientX, y: touch.clientY };
        rotStart = { ...rotation };
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragStart.x;
        const dy = touch.clientY - dragStart.y;
        rotation.x = rotStart.x + dx * 0.3;
        rotation.y = Math.max(-80, Math.min(80, rotStart.y + dy * 0.3));
    }, { passive: true });

    canvas.addEventListener('touchend', () => { isDragging = false; });

    canvas.style.cursor = 'grab';

    // --- Controls ---
    document.querySelectorAll('.globe-controls button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.globe-controls button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            autoRotate = btn.dataset.action === 'rotate';
        });
    });

    // --- CSV Upload Handler ---
    const fileInput = document.getElementById('csv-upload');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--accent-aurora)';
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '';
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '';
            if (e.dataTransfer.files.length) {
                handleFile(e.dataTransfer.files[0]);
            }
        });
    }

    function handleFileUpload(e) {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    }

    function handleFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;

            if (file.name.endsWith('.json')) {
                try {
                    const data = JSON.parse(text);
                    parseJSONPlaces(data);
                } catch (err) {
                    console.error('Invalid JSON:', err);
                }
            } else {
                parseCSVPlaces(text);
            }

            renderPlacesList();
        };
        reader.readAsText(file);
    }

    function parseCSVPlaces(text) {
        const lines = text.trim().split('\n');
        const header = lines[0].toLowerCase();
        const hasHeader = header.includes('name') || header.includes('lat');
        const start = hasHeader ? 1 : 0;

        const newPlaces = [];
        for (let i = start; i < lines.length; i++) {
            const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (cols.length >= 3) {
                const name = cols[0];
                const lat = parseFloat(cols[1]);
                const lng = parseFloat(cols[2]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    newPlaces.push({
                        name: name,
                        lat: lat,
                        lng: lng,
                        country: cols[3] || '',
                        note: cols[4] || ''
                    });
                }
            }
        }

        if (newPlaces.length > 0) {
            places = [...places, ...newPlaces];
        }
    }

    function parseJSONPlaces(data) {
        // Handle Google Maps Timeline JSON format
        if (data.timelineObjects) {
            const newPlaces = [];
            const seen = new Set();
            for (const obj of data.timelineObjects) {
                const visit = obj.placeVisit;
                if (visit && visit.location) {
                    const loc = visit.location;
                    const key = `${loc.name || ''}:${(loc.latitudeE7/1e7).toFixed(2)}`;
                    if (!seen.has(key) && loc.latitudeE7) {
                        seen.add(key);
                        newPlaces.push({
                            name: loc.name || 'Unknown',
                            lat: loc.latitudeE7 / 1e7,
                            lng: loc.longitudeE7 / 1e7,
                            country: loc.address || '',
                            note: ''
                        });
                    }
                }
            }
            if (newPlaces.length) places = [...places, ...newPlaces];
        }
        // Handle simple array format
        else if (Array.isArray(data)) {
            for (const item of data) {
                if (item.lat && item.lng) {
                    places.push({
                        name: item.name || 'Unknown',
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lng),
                        country: item.country || '',
                        note: item.note || ''
                    });
                }
            }
        }
    }

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
    function init() {
        resize();
        renderPlacesList();
        animate(0);
    }

    window.addEventListener('resize', () => {
        cancelAnimationFrame(animFrame);
        resize();
        animate(0);
    });

    init();
})();
