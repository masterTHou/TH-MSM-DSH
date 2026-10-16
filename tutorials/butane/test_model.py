"""Small physics tests; no long trajectory or package download in CI."""
import math
import unittest
import json
from pathlib import Path
import numpy as np
import openmm as mm
from openmm import unit
from run import coordinates, dihedral, make_system, state_of, torsion_energy, BOND_NM, ANGLE_RAD, peak_memory_mib

class ModelTests(unittest.TestCase):
    def test_process_memory_collector(self):
        peak=peak_memory_mib()
        self.assertIsNotNone(peak)
        self.assertGreater(peak,0)
    def test_published_preview_is_consistent_with_recorded_coordinates(self):
        path=Path(__file__).resolve().parents[2]/'examples/butane/lesson.json'
        if not path.exists():self.skipTest('publication data not present')
        lesson=json.loads(path.read_text(encoding='utf-8'))
        for x,angle,label in zip(lesson['preview']['coordinates_nm'],lesson['preview']['phi_degrees'],lesson['preview']['states']):
            phi=dihedral(np.array(x,dtype=float))
            error=math.atan2(math.sin(phi-math.radians(angle)),math.cos(phi-math.radians(angle)))
            self.assertLess(abs(error),1e-4)
            self.assertEqual(int(state_of(phi)),label)
    def test_geometry_periodicity_and_state_labels(self):
        for angle in [-math.pi, -2, -math.pi/3, 0, math.pi/3, 2, math.pi]:
            x=coordinates(angle)
            np.testing.assert_allclose(np.linalg.norm(np.diff(x,axis=0),axis=1),BOND_NM,atol=1e-12)
            self.assertAlmostEqual(math.cos(dihedral(x)),math.cos(angle),places=12)
            self.assertAlmostEqual(math.sin(dihedral(x)),math.sin(angle),places=12)
        self.assertEqual(state_of(np.array([math.pi,math.pi/3,-math.pi/3,math.pi+2*math.pi])).tolist(),[0,1,2,0])

    def test_openmm_energy_matches_declared_potential_and_force(self):
        integrator=mm.VerletIntegrator(.001)
        context=mm.Context(make_system(),integrator,mm.Platform.getPlatformByName('Reference'))
        for angle in [-2.4,-1.0,.3,1.7,math.pi]:
            x=coordinates(angle);context.setPositions(x)
            actual=context.getState(getEnergy=True).getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole)
            self.assertAlmostEqual(actual,float(torsion_energy(angle)),places=8)
        x=coordinates(1.7);context.setPositions(x)
        force=context.getState(getForces=True).getForces(asNumpy=True).value_in_unit(unit.kilojoule_per_mole/unit.nanometer)
        h=1e-6
        for atom,axis in [(0,2),(1,1),(3,0)]:
            plus=x.copy();minus=x.copy();plus[atom,axis]+=h;minus[atom,axis]-=h
            context.setPositions(plus);ep=context.getState(getEnergy=True).getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole)
            context.setPositions(minus);em=context.getState(getEnergy=True).getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole)
            self.assertAlmostEqual(force[atom,axis],-(ep-em)/(2*h),places=4)
        del context,integrator

if __name__=='__main__':unittest.main()
