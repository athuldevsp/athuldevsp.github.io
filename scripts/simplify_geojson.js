#!/usr/bin/env node

const fs = require('fs');

const [, , inputPath, outputPath, toleranceArg] = process.argv;
const tolerance = Number(toleranceArg);

if (!inputPath || !outputPath || !Number.isFinite(tolerance) || tolerance <= 0) {
    console.error('Usage: node scripts/simplify_geojson.js <input> <output> <tolerance>');
    process.exit(1);
}

function squaredSegmentDistance(point, start, end) {
    let x = start[0];
    let y = start[1];
    let dx = end[0] - x;
    let dy = end[1] - y;

    if (dx || dy) {
        const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
            x = end[0];
            y = end[1];
        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = point[0] - x;
    dy = point[1] - y;
    return dx * dx + dy * dy;
}

function simplifyRing(points) {
    if (points.length <= 4) return points;

    const isClosed = points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1];
    const source = isClosed ? points.slice(0, -1) : points;
    if (source.length <= 3) return points;

    const keep = new Uint8Array(source.length);
    const stack = [[0, source.length - 1]];
    const squaredTolerance = tolerance * tolerance;
    keep[0] = 1;
    keep[source.length - 1] = 1;

    while (stack.length) {
        const [start, end] = stack.pop();
        let furthestIndex = -1;
        let furthestDistance = squaredTolerance;

        for (let index = start + 1; index < end; index++) {
            const distance = squaredSegmentDistance(source[index], source[start], source[end]);
            if (distance > furthestDistance) {
                furthestDistance = distance;
                furthestIndex = index;
            }
        }

        if (furthestIndex >= 0) {
            keep[furthestIndex] = 1;
            stack.push([start, furthestIndex], [furthestIndex, end]);
        }
    }

    const simplified = source.filter((_, index) => keep[index]);
    if (isClosed) simplified.push(simplified[0]);
    return simplified.length >= 4 ? simplified : points;
}

function simplifyCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || !coordinates.length) return coordinates;
    if (Array.isArray(coordinates[0]) && typeof coordinates[0][0] === 'number') {
        return simplifyRing(coordinates);
    }
    return coordinates.map(simplifyCoordinates);
}

const geojson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
geojson.features.forEach(feature => {
    feature.geometry.coordinates = simplifyCoordinates(feature.geometry.coordinates);
});
fs.writeFileSync(outputPath, JSON.stringify(geojson));
