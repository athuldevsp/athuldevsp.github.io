/* ============================================================
   Pointer-reactive notebook grid
   ============================================================ */

(function () {
    const gsapInstance = window.gsap;
    const canAnimate = gsapInstance
        && window.matchMedia('(hover: hover) and (pointer: fine)').matches
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canAnimate) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'grid-distortion-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const gridSize = 32;
    const influenceRadius = 120;
    const displacement = 14;
    const sampleStep = 8;
    const pointer = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        strength: 0
    };

    let width = 0;
    let height = 0;
    let frameRequested = false;
    let resizeRequested = false;
    let relaxationTween = null;
    const linePoints = [];

    function appendWarpedPoint(points, x, y) {
        if (pointer.strength < 0.001) {
            points.push(x, y);
            return;
        }

        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= influenceRadius || distance < 0.001) {
            points.push(x, y);
            return;
        }

        const normalized = 1 - distance / influenceRadius;
        const offset = displacement * normalized * normalized * normalized * pointer.strength;
        points.push(
            x + (dx / distance) * offset,
            y + (dy / distance) * offset
        );
    }

    function traceSmoothLine(points) {
        if (points.length < 4) return;

        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length - 2; i += 2) {
            const midpointX = (points[i] + points[i + 2]) / 2;
            const midpointY = (points[i + 1] + points[i + 3]) / 2;
            ctx.quadraticCurveTo(points[i], points[i + 1], midpointX, midpointY);
        }
        ctx.lineTo(points[points.length - 2], points[points.length - 1]);
    }

    function traceVerticalLine(x) {
        linePoints.length = 0;
        for (let y = -sampleStep; y <= height + sampleStep; y += sampleStep) {
            appendWarpedPoint(linePoints, x, y);
        }
        traceSmoothLine(linePoints);
    }

    function traceHorizontalLine(y) {
        linePoints.length = 0;
        for (let x = -sampleStep; x <= width + sampleStep; x += sampleStep) {
            appendWarpedPoint(linePoints, x, y);
        }
        traceSmoothLine(linePoints);
    }

    function draw() {
        frameRequested = false;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(0, 117, 121, 0.12)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let x = -1; x <= width + gridSize; x += gridSize) traceVerticalLine(x);
        for (let y = -1; y <= height + gridSize; y += gridSize) traceHorizontalLine(y);
        ctx.stroke();
    }

    function requestDraw() {
        if (frameRequested) return;
        frameRequested = true;
        requestAnimationFrame(draw);
    }

    function resize() {
        resizeRequested = false;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        requestDraw();
    }

    function requestResize() {
        if (resizeRequested) return;
        resizeRequested = true;
        requestAnimationFrame(resize);
    }

    window.addEventListener('pointermove', event => {
        if (relaxationTween) {
            relaxationTween.kill();
            relaxationTween = null;
        }
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.strength = 1;
        requestDraw();
    }, { passive: true });

    function relaxGrid() {
        if (relaxationTween) relaxationTween.kill();
        relaxationTween = gsapInstance.to(pointer, {
            strength: 0,
            duration: 0.2,
            ease: 'power2.out',
            overwrite: true,
            onUpdate: requestDraw,
            onComplete: () => { relaxationTween = null; }
        });
    }

    document.documentElement.addEventListener('mouseleave', relaxGrid);
    window.addEventListener('blur', relaxGrid);
    window.addEventListener('resize', requestResize, { passive: true });

    document.body.prepend(canvas);
    resize();
    document.body.classList.add('has-grid-distortion');
})();
