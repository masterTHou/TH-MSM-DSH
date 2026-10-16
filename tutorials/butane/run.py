"""Small, reproducible four-site n-butane MD -> feature -> TH-MSM -> teaching artifacts.

This is an isolated OPLS-style united-atom teaching model, not an atomistic
force-field validation or an experimental kinetic prediction. No solvent, GPU,
metadynamics, reweighting, or artificial barrier lowering is used.
"""
import os
for _key in ("OPENMM_CPU_THREADS", "OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[_key] = "1"
import argparse
import hashlib
import json
import math
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import openmm as mm
from openmm import unit

R_KJ = 0.00831446261815324  # kJ mol^-1 K^-1
MASS_DA = [15.035, 14.027, 14.027, 15.035]
BOND_NM = 0.153
ANGLE_RAD = math.radians(112.4)
ANGLE_K = 126.0 * 4.184  # kJ mol^-1 rad^-2, E = k/2 * (theta-theta0)^2
V_KJ = np.array([1.411, -0.271, 3.145]) * 4.184
STATE_NAMES = ["trans", "gauche+", "gauche-"]
SOURCE = "https://www.rsc.org/suppdata/cp/b6/b601373b/b601373b.pdf"


def torsion_energy(phi):
    return 0.5 * (V_KJ[0] * (1 + np.cos(phi)) + V_KJ[1] * (1 - np.cos(2*phi)) + V_KJ[2] * (1 + np.cos(3*phi)))


def dihedral(x):
    """Periodic signed C1-C2-C3-C4 angle, radians, using projected vectors."""
    b = x[2] - x[1]
    b /= np.linalg.norm(b)
    v = x[0] - x[1]; v -= np.dot(v, b) * b
    w = x[3] - x[2]; w -= np.dot(w, b) * b
    return math.atan2(np.dot(np.cross(b, v), w), np.dot(v, w))


def coordinates(phi):
    x = np.zeros((4, 3))
    x[1] = [BOND_NM, 0, 0]
    x[2] = x[1] + BOND_NM * np.array([-math.cos(ANGLE_RAD), math.sin(ANGLE_RAD), 0])
    b = (x[2] - x[1]) / BOND_NM
    v = x[0] - x[1]; v -= np.dot(v, b) * b; v /= np.linalg.norm(v)
    x[3] = x[2] + BOND_NM * (-math.cos(ANGLE_RAD)*b + math.sin(ANGLE_RAD)*(math.cos(phi)*v + math.sin(phi)*np.cross(b, v)))
    return x


def state_of(phi):
    phi = (np.asarray(phi) + math.pi) % (2*math.pi) - math.pi
    return np.where(np.abs(phi) >= 2*math.pi/3, 0, np.where(phi >= 0, 1, 2)).astype(int)


def make_system():
    system = mm.System()
    for mass in MASS_DA:
        system.addParticle(mass)
    for i in range(3):
        system.addConstraint(i, i+1, BOND_NM)
    angles = mm.HarmonicAngleForce()
    for i in range(2):
        angles.addAngle(i, i+1, i+2, ANGLE_RAD, ANGLE_K)
    system.addForce(angles)
    torsions = mm.PeriodicTorsionForce()
    for n, phase, v in zip((1, 2, 3), (0.0, math.pi, 0.0), V_KJ):
        torsions.addTorsion(0, 1, 2, 3, n, phase, float(v/2))
    system.addForce(torsions)
    system.addForce(mm.CMMotionRemover(1))
    # All intramolecular pairs are <=3 bonds apart in this four-site chain.
    # The chosen local parameter convention excludes their nonbonded terms.
    return system


def platform_and_properties():
    try:
        return mm.Platform.getPlatformByName("CPU"), {"Threads": "1"}
    except Exception:
        return mm.Platform.getPlatformByName("Reference"), {}


def dump_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)+"\n", encoding="utf-8", newline="\n")


def xyz_text(frames, comment):
    return "".join("4\n"+comment+f"; frame={i}; angstrom; H implicit in CHx sites\n"+"".join(f"C {v[0]*10:.7f} {v[1]*10:.7f} {v[2]*10:.7f}\n" for v in x) for i, x in enumerate(frames))


