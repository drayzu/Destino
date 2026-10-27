import * as THREE from 'three';
import { materia, materiaBuilder, type Nube } from '../engine/materia';
import { gauss, smoothstep } from '../engine/math';
import { tierra as tierraEnPuntos, type Vista } from '../horizontes';

/**
 * The Earth at night, lit by a civilization: Natural Earth land (world-atlas), real cities by their
 * size, the roads between neighbours, and (as power grows) the rest of the land and the sea lit
 * too. Local units are Earth radii; the group sits wherever the Earth is.
 *
 * The ground is the real Earth in points (src/horizontes, the series' shared bodies). Points on a sphere are hidden on its
 * far side by a horizon test (`uCamL`, the camera in local units), so nothing shows through the
 * planet; the dim photograph under the points hides the sky behind it.
 */

const D2R = Math.PI / 180;

/** Big metropolitan areas (lat, lon, millions of people, approximate). */
export const CIUDADES: [number, number, number][] = [
  [35.7, 139.7, 37], [28.6, 77.2, 32], [31.2, 121.5, 28], [23.8, 90.4, 22], [-23.5, -46.6, 22], [19.4, -99.1, 22],
  [30.0, 31.2, 21], [39.9, 116.4, 21], [19.1, 72.9, 21], [34.7, 135.5, 19], [29.6, 106.5, 17], [24.9, 67.0, 17],
  [-4.3, 15.3, 16], [6.5, 3.4, 15], [41.0, 29.0, 15], [-34.6, -58.4, 15], [22.6, 88.4, 15], [14.6, 121.0, 14],
  [23.1, 113.3, 14], [39.1, 117.2, 14], [31.5, 74.3, 13], [13.0, 77.6, 13], [-22.9, -43.2, 13], [22.5, 114.1, 13],
  [55.8, 37.6, 12.6], [13.1, 80.3, 11], [4.7, -74.1, 11], [48.9, 2.35, 11], [-6.2, 106.8, 11], [-12.0, -77.0, 11],
  [13.8, 100.5, 11], [17.4, 78.5, 10], [37.6, 127.0, 10], [35.2, 136.9, 9.5], [51.5, -0.1, 9.5], [30.7, 104.1, 9.5],
  [35.7, 51.4, 9.4], [-8.8, 13.2, 9], [30.6, 114.3, 8.7], [10.8, 106.7, 9], [40.7, -74.0, 19], [34.05, -118.2, 12.5],
  [41.9, -87.6, 8.9], [29.8, -95.4, 6], [32.8, -96.8, 6.5], [25.8, -80.2, 6], [33.7, -84.4, 5], [38.9, -77.0, 5],
  [40.0, -75.2, 5.7], [42.4, -71.1, 4.5], [37.8, -122.4, 4.7], [47.6, -122.3, 3.4], [43.7, -79.4, 6.2], [45.5, -73.6, 4],
  [40.4, -3.7, 6.7], [41.4, 2.2, 5.6], [41.9, 12.5, 4.3], [45.5, 9.2, 4.3], [52.5, 13.4, 4.5], [51.5, 7.2, 5],
  [52.4, 4.9, 2.5], [50.85, 4.35, 2], [48.1, 11.6, 2.6], [52.2, 21.0, 3], [59.9, 30.3, 5.4], [50.45, 30.5, 3],
  [37.98, 23.7, 3.6], [24.7, 46.7, 7.5], [33.3, 44.4, 7.5], [25.2, 55.3, 3.5], [-26.2, 28.0, 10], [-1.3, 36.8, 5],
  [9.0, 38.7, 5], [15.5, 32.5, 6], [5.3, -4.0, 5.5], [5.6, -0.2, 3], [-6.8, 39.3, 7], [33.6, -7.6, 4],
  [36.75, 3.05, 3], [-33.45, -70.65, 7], [10.5, -66.9, 3], [6.25, -75.6, 4], [-19.9, -43.9, 6], [-15.8, -47.9, 4.7],
  [20.7, -103.35, 5.3], [25.7, -100.3, 5], [-33.9, 151.2, 5.3], [-37.8, 144.96, 5], [1.35, 103.8, 6], [3.14, 101.7, 8.4],
  [25.0, 121.5, 7], [22.3, 114.2, 7.5], [39.0, 125.75, 3], [21.0, 105.85, 8], [16.85, 96.2, 5.6], [23.0, 72.6, 8.5],
  [18.5, 73.9, 7], [21.2, 72.8, 7], [34.5, 69.2, 4.5], [41.3, 69.3, 2.5], [43.2, 76.9, 2], [55.0, 82.9, 1.6],
  [56.8, 60.6, 1.5], [-31.95, 115.86, 2.1], [-36.85, 174.76, 1.7], [53.5, -2.2, 2.8], [45.76, 4.84, 2.3], [43.3, 5.4, 1.9],
  [38.7, -9.1, 2.9], [47.5, 19.05, 1.8], [44.4, 26.1, 1.8], [50.1, 14.4, 1.3], [48.2, 16.4, 1.9], [59.3, 18.1, 1.6],
  [55.7, 12.6, 1.4], [60.2, 24.9, 1.3], [53.35, -6.26, 1.4], [32.1, 34.8, 4], [31.95, 35.9, 2.5], [33.5, 36.3, 2.6],
  [36.2, 37.15, 2], [39.9, 32.85, 5.7], [38.4, 27.1, 3], [26.9, 80.9, 3.8], [25.6, 85.1, 2.5], [26.85, 75.8, 4],
  [21.15, 79.1, 3], [12.97, 79.15, 1], [9.93, 76.27, 2.2], [27.7, 85.3, 3], [33.7, 73.05, 2.5], [24.86, 46.7, 1],
  [21.5, 39.2, 4.7], [29.4, 47.98, 3], [36.2, 120.4, 6], [32.05, 118.8, 9], [30.25, 120.15, 8], [34.3, 108.95, 8],
  [36.65, 117.0, 6], [41.8, 123.4, 7], [45.75, 126.65, 6], [43.9, 125.3, 4.5], [28.2, 112.95, 6], [26.05, 119.3, 4],
  [24.48, 118.1, 4], [22.8, 108.3, 4], [25.05, 102.7, 4.5], [38.05, 114.5, 5], [34.75, 113.65, 7], [33.6, 130.4, 5.5],
  [43.06, 141.35, 2.6], [35.1, 129.0, 3.4], [35.87, 128.6, 2.4], [10.3, 123.9, 2.8], [7.1, 125.6, 1.8], [-7.25, 112.75, 3],
  [-6.9, 107.6, 2.6], [3.6, 98.7, 2.3], [-27.5, 153.0, 2.5], [-34.9, 138.6, 1.3], [-25.75, 28.2, 2.6], [-29.85, 31.0, 3.5],
  [-33.9, 18.4, 4.6], [12.0, 8.5, 4], [9.05, 7.5, 3.5], [11.6, 43.15, 1], [2.05, 45.3, 2.5], [0.35, 32.6, 3.5],
  [-1.95, 30.06, 1.2], [14.7, -17.45, 3.2], [12.65, -8.0, 2.8], [-15.4, 28.3, 2.9], [-17.8, 31.05, 2.1], [-25.95, 32.6, 1.8],
  [-18.9, 47.5, 3.5], [-3.1, -60.0, 2.3], [-1.45, -48.5, 2.3], [-3.7, -38.5, 4], [-8.05, -34.9, 4], [-12.97, -38.5, 4],
  [-25.4, -49.3, 3.5], [-30.0, -51.2, 4.3], [-31.4, -64.2, 1.6], [-32.95, -60.65, 1.4], [-34.9, -56.2, 1.8], [-25.3, -57.6, 2.5],
  [-16.5, -68.15, 2], [-17.8, -63.2, 1.8], [-0.2, -78.5, 2.8], [-2.2, -79.9, 3], [3.45, -76.5, 2.8], [10.97, -74.8, 2.3],
  [9.0, -79.5, 2], [9.93, -84.08, 1.4], [14.6, -90.5, 3], [13.7, -89.2, 1.1], [18.5, -69.9, 3.5], [23.1, -82.4, 2.1],
  [18.0, -76.8, 1.2], [19.0, -98.2, 3.2], [21.0, -89.6, 1.3], [32.5, -117.0, 3.3], [33.45, -112.07, 5], [36.17, -115.14, 2.3],
  [39.74, -104.99, 3], [44.98, -93.27, 3.7], [39.1, -94.6, 2.2], [38.63, -90.2, 2.8], [29.95, -90.07, 1.3], [36.16, -86.78, 2],
  [35.23, -80.84, 2.7], [27.95, -82.46, 3.2], [28.54, -81.38, 2.7], [39.96, -83.0, 2.1], [42.33, -83.05, 4.4], [41.5, -81.7, 2.1],
  [40.44, -80.0, 2.4], [39.29, -76.61, 2.8], [45.52, -122.68, 2.5], [49.28, -123.12, 2.6], [51.05, -114.07, 1.5], [53.55, -113.49, 1.4],
  [30.27, -97.74, 2.3], [29.42, -98.49, 2.6], [32.72, -117.16, 3.3], [38.58, -121.49, 2.4], [21.31, -157.86, 1],
];

