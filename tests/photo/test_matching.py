import importlib.util,json,sys,tempfile,unittest
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/photo'))
spec=importlib.util.spec_from_file_location('photo_matching',ROOT/'scripts/photo/match.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
import pipeline
class MatchingTest(unittest.TestCase):
 def test_real_correspondence_signal_and_blank_rejection_without_reconstruction_claim(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);images=p/'originals';images.mkdir()
   # Deterministic numeric texture fixture, never a photograph or distributed asset.
   rng=np.random.default_rng(91);im=Image.fromarray(rng.integers(0,255,(512,512),dtype='uint8'))
   im.save(images/'a.jpg');im.crop((25,15,487,477)).resize((512,512)).save(images/'b.jpg')
   Image.new('L',(512,512),120).save(images/'blank.jpg')
   pipeline.inventory(images,p/'inventory.json')
   report=m.screen(images,p/'inventory.json',p/'pairs.json')
   related=next(x for x in report['pairs'] if x['a']=='a.jpg' and x['b']=='b.jpg')
   self.assertTrue(related['projectiveOverlapIndication']);self.assertGreater(related['homographyInliers'],20)
   self.assertTrue(all(not x['projectiveOverlapIndication'] for x in report['pairs'] if x['b']=='blank.jpg'))
   self.assertFalse(report['readyForReconstruction']);self.assertEqual(len(report['candidateComponents']),2)
   with self.assertRaises(FileExistsError):m.screen(images,p/'inventory.json',p/'pairs.json')
   (images/'a.jpg').write_bytes(b'changed')
   with self.assertRaisesRegex(ValueError,'changed'):m.screen(images,p/'inventory.json',p/'second.json')
 def test_private_paths_and_oversized_batches_are_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);f=p/'inventory.json'
   f.write_text(json.dumps({'private':True,'files':[{'file':f'{i}.jpg'} for i in range(31)]}))
   with self.assertRaises(ValueError):m.screen(p,f,p/'report.json')
   with self.assertRaises(ValueError):m.screen(ROOT,f,p/'report.json')