def peak_memory_mib():
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes
        class Counters(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [(name, ctypes.c_size_t) for name in ("PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage", "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]
        c = Counters(); c.cb = ctypes.sizeof(c)
        kernel = ctypes.WinDLL("kernel32"); kernel.GetCurrentProcess.restype = wintypes.HANDLE
        psapi = ctypes.WinDLL("psapi")
        psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
        psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
        if psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(c), c.cb):
            return c.PeakWorkingSetSize / 2**20
        return None
    import resource
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return value / (2**20 if sys.platform == "darwin" else 1024)


def nve_check(system, positions, velocities, platform_, properties, dt_ps):
    integrator = mm.VerletIntegrator(dt_ps * unit.picosecond)
    context = mm.Context(system, integrator, platform_, properties)
    context.setPositions(positions); context.setVelocities(velocities)
    context.applyConstraints(1e-8); context.applyVelocityConstraints(1e-8)
    def energy():
        s = context.getState(getEnergy=True)
        return (s.getKineticEnergy()+s.getPotentialEnergy()).value_in_unit(unit.kilojoule_per_mole)
    start = energy(); drift = []
    for _ in range(20):
        integrator.step(round(0.1/dt_ps)); drift.append(energy()-start)
    del context, integrator
    return {"dt_fs": dt_ps*1000, "duration_ps": 2, "max_abs_energy_change_kj_mol": float(np.max(np.abs(drift)))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="output/butane-tutorial")
    parser.add_argument("--trajectories", type=int, default=12)
    parser.add_argument("--duration-ps", type=float, default=200)
    parser.add_argument("--equilibration-ps", type=float, default=20)
    parser.add_argument("--temperature-k", type=float, default=300)
    parser.add_argument("--dt-fs", type=float, default=2)
    parser.add_argument("--save-ps", type=float, default=0.1)
    parser.add_argument("--lag-ps", type=float, default=2)
    parser.add_argument("--seed", type=int, default=20261016)
    parser.add_argument("--max-wall-seconds", type=float, default=180)
    args = parser.parse_args()
    numeric = [args.duration_ps, args.equilibration_ps, args.temperature_k, args.dt_fs, args.save_ps, args.lag_ps]
    if not all(math.isfinite(x) and x > 0 for x in numeric):
        parser.error("All time/temperature parameters must be finite and positive")
    frames = round(args.duration_ps/args.save_ps)+1
    total_steps = args.trajectories*round((args.duration_ps+args.equilibration_ps)*1000/args.dt_fs)
    if not 4 <= args.trajectories <= 16 or args.duration_ps > 500 or args.equilibration_ps > 50 or not 250 <= args.temperature_k <= 400 or not 0.25 <= args.dt_fs <= 2 or frames * args.trajectories > 100000 or args.lag_ps*3 >= args.duration_ps or not 1 <= args.seed <= 2**30 or total_steps > 5000000 or not 10 <= args.max_wall_seconds <= 600:
        parser.error("Budget: 4–16 trajectories, <=500 ps each, <=100000 saved frames total, 250–400 K, dt 0.25–2 fs; 3*lag < duration")
    stride = round(args.save_ps/(args.dt_fs/1000))
    if stride < 1 or not math.isclose(stride*args.dt_fs/1000, args.save_ps) or not math.isclose((frames-1)*args.save_ps, args.duration_ps) or not math.isclose(round(args.lag_ps/args.save_ps)*args.save_ps,args.lag_ps):
        parser.error("save, duration and lag must align with the integration/saving grid")
    root = Path(__file__).resolve().parents[2]
    if not shutil.which("node") or not (root/"lib/msm/index.js").is_file():
        parser.error("Native Node >=22 and npm run build in the repository are required before MD")
    node_version = subprocess.run(["node", "--version"], check=True, capture_output=True, text=True, timeout=5).stdout.strip()
    if int(node_version.lstrip("v").split(".")[0]) < 22 or not (root/"lib/web/template.js").is_file():
        parser.error("Native Node >=22 and the generated web template are required; run npm run build")
    out = Path(args.output).resolve()
    if out.exists():
        parser.error("Output directory already exists. Use a fresh --output; nothing was overwritten.")
    out.mkdir(parents=True)
    started = time.perf_counter()
    settings = dict(vars(args)); settings.update({"model": "four-site OPLS-style isolated n-butane teaching model", "msm_lag_ps": args.lag_ps, "friction_ps_inverse": 5.0, "constraints_tolerance": 1e-8, "source": SOURCE, "bond_nm": BOND_NM, "angle_degrees": math.degrees(ANGLE_RAD), "angle_k_kj_mol_rad2": ANGLE_K, "torsion_V_kj_mol": V_KJ.tolist(), "mass_da": MASS_DA, "no_solvent": True, "not_experimental_kinetics": True})
    dump_json(out/"simulation.json", settings)
    system = make_system()
    (out/"system.xml").write_text(mm.XmlSerializer.serialize(system), encoding="utf-8")
    plat, properties = platform_and_properties()
    phis = np.empty((args.trajectories, frames)); energies = np.empty_like(phis)
    coords = np.empty((args.trajectories, frames, 4, 3), dtype=np.float32)
    grid = np.linspace(-math.pi, math.pi, 36000, endpoint=False)
    prob = np.exp(-torsion_energy(grid)/(R_KJ*args.temperature_k)); prob /= prob.sum()
    rng = np.random.default_rng(args.seed)
    seeds = [int(s) for s in rng.choice(2**30-1, size=args.trajectories, replace=False)+1]
    max_bond_error = 0.0
    for m, seed in enumerate(seeds):
        integrator = mm.LangevinMiddleIntegrator(args.temperature_k*unit.kelvin, 5/unit.picosecond, args.dt_fs*unit.femtosecond)
        integrator.setRandomNumberSeed(seed); integrator.setConstraintTolerance(1e-8)
        context = mm.Context(system, integrator, plat, properties)
        initial = coordinates(float(rng.choice(grid, p=prob)))
        context.setPositions(initial*unit.nanometer)
        mm.LocalEnergyMinimizer.minimize(context, 1.0, 100)
        context.setVelocitiesToTemperature(args.temperature_k*unit.kelvin, seed)
        context.applyVelocityConstraints(1e-8)
        integrator.step(round(args.equilibration_ps*1000/args.dt_fs))
        for f in range(frames):
            if f % 100 == 0 and time.perf_counter()-started > args.max_wall_seconds:
                raise RuntimeError("MD wall-time budget exceeded; refuse partial successful analysis")
            if f:
                integrator.step(stride)
            state = context.getState(getPositions=True, getEnergy=True)
            x = state.getPositions(asNumpy=True).value_in_unit(unit.nanometer)
            x -= np.average(x, axis=0, weights=MASS_DA)
            coords[m, f] = x; phis[m, f] = dihedral(x)
            energies[m, f] = state.getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole)
            max_bond_error = max(max_bond_error, float(np.max(np.abs(np.linalg.norm(np.diff(x,axis=0),axis=1)-BOND_NM))))
        if m == 0:
            final = context.getState(getPositions=True, getVelocities=True)
            nve = [nve_check(system, final.getPositions(), final.getVelocities(), plat, properties, dt) for dt in (0.002, 0.001)]
            (out/"integrator.xml").write_text(mm.XmlSerializer.serialize(integrator), encoding="utf-8")
        del context, integrator
        print(f"MD {m+1}/{args.trajectories}: {args.duration_ps:g} ps; wall={time.perf_counter()-started:.1f}s", flush=True)
    if not np.isfinite(phis).all() or not np.isfinite(energies).all() or max_bond_error > 1e-6:
        raise RuntimeError("Non-finite dynamics or bond constraint error: refuse MSM analysis")
    labels = state_of(phis)
    dump_json(out/"discrete-trajectories.json", {"kind": "classical-trajectories", "origin": "unbiased-md", "frame_time": args.save_ps, "time_unit": "ps", "trajectories": labels.tolist()})
    np.savez_compressed(out/"trajectory-data.npz", phi_rad=phis, potential_kj_mol=energies, coordinates_nm=coords, states=labels)
    (out/"initial-conformers.xyz").write_text(xyz_text([coordinates(x) for x in (math.pi, math.pi/3, -math.pi/3)], "trans, gauche+, gauche- ideal structures"), encoding="utf-8")
    (out/"trajectory-00.xyz").write_text(xyz_text(coords[0, ::10], "sampled MD; spacing="+str(args.save_ps*10)+" ps"), encoding="utf-8")
    md_wall = time.perf_counter()-started
    empirical = np.bincount(labels.ravel(),minlength=3)/labels.size
    expected = np.bincount(state_of(grid), weights=prob, minlength=3)
    block = [np.bincount(row,minlength=3)/len(row) for row in labels]
    manifest = {"schema_version": 1, "molecule": "n-butane", "representation": "four united-atom CHx sites", "temperature_k": args.temperature_k, "platform": plat.getName(), "threads": 1, "python": platform.python_version(), "openmm": mm.__version__, "numpy": np.__version__, "seed": args.seed, "trajectory_seeds": seeds, "n_trajectories": args.trajectories, "production_ps_per_trajectory": args.duration_ps, "equilibration_ps_per_trajectory": args.equilibration_ps, "saved_frames_per_trajectory": frames, "frame_time_ps": args.save_ps, "integration_steps": args.trajectories*round((args.duration_ps+args.equilibration_ps)*1000/args.dt_fs), "nve_diagnostics": nve, "max_bond_error_nm": max_bond_error, "empirical_populations_all_trajectories": empirical.tolist(), "theoretical_torsion_boltzmann_populations": expected.tolist(), "per_trajectory_populations": np.array(block).tolist(), "md_wall_seconds": md_wall, "python_peak_memory_mib": peak_memory_mib(), "total_es_calls": 0, "force_field_source": SOURCE, "limits": ["Local OPLS-style bonded subset; no solvent or explicit hydrogens", "Thermostat friction and coarse representation affect kinetics; not experimental butane rates", "MSM projection must be tested; passing is not proof of Markovianity", "No confidence intervals on stationary populations or MFPT", "Seeds do not guarantee bitwise reproducibility across OpenMM platforms/versions"]}
    manifest["input_sha256"] = hashlib.sha256((out/"discrete-trajectories.json").read_bytes()).hexdigest()
    manifest["production_equilibration_steps"] = manifest["integration_steps"]
    manifest["nve_integration_steps"] = 3000
    manifest["integration_steps"] += manifest["nve_integration_steps"]
    dump_json(out/"manifest.json", manifest)
    try:
        subprocess.run(["node", str(root/"tutorials/butane/build-model.mjs"), str(out)], check=True, cwd=root)
    except subprocess.CalledProcessError:
        dump_json(out/"FAILURE.json", {"stage": "msm", "message": "MSM fit failed; raw MD, cost and manifest retained. Check state coverage and lag; no successful result claimed."})
        raise
    from report import make_report
    make_report(out, settings, manifest, phis, coords, energies)
    before_peak = manifest["python_peak_memory_mib"]
    manifest["python_peak_memory_mib"] = peak_memory_mib()
    manifest["total_wall_seconds_through_plots"] = time.perf_counter()-started
    dump_json(out/"manifest.json", manifest)
    lesson = json.loads((out/"lesson.json").read_text(encoding="utf-8")); lesson["manifest"] = manifest
    dump_json(out/"lesson.json", lesson)
    report_path = out/"RESULTS.md"
    report_path.write_text(report_path.read_text(encoding="utf-8").replace(f"工作集 {before_peak} MiB", f"工作集 {manifest['python_peak_memory_mib']} MiB"),encoding="utf-8")
    with (out/"requirements-frozen.txt").open("w",encoding="utf-8") as frozen:
        subprocess.run([sys.executable, "-m", "pip", "freeze"], stdout=frozen, check=True)
    subprocess.run(["node", str(root/"tutorials/butane/export-view.mjs"), str(out)], check=True, cwd=root)
    print(json.dumps({"output":str(out), "md_wall_seconds":md_wall, "python_peak_memory_mib":manifest["python_peak_memory_mib"]},ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
