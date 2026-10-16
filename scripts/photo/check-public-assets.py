#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""CI backstop, not a privacy detector: blocks obvious originals and EXIF/XMP leaks."""
from pathlib import Path
import subprocess
import sys
from PIL import Image

root=Path(__file__).resolve().parents[2]
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
errors=[]
for name in filter(None,files):
    path=root/name
    if any(part in {'private-photos','photo-work'} for part in Path(name).parts) or path.suffix.lower() in {'.dng','.cr2','.cr3','.nef','.arw','.las','.laz'}:
        errors.append(name+': original/private processing file')
    if name.startswith('public/') and path.suffix.lower() in {'.jpg','.jpeg','.png','.webp','.tif','.tiff'}:
        if path.suffix.lower() in {'.tif','.tiff'}:
            errors.append(name+': source raster must be tiled before release');continue
        try:
            with Image.open(path) as im:
                if im.getexif() or any('xmp' in str(k).lower() for k in im.info):
                    errors.append(name+': EXIF/XMP found; strip metadata and review privacy')
        except Exception as e: errors.append(name+': invalid image '+type(e).__name__)
if errors:
    print('\n'.join(errors),file=sys.stderr);sys.exit(1)
print('Tracked assets: no raw photographic originals, source GeoTIFFs or EXIF/XMP found. Visual privacy review is still required.')
