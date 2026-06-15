"""
recount_places.py
-----------------
Re-counts how many Timeline.json semantic segments have at least one GPS point
within RADIUS_KM of each place in places.csv.

This gives a proper "time spent" weight driven entirely by raw Google Maps data,
fixing places like Göttingen (home city) that were added manually without a count.

Output: data/places.csv (updated in-place with corrected record counts in the note field)
"""

import json
import csv
import math
import sys
import os
import re

TIMELINE_PATH = os.path.expanduser("~/Timeline.json")
PLACES_CSV    = os.path.join(os.path.dirname(__file__), "../data/places.csv")
RADIUS_KM     = 15.0   # match a segment to a place if any point is within this radius


def haversine(lat1, lon1, lat2, lon2):
    """Great-circle distance in km between two (lat, lon) points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def parse_point(point_str):
    """Parse '51.5339°, 9.9356°' -> (lat, lon)."""
    parts = point_str.replace("°", "").split(",")
    return float(parts[0].strip()), float(parts[1].strip())


def load_places(path):
    places = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                places.append({
                    "name":    row["name"],
                    "lat":     float(row["lat"]),
                    "lng":     float(row["lng"]),
                    "country": row.get("country", ""),
                    "note":    row.get("note", ""),
                    "count":   0,
                })
            except (ValueError, KeyError):
                pass
    return places


def main():
    print(f"Loading places from {PLACES_CSV} ...")
    places = load_places(PLACES_CSV)
    print(f"  {len(places)} places loaded.")

    print(f"Streaming {TIMELINE_PATH} ...")
    total_segments = 0
    matched_segments = 0

    # Stream the JSON iteratively to avoid loading 500MB into memory at once.
    # The file is a single large object: {"semanticSegments": [...]}
    # We use ijson if available, otherwise fall back to full load.
    try:
        import ijson
        use_ijson = True
    except ImportError:
        use_ijson = False
        print("  ijson not found — loading full file (may use ~1 GB RAM).")

    def process_segment(seg):
        nonlocal total_segments, matched_segments
        total_segments += 1

        # Collect all GPS points in this segment
        pts = []
        for tp in seg.get("timelinePath", []):
            try:
                pts.append(parse_point(tp["point"]))
            except Exception:
                pass
        # Also check visit/activity locations
        for key in ("visit", "activity"):
            obj = seg.get(key, {})
            loc = obj.get("topCandidate", {}).get("placeLocation", {}) or obj.get("location", {})
            if "latLng" in loc:
                try:
                    pts.append(parse_point(loc["latLng"]))
                except Exception:
                    pass

        if not pts:
            return

        # For each place, check if ANY point in this segment is within RADIUS_KM
        for place in places:
            for lat, lon in pts:
                if haversine(lat, lon, place["lat"], place["lng"]) <= RADIUS_KM:
                    place["count"] += 1
                    matched_segments += 1
                    break   # count this segment once per place

    if use_ijson:
        with open(TIMELINE_PATH, "rb") as f:
            for seg in ijson.items(f, "semanticSegments.item"):
                process_segment(seg)
                if total_segments % 50000 == 0:
                    print(f"  ... {total_segments} segments processed", end="\r", flush=True)
    else:
        with open(TIMELINE_PATH, encoding="utf-8") as f:
            data = json.load(f)
        for seg in data.get("semanticSegments", []):
            process_segment(seg)
            if total_segments % 50000 == 0:
                print(f"  ... {total_segments} segments processed", end="\r", flush=True)

    print(f"\nDone. {total_segments} total segments, {matched_segments} place matches.")

    # Print top results
    ranked = sorted(places, key=lambda p: p["count"], reverse=True)
    print("\nTop 20 places by segment count:")
    for p in ranked[:20]:
        print(f"  {p['count']:>6}  {p['name']}, {p['country']}")

    # Write updated CSV
    print(f"\nWriting updated {PLACES_CSV} ...")
    with open(PLACES_CSV, newline="", encoding="utf-8") as f:
        original_rows = list(csv.DictReader(f))

    # Build lookup by (name, lat, lng)
    count_map = {(p["name"], str(p["lat"]), str(p["lng"])): p["count"] for p in places}

    out_rows = []
    for row in original_rows:
        key = (row["name"], row["lat"], row["lng"])
        new_count = count_map.get(key, None)
        if new_count is not None:
            # Strip old record count from note and write fresh one
            note = re.sub(r'\s*\(\d+ records?\)', '', row.get("note", "")).strip()
            row["note"] = f"{note} ({new_count} records)" if new_count > 0 else note
        out_rows.append(row)

    with open(PLACES_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "lat", "lng", "country", "note"])
        writer.writeheader()
        writer.writerows(out_rows)

    print("Done! places.csv updated.")


if __name__ == "__main__":
    main()