/**
 * When a place lit up (the order its lights come on, 0..0.24, before today's 0.36): first western
 * Europe and the north-east of the United States, then the rest of Europe and North America, Japan,
 * Latin America, the Middle East, East and South Asia, and Africa last. A rough map of
 * industrialization, so «two hundred years of lights» spread the way they did.
 */
export function ordenHistorico(la: number, lo: number) {
  const en = (a0: number, a1: number, o0: number, o1: number) => la >= a0 && la <= a1 && lo >= o0 && lo <= o1;
  if (en(36, 60, -10, 30)) return 0.0;
  if (en(35, 48, -95, -68)) return 0.02;
  if (en(40, 66, 30, 60)) return 0.06;
  if (en(25, 60, -130, -55)) return 0.07;
  if (en(30, 46, 128, 146)) return 0.08;
  if (en(-48, -10, 110, 180)) return 0.1;
  if (en(-56, 33, -120, -30)) return 0.13;
  if (en(12, 42, -18, 62)) return 0.15;
  if (en(18, 55, 100, 135)) return 0.17;
  if (en(-12, 35, 60, 125)) return 0.19;
  if (en(-36, 15, -20, 55)) return 0.21;
  return 0.15;
}

/** Land of the world, as a function. Loaded once. */
let tierraLista: Promise<(la: number, lo: number) => number> | null = null;
export function mascaraTierra() {
  if (tierraLista) return tierraLista;
  tierraLista = (async () => {
    const [topo, { feature }] = await Promise.all([import('world-atlas/land-50m.json'), import('topojson-client')]);
    const t = (topo as { default: unknown }).default as Parameters<typeof feature>[0];
    const land = feature(t, (t as unknown as { objects: { land: Parameters<typeof feature>[1] } }).objects.land) as unknown as GeoJSON.FeatureCollection | GeoJSON.Feature;
    const MW = 2048;
    const MH = 1024;
    const c = document.createElement('canvas');
    c.width = MW;
    c.height = MH;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.fillStyle = '#000';
    x.fillRect(0, 0, MW, MH);
    x.fillStyle = '#fff';
    const feats = 'features' in land ? land.features : [land];
    for (const ft of feats) {
      const geo = ft.geometry;
      const polys = geo.type === 'MultiPolygon' ? geo.coordinates : geo.type === 'Polygon' ? [geo.coordinates] : [];
      for (const poly of polys) {
        x.beginPath();
        for (const ring of poly) {
          ring.forEach(([lo, la], i) => {
            const px = ((lo + 180) / 360) * MW;
            const py = ((90 - la) / 180) * MH;
            if (i === 0) x.moveTo(px, py);
            else x.lineTo(px, py);
          });
          x.closePath();
        }
        x.fill('evenodd');
      }
    }
    const mask = x.getImageData(0, 0, MW, MH).data;
    return (la: number, lo: number) => {
      const px = Math.min(MW - 1, Math.max(0, Math.floor(((lo + 180) / 360) * MW)));
      const py = Math.min(MH - 1, Math.max(0, Math.floor(((90 - la) / 180) * MH)));
      return mask[(py * MW + px) * 4] / 255;
    };
  })();
  return tierraLista;
}

