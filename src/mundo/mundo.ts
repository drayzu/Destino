import * as THREE from 'three';
import { enfocar, type Nube } from '../engine/materia';
import { smoothstep } from '../engine/math';
import { cielo } from './cielo';
import { galaxia, CENTRO } from './galaxia';
import { tierra } from './tierra';
import { MOON_D, R_E, R_SUN, ascensorDir, cercanias, faros, luna, sol } from './obras';
import type { Vista } from '../engine/vista';

/**
 * The one world every act shares, built once: the galaxy, the Sun, the Earth with its cities, its
 * works and the Moon. Acts add what only they need and set the world's state each frame (how lit the
 * Earth is, how it is turned, which works are up); the world keeps everything running whatever the
 * camera looks at.
 *
 * World units: astronomical units (AU), the Sun at the origin, the ecliptic and the galactic disk in
 * the XZ plane (the galactic centre 26 000 light years along −Z). Each body is a group in its own
 * units (Earth radii, light years), so nothing small sits on a big number; the camera's pivot
 * (engine/vista.ts) keeps the whole range exact.
 */

export const LY_AU = 63241.077;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;

/** Where the Earth is (AU). */
export const E = V(Math.cos(1.25), 0, Math.sin(1.25));
/** From the Earth towards the Sun (world). */
export const SOL_DESDE_E = E.clone().negate().normalize();
/**
 * From the Earth towards a camera that sees its night side with the Sun just behind the right limb
 * (a thin crescent of day at the edge): the view of «Hoy».
 */
/** Where the Moon is, seen from the Earth (world), and the Moon itself (AU). */
export const LUNA_DIR = SOL_DESDE_E.clone().applyAxisAngle(V(0, 1, 0), 2.2).add(V(0, 0.08, 0)).normalize();
export const LUNA = E.clone().addScaledVector(LUNA_DIR, MOON_D * R_E);
export const NOCHE = SOL_DESDE_E.clone().multiplyScalar(-0.77).addScaledVector(SOL_DESDE_E.clone().cross(V(0, 1, 0)).normalize(), 0.64).normalize();

/**
 * The view of the Earth's night side: `d` Earth radii away, turned by `rot` (radians) about the
 * vertical, looking a little below the centre. `deriva(p)` is the slow turn that runs through the
 * acts that look at it, so they hand the camera over without a seam.
 */
export function noche(d: number, rot: number, fov = 38): Vista {
  const target = E.clone().add(V(0, -0.04 * R_E, 0));
  return { pos: target.clone().addScaledVector(NOCHE.clone().applyAxisAngle(V(0, 1, 0), rot), d * R_E), target, up: V(0, 1, 0), fov };
}
export const deriva = (p: number) => -0.34 + 0.012 * p;

/** The state the acts set each frame (defaults are restored before every frame). */
export interface Estado {
  /** The Earth's lights (0: none, 0.36: today, 0.62: the land filling, 1: the sea too). */
  luces: number;
  /** Lights added after today keep some light below a pixel (0..1). */
  nuevas: number;
  /** The Earth's turn about its axis (radians). */
  giro: number;
  /** The ring, the elevator and their lights (0..1). */
  cercanias: number;
  /** The Moon and its base (0..1). */
  luna: number;
  /** The galaxy's stars and light (0..1), and how bright the sky at infinity is. */
  galaxia: number;
  cielo: number;
  /** The Sun dimmed (0..1) by whatever surrounds it. */
  solDim: number;
  /**
   * Another planet that hides what is behind it (centre in AU, radius in AU), and its own points,
   * which keep their own horizon. When it looks bigger than the Earth, it takes the Earth's place.
   */
  oclusor: { c: THREE.Vector3; r: number; propias: Nube[] } | null;
  /** The observer's speed (fraction of c) and direction (world): the sky and every point aberrate. */
  beta: number;
  vel: THREE.Vector3;
  /** The Sun's and the Earth's beacons (0..1). */
  faros: number;
  /** The Earth and its works are there (0: taken apart, later in the journey). */
  tierra: number;
  /** The Sun is there (0: gone out, at the end). */
  sol: number;
  /** (act I) The Earth's lights read as minds, in the civilization's colour (0..1). */
  mentes: number;
}

const DEFECTO: Estado = { luces: 0.36, nuevas: 0, giro: 0, cercanias: 0, luna: 1, galaxia: 1, cielo: 0.8, solDim: 0.55, oclusor: null, beta: 0, vel: new THREE.Vector3(0, 0, -1), faros: 1, tierra: 1, sol: 1, mentes: 0 };

export type Mundo = ReturnType<typeof crearMundo>;

