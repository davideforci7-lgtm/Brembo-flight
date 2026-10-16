import importlib.util,unittest
from pathlib import Path
p=Path(__file__).resolve().parents[2]/'scripts/geo/prepare-dbgt-heights.py'
spec=importlib.util.spec_from_file_location('dbgt',p);dbgt=importlib.util.module_from_spec(spec);spec.loader.exec_module(dbgt)
class DBGTTest(unittest.TestCase):
 def test_relative_height_is_not_absolute_extrusion(self):
  a={'UN_VOL_AV':10.74,'UN_VOL_EX':'01','UN_VOL_QE':419.2,'UN_VOL_POR':'01'}
  self.assertEqual(dbgt.relative_height(a),10.74)
  a['UN_VOL_EX']='02';self.assertEqual(dbgt.relative_height(a),10.74)
 def test_suspended_invalid_and_unreasonable_volumes_rejected(self):
  a={'UN_VOL_AV':10,'UN_VOL_EX':'01','UN_VOL_POR':'01'}
  for key,value in [('UN_VOL_POR','04'),('UN_VOL_POR','08'),('UN_VOL_AV',float('nan')),('UN_VOL_AV',400),('UN_VOL_EX','95')]:
   self.assertIsNone(dbgt.relative_height({**a,key:value}))
 def test_source_crs_and_truncation_are_required(self):
  for x in [{'spatialReference':{'wkid':32632}},{'spatialReference':{'wkid':7791},'exceededTransferLimit':True}]:
   with self.assertRaises(ValueError):dbgt.prepare(x,[])