/** Latitude/longitude (degrees) to a point on the unit sphere (y to the north pole, lon 0 at +x). */
export function esfera(la: number, lo: number, r = 1): [number, number, number] {
  const a = la * D2R;
  const o = lo * D2R;
  return [Math.cos(a) * Math.cos(o) * r, Math.sin(a) * r, -Math.cos(a) * Math.sin(o) * r];
}

export const SPHERE_PRE = /* glsl */ `uniform vec3 uSun, uCamL;`;
/** Hidden behind its own sphere: a point is seen only above its local horizon. */
export const HORIZONTE = /* glsl */ `if (dot(normalize(p), uCamL - p) < 0.0) { em *= 0.0; occ *= 0.0; }`;

export interface Tierra {
  group: THREE.Group;
  /** The civilization's lights. */
  nubes: Nube[];
  /** Resolves once the land, the maps, the ground and the lights are built. */
  listo: Promise<void>;
  /** Per frame: the Sun's direction and the camera, both in the Earth's local frame; how lit the planet is (0..1). */
  update(sunL: THREE.Vector3, camL: THREE.Vector3, lights: number, vista: Vista): void;
}

/** A map in public/texturas (Solar System Scope, CC BY 4.0), wherever the site is served from. */
export const textura = (nombre: string) => `${import.meta.env.BASE_URL}texturas/${nombre}`;

