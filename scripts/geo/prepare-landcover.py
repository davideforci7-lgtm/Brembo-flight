#!/usr/bin/env python3
"""Render the archived OSM polygons as a cartographic colour map, NOT imagery.

No new survey, heights, satellite pixels or remote services. Row 0 is north
(negative local z); holes survive rasterisation. Geometry remains unchanged.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from rasterio.features import rasterize
from rasterio.transform import Affine
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[2]
SECTOR = ROOT / "public/geo/brembilla-centro"
KINDS = {"residential": 3, "industrial": 3, "forest": 1, "wood": 1,
         "meadow": 2, "grass": 2}
# Display colours are illustrative, not measured material reflectances.
PALETTE = np.array([[119, 128, 102], [71, 98, 68], [137, 149, 108],
                    [167, 161, 146]], dtype=np.uint8)


def coverage(areas, resolution, size=4000):
    shapes = []
    # Broad built-up areas first, then explicit vegetation. Stable order for
    # overlapping polygons; a hole doesn't erase an underlying valid polygon.
    for area in sorted(areas, key=lambda a: (0 if KINDS.get(a['kind']) == 3 else 1, a['id'])):
        kind = KINDS.get(area['kind'])
        if kind is None:
            continue
        polygon = Polygon(area['points'], area.get('holes', []))
        if not polygon.is_valid:
            raise ValueError(f"Invalid archived OSM polygon: {area['id']}")
        shapes.append((polygon, kind))
    transform = Affine(size / resolution, 0, -size / 2, 0, size / resolution, -size / 2)
    return rasterize(shapes, out_shape=(resolution, resolution), transform=transform,
                     fill=0, dtype='uint8', all_touched=False)


def main():
    paths = sorted((SECTOR / 'tiles').glob('*.json'))
    areas = [area for p in paths for area in json.loads(p.read_text())['land']]
    report = {
        'kind': 'cartographic-landcover-not-photography',
        'source': 'Archived OpenStreetMap polygons, retrieved 2026-10-14',
        'attribution': '© OpenStreetMap contributors',
        'license': 'ODbL-1.0', 'licenseURL': 'https://opendatacommons.org/licenses/odbl/1-0/',
        'reference': json.loads((SECTOR / 'manifest.json').read_text())['reference'],
        'extentLocalXZ': [-2000, -2000, 2000, 2000], 'rowZero': 'north / negative z',
        'polygons': len(areas), 'paletteSRGB': PALETTE.tolist(),
        'limitations': ['Cartographic colours, not photographs or surveyed materials.',
                       'Pixel spacing is display resolution, not source accuracy.',
                       'No changes to terrain elevations, trees or collisions.'],
        'inputSHA256': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},
        'outputs': [],
    }
    for resolution in [1024, 2048]:
        # Two samples per output axis soften pixel stair-steps without adding
        # geographic detail. Both LODs still derive from the same polygons.
        classes = coverage(areas, resolution * 2)
        output = SECTOR / f'landcover-{resolution}.png'
        image = Image.fromarray(PALETTE[classes]).resize((resolution, resolution), Image.Resampling.LANCZOS)
        image.quantize(colors=64, dither=Image.Dither.NONE).save(output, optimize=True)
        report['outputs'].append({'file': output.name, 'resolution': resolution,
            'pixelSpacingMeters': 4000 / resolution, 'bytes': output.stat().st_size,
            'rgba8MipBudgetBytes': int(resolution ** 2 * 4 * 4 / 3),
            'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
    (SECTOR / 'landcover-source.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'polygons': len(areas), 'outputs': report['outputs']}, indent=2))


if __name__ == '__main__':
    main()
