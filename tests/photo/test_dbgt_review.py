import importlib.util,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('audit_dbgt',ROOT/'scripts/geo/audit-dbgt-associations.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class ReviewTest(unittest.TestCase):
 def test_subdivision_and_absolute_elevation_do_not_become_a_new_uniform_height(self):
  a={'UN_VOL_POR':'01','UN_VOL_EX':'01','UN_VOL_AV':8,'UN_VOL_QE':440}
  hit={'heightBasis':'artistic-default','iou':.4,'sourceCovered':.99,'osmCovered':.4,'centroidMeters':5}
  self.assertEqual(audit.classification(a,[hit],False),'volume-part-of-larger-osm')
  self.assertEqual(audit.classification({**a,'UN_VOL_POR':'04'},[hit],False),'non-ground-portion')
  self.assertEqual(audit.classification(a,[hit,{**hit,'iou':.15}],False),'overlap-multiple-osm')
 def test_archived_sample_accounts_for_every_volume_without_changing_runtime_release(self):
  sector=ROOT/'public/geo/brembilla-centro';before=(sector/'dbgt-heights.json').read_bytes()
  raw=json.loads((ROOT/'docs/research/dbgt/centre-2019-retrieved-2026-10-16.json').read_text())
  manifest=json.loads((sector/'manifest.json').read_text());byid={}
  for t in manifest['tiles']:
   for b in json.loads((sector/t['url']).read_text())['buildings']:byid[b['id']]=b
  accepted={r['source']['dbgtObjectId'] for r in json.loads(before)['records']}
  r=audit.audit(raw,list(byid.values()),accepted)
  self.assertEqual(len(r['volumes']),475);self.assertEqual(len({v['dbgtObjectId'] for v in r['volumes']}),475)
  self.assertEqual(sum(r['classificationCounts'].values()),475)
  self.assertEqual(r['classificationCounts']['accepted-relative-height'],36)
  self.assertEqual(r['matchingUnionShapes'],14);self.assertEqual(r['uniformHeightCandidates'],0)
  self.assertEqual((sector/'dbgt-heights.json').read_bytes(),before)
