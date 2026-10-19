import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('landcover', ROOT / 'scripts/geo/prepare-landcover.py')
landcover = importlib.util.module_from_spec(spec)
spec.loader.exec_module(landcover)


class LandcoverTest(unittest.TestCase):
    def test_north_is_top_and_holes_preserve_the_underlying_coverage(self):
        areas = [
            {'id': 'town', 'kind': 'residential', 'points': [[-5,-5],[5,-5],[5,5],[-5,5]]},
            {'id': 'forest', 'kind': 'forest', 'points': [[-4,-4],[4,-4],[4,0],[-4,0]],
             'holes': [[[-2,-3],[2,-3],[2,-1],[-2,-1]]]},
        ]
        grid = landcover.coverage(areas, 10, size=10)
        self.assertEqual(grid[1,1], 1)
        self.assertEqual(grid[2,4], 3)
        self.assertEqual(grid[7,1], 3)
        self.assertTrue((grid == landcover.coverage(list(reversed(areas)), 10, size=10)).all())

    def test_unmapped_land_is_not_claimed_as_forest_or_urban(self):
        areas = [{'id': 'patch', 'kind': 'grass', 'points': [[-5,-5],[0,-5],[0,0],[-5,0]]}]
        grid = landcover.coverage(areas, 10, size=10)
        self.assertEqual(grid[0,0], 2)
        self.assertEqual(grid[-1,-1], 0)