export function tierra(): Tierra {
  const group = new THREE.Group();
  const nubes: Nube[] = [];
  const uni = { uSun: { value: new THREE.Vector3(1, 0, 0) }, uCamL: { value: new THREE.Vector3(0, 0, 5) }, uLights: { value: 1 }, uNuevas: { value: 0 }, uMentes: { value: 0 } };

  // The ground and the clouds: the real Earth in points, its air at the limb, the Sun's glint on
  // the sea. The civilization's lights are points above it.
  const suelo = tierraEnPuntos(textura(''));
  group.add(suelo.group);

  const luces = (async () => {
    const isLand = await mascaraTierra();

    // City lights: real cities by size, roads between neighbours, towns where people live; then
    // (aOrder > 0.5) the rest of the land and lights on the sea as the planet fills up.
    const lb = materiaBuilder(12);
    const ord: number[] = [];
    const warm = [new THREE.Color(1.0, 0.72, 0.4), new THREE.Color(1.0, 0.86, 0.62), new THREE.Color(0.95, 0.95, 0.9)];
    const teal = new THREE.Color(0.55, 1.0, 0.85);
    const put = (la: number, lo: number, c: THREE.Color, s: number, light: number, o: number) => {
      const [x, y, z] = esfera(la, lo, 1.0015);
      lb.push(x, y, z, c, s, light);
      ord.push(o);
    };
    for (const [la, lo, pop] of CIUDADES) {
      // A core and its suburbs: a few sub-centres around it, each a dense knot that thins out.
      const n = Math.round(140 + pop * 110);
      const rad = 0.16 + 0.11 * Math.sqrt(pop);
      const subs = Array.from({ length: 3 + Math.round(pop / 4) }, () => [gauss(lb.r) * rad * 0.8, gauss(lb.r) * rad * 0.8]);
      for (let k = 0; k < n; k++) {
        const [sa, so] = k % 3 === 0 ? [0, 0] : subs[k % subs.length];
        const rr = rad * (k % 3 === 0 ? 0.7 : 0.4) * Math.pow(lb.r(), 1.4);
        const a = lb.r() * Math.PI * 2;
        const cla = la + sa + Math.sin(a) * rr;
        const clo = lo + (so + Math.cos(a) * rr) / Math.max(0.2, Math.cos(la * D2R));
        if (isLand(cla, clo) < 0.5 && lb.r() < 0.85) continue;
        const centro = 1 - Math.min(1, Math.hypot(cla - la, (clo - lo) * Math.cos(la * D2R)) / rad);
        put(cla, clo, warm[k % 3], 0.0008 + 0.0006 * centro, 0.35 + 0.75 * centro, ordenHistorico(la, lo) + lb.r() * 0.06 * (1.2 - centro));
      }
    }
    // Roads: dotted lines between cities closer than ~12°.
    for (let i = 0; i < CIUDADES.length; i++) {
      for (let j = i + 1; j < CIUDADES.length; j++) {
        const [a1, o1] = CIUDADES[i];
        const [a2, o2] = CIUDADES[j];
        const d = Math.hypot(a1 - a2, (o1 - o2) * Math.cos(((a1 + a2) / 2) * D2R));
        if (d > 11 || d < 1) continue;
        const n = Math.round(d * 9);
        for (let k = 0; k < n; k++) {
          const t = k / n;
          const la = a1 + (a2 - a1) * t + gauss(lb.r) * 0.08;
          const lo = o1 + (o2 - o1) * t + gauss(lb.r) * 0.08;
          if (isLand(la, lo) < 0.5) continue;
          put(la, lo, warm[0], 0.0007, 0.35, ordenHistorico(la, lo) + 0.03 + lb.r() * 0.05);
        }
      }
    }
    // Towns, denser in the temperate north and near coasts; then the land filling up, then the sea.
    for (let k = 0; k < 110000; k++) {
      const u = lb.r() * 2 - 1;
      const la = Math.asin(u) / D2R;
      const lo = lb.r() * 360 - 180;
      const L = isLand(la, lo) > 0.5;
      const al = Math.abs(la);
      if (L) {
        if (la < -60) continue;
        const temperate = la > 0 ? smoothstep(5, 25, la) * (1 - smoothstep(58, 68, la)) : smoothstep(-5, -20, la) * (1 - smoothstep(-42, -50, la));
        const today = lb.r() < 0.18 * (0.25 + temperate);
        const o = today ? ordenHistorico(la, lo) + 0.02 + lb.r() * 0.08 : 0.42 + lb.r() * 0.3 + 0.1 * smoothstep(55, 75, al);
        put(la, lo, today ? warm[lb.r() < 0.5 ? 0 : 1] : teal.clone().lerp(warm[2], lb.r() * 0.6), 0.0008, today ? 0.45 : 0.4, o);
      } else if (lb.r() < 0.12) {
        put(la, lo, teal, 0.0008, 0.35, 0.75 + lb.r() * 0.24);
      }
    }
    const lights = materia(lb.data(), {
      pre: `${SPHERE_PRE}\nuniform float uLights, uNuevas, uMentes;\nattribute float aOrder;`,
      move: /* glsl */ `
        float d = dot(normalize(p), uSun);
        float on = smoothstep(aOrder, aOrder + 0.04, uLights);
        // The lights added after today can keep their light below a pixel, so a filling land reads from afar.
        if (aOrder > 0.4) fuente = uNuevas;
        em *= on * (1.0 - smoothstep(-0.1, 0.12, d));
        // (act I) Where we are, as minds rather than lamps: the civilization's colour.
        em = mix(em, vec3(0.45, 1.0, 0.85) * dot(em, vec3(0.4)) * 1.3, uMentes);
        // Seen through more air near the limb, the lights fade.
        em *= smoothstep(0.0, 0.3, dot(normalize(p), normalize(uCamL - p)));
        ${HORIZONTE}`,
      uniforms: uni,
      extra: { aOrder: [new Float32Array(ord), 1] },
    });
    group.add(lights.points);
    nubes.push(lights);
  })();

  return {
    group,
    nubes,
    listo: Promise.all([suelo.listo, luces]).then(() => undefined),
    update(sunL, camL, lit, vista) {
      suelo.update({ sol: sunL, camara: camL, focal: vista.focal, dpr: vista.dpr });
      uni.uSun.value.copy(sunL);
      uni.uCamL.value.copy(camL);
      uni.uLights.value = lit;
    },
  };
}
