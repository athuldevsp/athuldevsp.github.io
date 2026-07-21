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
    const influenceRadius = 145;
    const displacement = 34;
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

    function warpPoint(x, y) {
        if (pointer.strength < 0.001) return [x, y];

        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= influenceRadius || distance < 0.001) return [x, y];

        const normalized = 1 - distance / influenceRadius;
        const offset = displacement * normalized * normalized * pointer.strength;
        return [
            x + (dx / distance) * offset,
            y + (dy / distance) * offset
        ];
    }

    function traceVerticalLine(x) {
        for (let y = -sampleStep; y <= height + sampleStep; y += sampleStep) {
            const point = warpPoint(x, y);
            if (y === -sampleStep) ctx.moveTo(point[0], point[1]);
            else ctx.lineTo(point[0], point[1]);
        }
    }

    function traceHorizontalLine(y) {
        for (let x = -sampleStep; x <= width + sampleStep; x += sampleStep) {
            const point = warpPoint(x, y);
            if (x === -sampleStep) ctx.moveTo(point[0], point[1]);
            else ctx.lineTo(point[0], point[1]);
        }
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

    const xTo = gsapInstance.quickTo(pointer, 'x', {
        duration: 0.22,
        ease: 'power3.out',
        onUpdate: requestDraw
    });
    const yTo = gsapInstance.quickTo(pointer, 'y', {
        duration: 0.22,
        ease: 'power3.out',
        onUpdate: requestDraw
    });
    const strengthTo = gsapInstance.quickTo(pointer, 'strength', {
        duration: 0.28,
        ease: 'power2.out',
        onUpdate: requestDraw
    });

    window.addEventListener('pointermove', event => {
        xTo(event.clientX);
        yTo(event.clientY);
        strengthTo(1);
    }, { passive: true });

    document.documentElement.addEventListener('mouseleave', () => strengthTo(0));
    window.addEventListener('blur', () => strengthTo(0));
    window.addEventListener('resize', requestResize, { passive: true });

    document.body.prepend(canvas);
    resize();
    document.body.classList.add('has-grid-distortion');
})();