export function crearMundo(scene: THREE.Scene) {
  const root = new THREE.Group();
  scene.add(root);
  const nubes: Nube[] = [];

  // ------------------------------------------------------------ the sky and the galaxy
  const sky = cielo(0.8);
  sky.u.uBanda.value = 0;
  scene.add(sky.mesh);
  // The galaxy in light years (a group scaled to AU); its local stars crowd around the Sun.
  const gal = new THREE.Group();
  gal.scale.setScalar(LY_AU);
  root.add(gal);
  const G = galaxia([V(2600, 360, 7500), V(0, 0, 0)]);
  gal.add(G.nube.points);
  scene.add(G.luz.mesh);
  nubes.push(G.nube);

  // ------------------------------------------------------------ the Sun
  const sun = sol();
  sun.group.scale.setScalar(R_SUN);
  root.add(sun.group);

  // ------------------------------------------------------------ the Earth, its works, the Moon
  const earthSys = new THREE.Group();
  earthSys.position.copy(E);
  earthSys.scale.setScalar(R_E);
  root.add(earthSys);
  const body = new THREE.Group();
  earthSys.add(body);
  const earth = tierra();
  body.add(earth.group);
  const near = cercanias();
  body.add(near.group);
  nubes.push(...near.nubes);
  // The ground and the lights arrive with their maps: only then they join the clouds kept in focus.
  const listoTierra = earth.listo.then(() => void nubes.push(...earth.nubes));
  const tilt = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 23.44 * D2R);
  const giroQ = (phi: number, out = new THREE.Quaternion()) => out.copy(tilt).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), phi));

  const moon = luna(LUNA_DIR.clone().negate());
  moon.group.position.copy(LUNA_DIR).multiplyScalar(MOON_D);
  earthSys.add(moon.group);
  const listoLuna = moon.listo.then(() => void nubes.push(...moon.nubes));

  // Beacons: what is too small to see still shows as a light.
  const B = faros([
    { color: new THREE.Color(1.0, 0.9, 0.6), px: 2.6 }, // 0 the Sun
    { color: new THREE.Color(0.5, 0.75, 1.0), px: 1.8 }, // 1 the Earth
  ]);
  root.add(B.points);

  /**
   * The turn that brings a place on Earth (lat, lon) to face a world direction (as close as the
   * axial tilt allows). Acts use it to choose what side of the planet the camera sees.
   */
  function giroPara(la: number, lo: number, dirW: THREE.Vector3) {
    const [x, y, z] = [Math.cos(la * D2R) * Math.cos(lo * D2R), Math.sin(la * D2R), -Math.cos(la * D2R) * Math.sin(lo * D2R)];
    const local = V(x, y, z);
    const q = new THREE.Quaternion();
    let best = 0;
    let bestD = -2;
    for (let k = 0; k < 1440; k++) {
      const phi = (k / 1440) * Math.PI * 2;
      const d = local.clone().applyQuaternion(giroQ(phi, q)).dot(dirW);
      if (d > bestD) {
        bestD = d;
        best = phi;
      }
    }
    return best;
  }

  /** The turn that shows the night over Europe, Africa and Asia from NOCHE (the default). */
  const giroNoche = giroPara(24, 38, NOCHE);
  /** The turn that puts the space elevator just past dusk, on the side the camera comes from. */
  const giroAscensor = (() => {
    const up0 = ascensorDir();
    let best = 0;
    let bestErr = 9;
    const qq = new THREE.Quaternion();
    for (let k = 0; k < 1440; k++) {
      const phi = (k / 1440) * Math.PI * 2;
      const u = up0.clone().applyQuaternion(giroQ(phi, qq));
      const side = u.clone().cross(SOL_DESDE_E).y;
      const err = Math.abs(u.dot(SOL_DESDE_E) + 0.18) + (side > 0 ? 0 : 1);
      if (err < bestErr) {
        bestErr = err;
        best = phi;
      }
    }
    return best;
  })();
  const defecto: Estado = { ...DEFECTO, giro: giroNoche };
  const estado: Estado = { ...defecto };
  const tmp = V();
  const q = new THREE.Quaternion();

  return {
    root,
    nubes,
    /** Resolves once the Sun, the Earth and the Moon are built. */
    listo: Promise.all([listoTierra, listoLuna, sun.listo]),
    estado,
    G,
    gal,
    sky,
    sun,
    earth,
    earthSys,
    body,
    near,
    moon,
    giroPara,
    giroNoche,
    giroAscensor,
    /** The Earth body's orientation for a turn `phi`. */
    giroQ,
    /** Back to the defaults (before the acts set this frame's state). */
    reset() {
      Object.assign(estado, defecto);
    },
    /** A point in the Earth's body frame (Earth radii) to the world (AU), with the current turn. */
    tierraAMundo(local: THREE.Vector3, out = V()) {
      return out.copy(local).applyQuaternion(giroQ(estado.giro, q)).multiplyScalar(R_E).add(E);
    },
    /** The elevator's direction in the Earth's body frame. */
    ascensor: ascensorDir(),
    /** Per frame, after the camera is placed: keeps everything running. `k`: scene units per AU. */
    update(camera: THREE.PerspectiveCamera, camW: THREE.Vector3, k: number, time: number, focal: number, dpr: number) {
      // The galaxy: its stars' flux by distance, its light by where we are in it.
      G.update(k * LY_AU, tmp.copy(camW).divideScalar(LY_AU));
      const camLy = tmp.clone();
      const rel = camLy.clone().sub(CENTRO);
      const inDisk = (1 - smoothstep(1500, 9000, Math.abs(rel.y))) * (1 - smoothstep(45000, 70000, Math.hypot(rel.x, rel.z)));
      const inSolar = smoothstep(Math.log(5), Math.log(0.002), Math.log(camLy.length() + 1e-12));
      G.luz.u.uLight.value = (1.4 + (0.55 - 1.4) * inDisk) * (1 - 0.4 * inSolar) * estado.galaxia;
      G.nube.u.uGain.value = estado.galaxia;
      // Inside the disk its stars come from every side (dimmer per pixel than from outside).
      G.nube.u.uFlux.value = 1 + 2 * inDisk;
      G.nube.u.uNear.value = 600;
      G.nube.u.uFloor.value = 0.05;
      sky.u.uBrillo.value = estado.cielo * inDisk;
      sky.u.uBeta.value = estado.beta;
      sky.u.uVelW.value.copy(estado.vel).normalize();
      const velV = estado.vel.clone().normalize().transformDirection(camera.matrixWorldInverse);

      // The Sun.
      sun.update(camera, time, estado.solDim, camW, { focal, dpr });
      sun.group.visible = estado.sol > 0.001;
      // Light years away the Earth and its works are inside the Sun's pixel: their lights (which keep
      // their brightness below a pixel) would only blur it.
      const cerca = camW.length() < 5000;
      earthSys.visible = cerca && estado.tierra > 0;

      // The Earth: turned, lit from the Sun, its lights as the acts say.
      body.quaternion.copy(giroQ(estado.giro, q));
      root.updateMatrixWorld(true);
      const sunL = SOL_DESDE_E.clone().applyQuaternion(q.clone().invert());
      const camL = body.worldToLocal(V(0, 0, 0));
      earth.update(sunL, camL, estado.luces, { focal, dpr });
      for (const n of earth.nubes) if (n.u.uNuevas) n.u.uNuevas.value = estado.nuevas;
      for (const n of earth.nubes) if (n.u.uMentes) n.u.uMentes.value = estado.mentes;
      near.uni.uSun.value.copy(sunL);
      near.uni.uCamL.value.copy(camL);
      near.uni.uTime.value = time;
      for (const n of near.nubes) n.u.uGain.value = estado.cercanias;
      near.group.visible = estado.cercanias > 0.001;
      moon.group.visible = cerca && estado.luna > 0.001;
      if (moon.group.visible) moon.update(SOL_DESDE_E, estado.luna, { focal, dpr });

      // Beacons, while the bodies are smaller than a few pixels.
      const px = (c: THREE.Vector3, r: number) => (r / Math.max(c.distanceTo(camW), 1e-300)) * focal;
      B.set(0, V(), (1 - smoothstep(2, 8, px(V(), R_SUN))) * estado.faros);
      B.set(1, E, (1 - smoothstep(2, 6, px(E, R_E))) * estado.faros);
      B.commit();
      B.mat.uniforms.uDpr.value = dpr;

      // The Earth hides the stars (and anything far) behind it; its own lights and works have their own horizon.
      // Or another planet, when it looks bigger.
      const oc = estado.oclusor;
      const otro = oc !== null && oc.r / Math.max(oc.c.distanceTo(camW), 1e-300) > R_E / Math.max(E.distanceTo(camW), 1e-300);
      const own = new Set<Nube>(otro ? oc.propias : [...earth.nubes, ...near.nubes]);
      const ec = otro ? oc.c.clone().sub(camW).multiplyScalar(k).applyMatrix4(camera.matrixWorldInverse) : earthSys.getWorldPosition(V()).applyMatrix4(camera.matrixWorldInverse);
      const er = k * (otro ? oc.r : R_E) * 0.995;
      for (const n of nubes) {
        if (own.has(n)) n.u.uOcc.value.set(0, 0, 0, 0);
        else n.u.uOcc.value.set(ec.x, ec.y, ec.z, er);
        enfocar(n, focal, dpr, time);
        n.u.uBeta.value = estado.beta;
        n.u.uVelV.value.copy(velV);
        n.u.uSizeUnit.value = n.points.getWorldScale(tmp).x;
        n.u.uMinPx.value = 1.3 * dpr;
      }
      G.nube.u.uMaxPx.value = 6 * dpr;
      for (const n of earth.nubes) {
        n.u.uMinPx.value = 1.4 * dpr;
        // The towns are smaller than a pixel from orbit: they keep a little light, so the land fills.
        n.u.uFuente.value = 0.08;
      }
    },
  };
}
