"""Only generated test patterns: no photographs of Brembilla or personal metadata."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.enums import ColorInterp
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('photo_pipeline', ROOT/'scripts/photo/pipeline.py')
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)


class PipelineTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.sector = ROOT/'public/geo/brembilla-centro/manifest.json'

    def config(self, **changes):
        data = {'assetSHA256': 'a'*64, 'sourceCRS': 'EPSG:32632', 'targetCRS': 'EPSG:32632',
                'sourceVerticalDatum': 'unknown', 'targetVerticalDatum': 'unknown',
                'limits': {'horizontalRMSE': 1, 'horizontalMax': 2, 'verticalRMSE': 1, 'verticalMax': 2},
                'points': [{'id': str(i), 'role': 'check', 'source': [e, n, 400], 'reference': [e, n, 400]}
                           for i, (e,n) in enumerate([(546280,5074440),(546380,5074440),(546280,5074540)])]}
        data.update(changes)
        path = self.dir/'checks.json'; path.write_text(json.dumps(data)); return path

    def test_inventory_duplicates_metadata_and_no_original_modification(self):
        folder = self.dir/'originals'; folder.mkdir()
        exif = Image.Exif(); exif[272] = 'Synthetic test camera'; exif[274] = 1
        Image.new('RGB',(64,48),'red').save(folder/'a.jpg',exif=exif)
        original = (folder/'a.jpg').read_bytes(); (folder/'b.jpg').write_bytes(original)
        report = p.inventory(folder, self.dir/'inventory.json')
        self.assertEqual(report['uniqueFiles'], 1)
        self.assertEqual(report['files'][1]['duplicateOf'], 'a.jpg')
        self.assertFalse(report['readyForReconstruction'])
        self.assertEqual((folder/'a.jpg').read_bytes(), original)
        self.assertTrue(report['files'][0]['warnings'])

    def test_private_paths_rejected_and_reports_not_overwritten(self):
        with self.assertRaises(ValueError): p.outside_repo(ROOT/'private-photos')
        f = self.dir/'report.json'; p.write_json(f, {'ok': True})
        with self.assertRaises(FileExistsError): p.write_json(f, {})

    def test_dng_is_hashed_without_pretending_raw_was_developed(self):
        folder = self.dir/'raw'; folder.mkdir(); (folder/'test.dng').write_bytes(b'SYNTHETIC INVALID RAW')
        report = p.inventory(folder, self.dir/'inventory.json')
        self.assertFalse(report['readyForReconstruction'])
        self.assertTrue(report['files'][0]['warnings'])

    def test_axis_order_and_projection(self):
        f = self.config(sourceCRS='EPSG:4326')
        data = p.read_json(f)
        inverse = Transformer.from_crs(32632,4326,always_xy=True)
        for point in data['points']:
            e,n,z = point['source']; point['source'] = [*inverse.transform(e,n),z]
        f.write_text(json.dumps(data))
        report = p.alignment(f,self.dir/'result.json')
        self.assertLess(report['horizontalRMSE'], .001)
        self.assertTrue(report['horizontalAccepted'])
        self.assertFalse(report['verticalAccepted'])
        self.assertIn('operationAccuracyMeters', report)

    def test_shift_is_reported_not_silently_corrected(self):
        f=self.config(); data=p.read_json(f)
        for point in data['points']: point['source'][0] += 5
        f.write_text(json.dumps(data)); result=p.alignment(f,self.dir/'result.json')
        self.assertEqual(result['biasEast'],5)
        self.assertFalse(result['horizontalAccepted'])

    def test_vertical_gate_and_residual(self):
        f=self.config(sourceVerticalDatum='surveyed-local-test-datum', targetVerticalDatum='surveyed-local-test-datum', verticalDatumVerified=True)
        data=p.read_json(f)
        for point in data['points']: point['source'][2] += .25
        f.write_text(json.dumps(data)); result=p.alignment(f,self.dir/'result.json')
        self.assertTrue(result['verticalAccepted']); self.assertEqual(result['verticalRMSE'],.25)

    def test_unknown_vertical_even_with_small_residual_is_blocked(self):
        f=self.config(verticalDatumVerified=True)
        self.assertFalse(p.alignment(f,self.dir/'result.json')['verticalAccepted'])

    def test_missing_and_collinear_checkpoints_rejected(self):
        f=self.config(); data=p.read_json(f)
        for point in data['points']: point['role']='control'
        f.write_text(json.dumps(data))
        with self.assertRaises(ValueError): p.alignment(f,self.dir/'result.json')
        data=p.read_json(self.config())
        for i,point in enumerate(data['points']): point['reference']=[546280+i*10,5074440,400]
        f.write_text(json.dumps(data))
        with self.assertRaises(ValueError): p.alignment(f,self.dir/'result.json')

    def prepare_raster(self, nodata=False):
        image = np.zeros((3,100,100),dtype='uint8')
        # Explicit synthetic north red, south blue pattern for orientation tests.
        image[0,:50,:]=240; image[2,50:,:]=240; image[1,:,:]=20
        if nodata: image[:,40:45,40:45]=0
        raster=self.dir/'test.tif'
        with rasterio.open(raster,'w',driver='GTiff',width=100,height=100,count=3,
             dtype='uint8',crs='EPSG:32632',transform=from_origin(546280,5074440,1,1),nodata=0 if nodata else None) as dst:
            dst.write(image);dst.colorinterp=(ColorInterp.red,ColorInterp.green,ColorInterp.blue)
        checks=self.config(assetSHA256=p.sha256(raster))
        p.alignment(checks,self.dir/'alignment.json')
        release={'redistributionApproved':True,'privacyReviewed':True,'sourceURL':'https://example.invalid/test',
                 'license':'CC0-1.0','licenseURL':'https://creativecommons.org/publicdomain/zero/1.0/',
                 'attribution':'SYNTHETIC TEST ONLY','captureDate':'synthetic','permissionReference':'unit test',
                 'sourceSHA256':p.sha256(raster),'alignmentReport':'alignment.json',
                 'alignmentSHA256':p.sha256(self.dir/'alignment.json'),'tileMeters':100}
        f=self.dir/'release.json';f.write_text(json.dumps(release)); return raster,f

    def test_tile_export_lods_orientation_metadata_and_reproducibility(self):
        raster, release=self.prepare_raster(); out=self.dir/'output'
        manifest=p.tiles(raster,release,out,self.sector)
        self.assertEqual(len(manifest['tiles']),1)
        tile=manifest['tiles'][0]; self.assertEqual(tile['bounds'],{'minX':0,'minZ':0,'maxX':100,'maxZ':100})
        for level in tile['levels']:
            with Image.open(out/level['url']) as image:
                self.assertEqual(image.size,(level['pixels'],level['pixels']))
                self.assertFalse(image.getexif());self.assertNotIn('xmp',image.info)
                self.assertGreater(image.getpixel((10,10))[0],200)
                self.assertGreater(image.getpixel((10,level['pixels']-10))[2],200)
            self.assertEqual(level['sha256'],p.sha256(out/level['url']))
        other=p.tiles(raster,release,self.dir/'second',self.sector)
        self.assertEqual(manifest,other)

    def test_release_and_alignment_hash_gate(self):
        raster,f=self.prepare_raster(); release=p.read_json(f); release['redistributionApproved']=False
        f.write_text(json.dumps(release))
        with self.assertRaises(ValueError):p.tiles(raster,f,self.dir/'out',self.sector)
        release['redistributionApproved']=True;release['alignmentSHA256']='0'*64;f.write_text(json.dumps(release))
        with self.assertRaises(ValueError):p.tiles(raster,f,self.dir/'out',self.sector)
        self.assertFalse((self.dir/'out').exists())

    def test_nodata_is_not_exported_as_fake_ground(self):
        raster,f=self.prepare_raster(nodata=True)
        with self.assertRaises(ValueError):p.tiles(raster,f,self.dir/'out',self.sector)
        self.assertFalse((self.dir/'out').exists())

    def test_nonfinite_numbers_rejected(self):
        f=self.dir/'bad.json';f.write_text('{"x":NaN}')
        with self.assertRaises(ValueError):p.read_json(f)

if __name__ == '__main__': unittest.main()
