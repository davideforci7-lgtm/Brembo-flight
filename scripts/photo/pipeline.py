#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Offline photographic intake, independent geospatial checks and bounded tile export.
Originals and private reports stay outside the git checkout. No network or uploads.
"""
import argparse
import hashlib
import html
from urllib.parse import urlparse
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def read_json(path):
    def invalid(value):
        raise ValueError(f"Non-finite JSON number: {value}")
    return json.loads(Path(path).read_text(), parse_constant=invalid)


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def outside_repo(path):
    path = Path(path).resolve()
    if path == ROOT or ROOT in path.parents:
        raise ValueError('Originals and private reports must be outside the repository')
    return path


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation: do not overwrite a previous inventory or approval.
    with path.open('x') as stream:
        json.dump(data, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')


def inventory(source, output):
    from PIL import Image, ExifTags
    source, output = outside_repo(source), outside_repo(output)
    if not source.is_dir():
        raise ValueError('An originals directory is required')
    entries, seen = [], {}
    for path in sorted(source.rglob('*')):
        if path.is_symlink() or path.suffix.lower() not in {'.jpg', '.jpeg', '.dng'}:
            continue
        if not path.is_file():
            continue
        entry = {'file': str(path.relative_to(source)), 'sha256': sha256(path),
                 'bytes': path.stat().st_size, 'warnings': []}
        if entry['sha256'] in seen:
            entry['duplicateOf'] = seen[entry['sha256']]
        seen.setdefault(entry['sha256'], entry['file'])
        if shutil.which('exiftool'):
            result = subprocess.run(['exiftool', '-json', '-n', '-Make', '-Model',
                '-DateTimeOriginal', '-ImageWidth', '-ImageHeight', '-Orientation',
                '-FocalLength', '-ExposureTime', '-ISO', '-GPSLatitude', '-GPSLongitude',
                '-GPSAltitude', '-GPSAltitudeRef', str(path)], check=False,
                capture_output=True, text=True, timeout=30)
            try:
                metadata = json.loads(result.stdout)[0]
            except (ValueError, IndexError):
                metadata = {}
            if result.returncode:
                entry['warnings'].append('ExifTool could not fully inspect this original')
            metadata.pop('SourceFile', None)
            entry['metadata'] = metadata
            entry['metadataReader'] = 'ExifTool'
            entry['hasGPS'] = all(k in metadata for k in ['GPSLatitude', 'GPSLongitude'])
        else:
            entry['metadataReader'] = 'Pillow (partial; no DJI XMP/RAW development)'
            try:
                with Image.open(path) as im:
                    exif = im.getexif()
                    details = dict(exif)
                    try:
                        details.update(exif.get_ifd(ExifTags.IFD.Exif))
                    except (KeyError, TypeError):
                        pass
                    entry['width'], entry['height'] = im.size
                    entry['metadata'] = {ExifTags.TAGS.get(k, str(k)): str(v)
                        for k, v in details.items() if k in {271, 272, 274, 306, 33434, 34855, 36867, 37386}}
                    entry['hasGPS'] = bool(exif.get(34853))
                    if path.suffix.lower() != '.dng':
                        im.verify()
            except Exception as exc:
                entry['warnings'].append('Metadata/image inspection incomplete: ' + type(exc).__name__)
            if path.suffix.lower() == '.dng':
                entry['warnings'].append('DNG requires ExifTool and a separate RAW development step')
        if not entry.get('hasGPS'):
            entry['warnings'].append('No GPS detected: ground control or camera alignment required')
        entry['warnings'].append('Altitude datum, sharpness, overlap and privacy require review')
        entries.append(entry)
    if not entries:
        raise ValueError('No JPG/JPEG/DNG originals found')
    report = {'schemaVersion': 1, 'private': True, 'files': entries,
              'uniqueFiles': len(seen), 'readyForReconstruction': False}
    write_json(output, report)
    return report


def transformer(source, target):
    from pyproj import CRS, network
    from pyproj.transformer import TransformerGroup
    from pyproj.aoi import AreaOfInterest
    network.set_network_enabled(False)  # Never silently download geoid/datum grids.
    if len(CRS(source).axis_info) != 2 or len(CRS(target).axis_info) != 2:
        raise ValueError('Use explicit 2D horizontal CRS; vertical transformation is a separate reviewed step')
    crs = CRS(target)
    if not crs.is_projected or any(a.unit_name != 'metre' for a in crs.axis_info[:2]):
        raise ValueError('Target horizontal CRS must use projected metres')
    group = TransformerGroup(source, target, always_xy=True, allow_ballpark=False,
                             area_of_interest=AreaOfInterest(9.5, 45.7, 9.8, 46.0))
    if not group.best_available or not group.transformers:
        raise ValueError('Required datum operation/grid unavailable; no ballpark fallback')
    return group.transformers[0]


def alignment(config, output):
    import pyproj
    config, output = outside_repo(config), outside_repo(output)
    data = read_json(config)
    if not isinstance(data.get('assetSHA256'), str) or len(data['assetSHA256']) != 64:
        raise ValueError('Check configuration must identify the asset SHA256')
    tx = transformer(data['sourceCRS'], data['targetCRS'])
    checks = [p for p in data['points'] if p['role'] == 'check']
    if len(checks) < 3:
        raise ValueError('At least three independent check points (not fitted controls) required')
    limits = data['limits']
    if any(not math.isfinite(limits[k]) or limits[k] <= 0 for k in ['horizontalRMSE', 'horizontalMax', 'verticalRMSE', 'verticalMax']):
        raise ValueError('Explicit positive acceptance limits in metres required')
    # Do not claim a vertical transformation from a 2D EPSG operation.
    source_z, target_z = data.get('sourceVerticalDatum'), data.get('targetVerticalDatum')
    same_vertical = bool(data.get('verticalDatumVerified') is True and source_z and source_z == target_z and
                         source_z.lower() not in {'unknown', 'unspecified'})
    residuals, refs = [], []
    for point in checks:
        a, b = point['source'], point['reference']
        if len(a) < 2 or len(b) < 2 or not all(math.isfinite(n) for n in a + b):
            raise ValueError('Invalid check point')
        e, n = tx.transform(a[0], a[1], errcheck=True)
        if not all(math.isfinite(v) for v in [e, n]):
            raise ValueError('Invalid transformation result')
        dx, dn = e - b[0], n - b[1]
        row = {'id': point['id'], 'east': dx, 'north': dn, 'horizontal': math.hypot(dx, dn)}
        if same_vertical and len(a) == 3 and len(b) == 3:
            row['vertical'] = a[2] - b[2]
        residuals.append(row)
        refs.append(b[:2])
    # Three or more points on a line cannot constrain an area reliably.
    p0 = refs[0]
    area = max(abs((a[0]-p0[0])*(b[1]-p0[1]) - (a[1]-p0[1])*(b[0]-p0[0]))
               for a in refs for b in refs) / 2
    if area < data.get('minimumCheckAreaM2', 100):
        raise ValueError('Check points have insufficient two-dimensional spread')
    def rmse(values):
        return math.sqrt(sum(v*v for v in values) / len(values))
    horizontal = [p['horizontal'] for p in residuals]
    vertical = [p['vertical'] for p in residuals if 'vertical' in p]
    result = {'schemaVersion': 1, 'inputSHA256': sha256(config),
        'assetSHA256': data['assetSHA256'],
        'sourceCRS': data['sourceCRS'], 'targetCRS': data['targetCRS'],
        'sourceVerticalDatum': source_z, 'targetVerticalDatum': target_z,
        'operation': tx.description, 'operationDefinition': tx.definition,
        'operationAccuracyMeters': tx.accuracy if tx.accuracy >= 0 else None,
        'pyproj': pyproj.__version__, 'proj': pyproj.proj_version_str,
        'checkCount': len(checks), 'checkAreaM2': area, 'residuals': residuals,
        'horizontalRMSE': rmse(horizontal), 'horizontalMax': max(horizontal),
        'horizontalP95': sorted(horizontal)[math.ceil(.95*len(horizontal))-1],
        'biasEast': sum(p['east'] for p in residuals)/len(checks),
        'biasNorth': sum(p['north'] for p in residuals)/len(checks),
        'verticalRMSE': rmse(vertical) if vertical else None,
        'verticalMax': max(map(abs, vertical)) if vertical else None,
        'limits': limits,
        'horizontalAccepted': rmse(horizontal) <= limits['horizontalRMSE'] and max(horizontal) <= limits['horizontalMax'],
        'verticalAccepted': len(vertical) == len(checks) and rmse(vertical) <= limits['verticalRMSE'] and max(map(abs, vertical)) <= limits['verticalMax'],
        'notes': ['Check residuals are not source accuracy. No registration/offset was fitted.',
                  'Unknown/different vertical datums block 3D fusion; resolve externally and recheck.']}
    write_json(output, result)
    return result


def tiles(source, release_file, output, sector_file):
    import numpy as np
    import rasterio
    from rasterio.vrt import WarpedVRT
    from rasterio.transform import from_bounds
    from rasterio.enums import Resampling, ColorInterp
    from PIL import Image
    source, release_file = outside_repo(source), outside_repo(release_file)
    release = read_json(release_file)
    if release.get('redistributionApproved') is not True or release.get('privacyReviewed') is not True:
        raise ValueError('Redistribution permission and privacy review are required')
    for field in ['sourceURL', 'license', 'licenseURL', 'attribution', 'captureDate', 'permissionReference']:
        if not isinstance(release.get(field), str) or not release[field].strip():
            raise ValueError('Missing release field: ' + field)
    if any(urlparse(release[k]).scheme != 'https' for k in ['sourceURL', 'licenseURL']):
        raise ValueError('Public source and license URLs must use HTTPS')
    if release.get('sourceSHA256') != sha256(source):
        raise ValueError('Release does not match source checksum')
    report_path = outside_repo(Path(release_file).parent / release['alignmentReport'])
    report = read_json(report_path)
    if release.get('alignmentSHA256') != sha256(report_path) or report.get('horizontalAccepted') is not True or report.get('assetSHA256') != sha256(source):
        raise ValueError('Matching accepted horizontal alignment report required')
    sector = read_json(sector_file)
    reference = sector['reference']
    if report['targetCRS'] != reference['projectedCRS']:
        raise ValueError('Alignment target does not match sector CRS')
    tile_size = release.get('tileMeters', 200)
    grid = 20  # Existing PR #3 collision/terrain grid, deliberately unchanged.
    if tile_size not in [100, 200, 400] or sector['size'] != 4000:
        raise ValueError('Unsupported grid; supported tiles 100/200/400m on existing 4km sector')
    output = Path(output).resolve()
    if output.exists():
        raise ValueError('Export directory already exists; choose a new release directory')
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.photo-export-', dir=output.parent))
    exported, skipped = [], 0
    try:
        with rasterio.open(source) as src:
            if src.crs is None or src.count not in [3, 4] or any(t != 'uint8' for t in src.dtypes):
                raise ValueError('Use an orthorectified RGB/RGBA uint8 GeoTIFF with explicit CRS')
            if tuple(src.colorinterp[:3]) != (ColorInterp.red, ColorInterp.green, ColorInterp.blue):
                raise ValueError('Bands must be RGB, not infrared or an unlabelled raster')
            tx = transformer(src.crs, reference['projectedCRS'])
            # Export requires the orthophoto already reprojected through the audited operation.
            # Avoid a second, potentially different GDAL datum choice during tile export.
            if src.crs.to_string() != reference['projectedCRS'] or report['sourceCRS'] != src.crs.to_string():
                raise ValueError('Reproject GeoTIFF to sector CRS with audited operation, then check/export')
            half = sector['size'] / 2
            ox, on = reference['originEasting'], reference['originNorthing']
            for z in range(-int(half), int(half), tile_size):
                for x in range(-int(half), int(half), tile_size):
                    west, south, east, north = ox+x, on-z-tile_size, ox+x+tile_size, on-z
                    if west < src.bounds.left or east > src.bounds.right or south < src.bounds.bottom or north > src.bounds.top:
                        continue
                    tile_id = f'{x}_{z}'
                    levels, complete = [], True
                    for pixels in [512, 1024]:
                        transform = from_bounds(west, south, east, north, pixels, pixels)
                        alpha = ColorInterp.alpha in src.colorinterp
                        with WarpedVRT(src, crs=src.crs, transform=transform, width=pixels, height=pixels,
                                       resampling=Resampling.bilinear, add_alpha=not alpha) as vrt:
                            image = vrt.read([1, 2, 3])
                            mask = vrt.read(vrt.count)
                        if np.any(mask < 255):
                            complete = False
                            break
                        name = f'{tile_id}-{pixels}.webp'
                        Image.fromarray(np.moveaxis(image, 0, 2)).save(temporary/name, 'WEBP', quality=88, method=6)
                        levels.append({'pixels': pixels, 'url': name, 'sha256': sha256(temporary/name),
                                       'bytes': (temporary/name).stat().st_size})
                    if not complete:
                        for level in levels:
                            (temporary/level['url']).unlink()
                        skipped += 1
                        continue
                    exported.append({'id': tile_id, 'bounds': {'minX': x, 'minZ': z, 'maxX': x+tile_size, 'maxZ': z+tile_size}, 'levels': levels})
            if not exported:
                raise ValueError('No fully covered grid-aligned tile; use a larger orthophoto or smaller tile size')
            manifest = {'schemaVersion': 1, 'kind': 'orthophoto', 'reference': reference,
                'terrainGridMeters': grid, 'credit': {k: release[k] for k in ['sourceURL', 'license', 'licenseURL', 'attribution', 'captureDate']},
                'provenance': {'sourceSHA256': sha256(source), 'alignmentSHA256': sha256(report_path),
                    'sourcePixelMeters': list(map(abs, src.res)), 'resampling': 'bilinear',
                    'skippedIncompleteTiles': skipped, 'rasterio': rasterio.__version__,
                    'gdal': rasterio.__gdal_version__, 'operation': tx.description},
                'tiles': exported}
            write_json(temporary/'manifest.json', manifest)
            credit = {k: html.escape(str(v), quote=True) for k, v in manifest['credit'].items()}
            (temporary/'credits.html').write_text('<!doctype html><html lang="it"><meta charset="utf-8">'
                '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Fonti fotografiche</title>'
                '<main><h1>Fotografie del terreno</h1><p>'+credit['attribution']+'</p><p>Data: '+credit['captureDate']+
                '</p><p><a href="'+credit['sourceURL']+'">Fonte</a> · <a href="'+credit['licenseURL']+'">'+credit['license']+
                '</a></p><p>Ritaglio e ricampionamento in tessere WebP per BREMBO FLIGHT. La fotografia non verifica le quote del terreno.</p></main></html>')
        temporary.rename(output)
        return manifest
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('inventory'); p.add_argument('originals'); p.add_argument('report')
    p = sub.add_parser('align'); p.add_argument('checks'); p.add_argument('report')
    p = sub.add_parser('tiles'); p.add_argument('orthophoto'); p.add_argument('release'); p.add_argument('output')
    p.add_argument('--sector', default=str(ROOT/'public/geo/brembilla-centro/manifest.json'))
    args = parser.parse_args()
    try:
        if args.command == 'inventory':
            result = inventory(args.originals, args.report)
            print(f"Inventoried {len(result['files'])} files; report remains private")
        elif args.command == 'align':
            result = alignment(args.checks, args.report)
            print(json.dumps({k: result[k] for k in ['horizontalAccepted', 'verticalAccepted', 'horizontalRMSE', 'verticalRMSE']}))
            if not result['horizontalAccepted']:
                raise SystemExit(2)
        else:
            result = tiles(args.orthophoto, args.release, args.output, args.sector)
            print(f"Prepared {len(result['tiles'])} tiles; no upload or activation performed")
    except (ValueError, KeyError, OSError) as exc:
        parser.exit(1, f'Blocked: {exc}\n')


if __name__ == '__main__':
    main()
