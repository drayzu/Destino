import * as THREE from 'three';
import { Timeline } from '../timeline';
import { cielo } from '../cielo';
import { tierra } from '../tierra';
import { faros, sol } from '../obras';
import { enfocar } from '../materia';
import { clamp, lerp, smoothstep } from '../math';
import { FONT, TEAL, cifra, ink, nota } from '../placa';
import { linea, pr, texto, type P2 } from './lamina';
import { CENTRO, esferaLamina, galaxia } from './galaxia';
import type { Escena, Frame, Instancia } from './tipos';

/**
 * Study · the opening: «¿Hay alguien más?». The galaxy, old and full of planets, and the silence;
 * then down to us. Three ways:
 * 1 · Inside: first person through the disk; the planets show up around the stars we pass, the
 *     bubble that should exist sweeps over us and is not there; then a yellow star, a blue planet.
 * 2 · Outside: the whole galaxy; what we have seen against what there must be, the ages on a bar of
 *     13 000 million years, one civilization filling it in 650 000 years; then the dive.
 * 3 · Listening: from the Sun out: our own voice (a bubble of radio ~100 ly) against a galaxy of
 *     100 000 ly; how little we have listened; then back down.
 *
 * The clock has no civilization to measure yet: it reads the power that is there and nobody uses
 * (the galaxy, ~10³⁷ W), and on the dive it falls with what is in view (a star, the light on a planet)
 * until it reaches ours, 10¹³ W, where the ladder starts to fill.
 *
 * Figures: 6 451 confirmed planets (NASA Exoplanet Archive, 15 Oct 2026); at least one planet per star
 * on average (Cassan et al. 2012); three in four Earth-like planets older than the Earth, by 1.8 ±
 * 0.9 Gyr on average (Lineweaver 2001); at 0.1 c the galaxy is crossed in ~650 000 years (Hart
 * 1975); all of SETI so far ≈ a hot tub out of all the oceans (Wright, Kanodia & Lubar 2018).
 *
 * World units: light years, the Sun at the origin. The camera rides a pivot (it sits at the origin
 * and the world is scaled so its target is one unit away), so the dive from 10⁵ ly to a few Earth
 * radii stays precise.
 */

const LY = 9.4607e15;
const AU_LY = 1.496e11 / LY;
const R_E_LY = 6.371e6 / LY;
const R_SUN_LY = 6.957e8 / LY;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

type Vista = { pos: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3; fov: number };
const sph = (c: THREE.Vector3, d: number, elev: number, az: number) => c.clone().add(V(Math.cos(elev) * Math.sin(az) * d, Math.sin(elev) * d, Math.cos(elev) * Math.cos(az) * d));
const mezcla = (a: Vista, b: Vista, t: number): Vista => {
  if (t <= 0) return a;
  if (t >= 1) return b;
  // Log distance between the two (a dive keeps its speed across scales).
  const ta = a.target.clone().lerp(b.target, t);
  const da = a.pos.clone().sub(a.target);
  const db = b.pos.clone().sub(b.target);
  const dir = da.clone().normalize().lerp(db.clone().normalize(), t).normalize();
  const d = Math.exp(lerp(Math.log(da.length()), Math.log(db.length()), t));
  return { pos: ta.clone().addScaledVector(dir, d), target: ta, up: a.up.clone().lerp(b.up, t).normalize(), fov: lerp(a.fov, b.fov, t) };
};

export const apertura: Escena = {
  id: 'apertura',
  nombre: '¿Hay alguien más?',
  estilos: [
    { key: '1', nombre: 'Dentro', nota: 'En primera persona por el disco: los planetas aparecen alrededor de las estrellas que pasan, y la burbuja que debería existir nos atraviesa y no está.' },
    { key: '2', nombre: 'Desde fuera', nota: 'La galaxia entera: lo que hemos visto contra lo que debe haber, las edades en una barra, una civilización que la llena en 650 000 años.' },
    { key: '3', nombre: 'Escuchar', nota: 'Desde el Sol hacia afuera: nuestra voz (una burbuja de radio de 100 años luz) contra una galaxia de 100 000, y lo poco que hemos escuchado.' },
  ],
  montar(stage, estilo): Instancia {
    const s = estilo + 1;
    stage.bloom.strength = 0.55;
    stage.bloom.radius = 0.4;
    stage.bloom.threshold = 0.6;
    stage.renderer.toneMappingExposure = 1.0;
    const root = new THREE.Group();
    stage.root.add(root);

    // The flight of way 1, through our neighbourhood towards the Sun.
    const F0 = V(2300, 320, 6600);
    const F1 = V(420, 70, 1500);
    const G = galaxia([F0.clone().add(V(300, 40, 900)), V(0, 0, 0)]);
    root.add(G.nube.points);
    // The stars at infinity (no band: the band is the galaxy's own light), only while inside the disk.
    const sky = cielo(0.8);
    sky.u.uBanda.value = 0;
    stage.root.add(sky.mesh);
    stage.root.add(G.luz.mesh);
    // The bubble that should exist (1, 2) and our radio bubble (3).
    const bub = esferaLamina();
    root.add(bub.group);
    // The Sun and the Earth (the end of the dive).
    const sun = sol();
    sun.group.scale.setScalar(R_SUN_LY);
    root.add(sun.group);
    const earth = tierra();
    const E = V(0.26, 0.05, 1).normalize().applyAxisAngle(V(0, 1, 0), 0.22).multiplyScalar(AU_LY);
    earth.group.position.copy(E);
    earth.group.scale.setScalar(R_E_LY);
    root.add(earth.group);
    const B = faros([
      { color: new THREE.Color(1.0, 0.9, 0.6), px: 2.6 }, // the Sun, a yellow star
      { color: new THREE.Color(0.5, 0.75, 1.0), px: 1.8 }, // the Earth, a blue dot
    ]);
    root.add(B.points);

    // ------------------------------------------------------------ the journey
    const tl = new Timeline({ f: 0, plan: 0, old: 0, bub: 0, dive: 0, voz: 0, lejos: 0 });
    const cap = (d: number, n: string, f: string) => tl.caption(d, n, f);
    cap(1.8, '¿Hay alguien más?', 'La Vía Láctea: cientos de miles de millones de estrellas que brillan con unos 10³⁷ vatios desde hace 13 000 millones de años. Que sepamos, nadie los usa.');
    tl.label('portada').to(1.8, { f: 0.06 });
    if (s === 3) {
      cap(2.6, 'Nuestra voz', 'Las primeras radios salieron hace un siglo. Desde entonces, nuestra voz llena una burbuja de unos 100 años luz.');
      tl.label('voz').to(2.6, { voz: 1 });
      cap(2.8, 'Cien mil años luz', 'A la escala de la galaxia, esa burbuja es un punto. Todo lo que hemos dicho no ha salido de nuestro barrio.');
      tl.label('lejos').to(2.8, { lejos: 1 });
      cap(3.2, 'Lo que hemos escuchado', 'Hay planetas por todas partes. Lo que llevamos escuchado equivale a buscar peces en un jacuzzi sacado del océano (Wright y otros, 2018).');
      tl.label('planetas').to(3.2, { plan: 1 });
    } else {
      cap(3.0, 'Planetas por todas partes', 'Ya confirmamos 6 451 planetas. En promedio hay al menos uno por estrella: cientos de miles de millones.');
      tl.label('planetas').to(3.0, { f: 0.5, plan: 1 });
      cap(2.4, 'Mundos más viejos', 'Tres de cada cuatro planetas como la Tierra son más viejos que ella: en promedio, 1 800 millones de años.');
      tl.label('viejos').to(2.4, { f: 0.72, old: 1 });
      cap(3.0, 'El silencio', 'A una décima de la velocidad de la luz, una sola civilización cruzaría la galaxia en 650 000 años. ¿Dónde están todos?');
      tl.label('silencio').to(0.4, { old: 0 }).to(2.6, { f: 0.9, bub: 1 });
    }
    cap(3.4, 'Una estrella amarilla', 'La pregunta queda abierta. La respuesta empieza aquí: en un planeta azul, alrededor de una estrella amarilla.');
    tl.label('caida').to(3.4, { dive: 1 });
    tl.to(0.8, {});
    const P = (l: string) => tl.at(l);
    const ease = smoothstep;

    // ------------------------------------------------------------ cameras (ly)
    const UP = V(0, 1, 0);
    const flight = (f: number): Vista => {
      const pos = F0.clone().lerp(F1, f);
      pos.y += 60 * Math.sin(f * 5);
      const ahead = F1.clone().sub(F0).normalize().applyAxisAngle(UP, -0.25 + 0.18 * f);
      ahead.y -= 0.06;
      return { pos, target: pos.clone().addScaledVector(ahead.normalize(), 600), up: UP.clone(), fov: 64 };
    };
    const SB = CENTRO.clone().add(V(-17000, 0, 11000));
    const fuera = (p: number): Vista => {
      const d = lerp(150000, 108000, ease(P('portada'), P('viejos'), p));
      const az = 0.5 + 0.035 * p;
      return { pos: sph(CENTRO, d, 0.98 - 0.08 * ease(P('planetas'), P('silencio'), p), az), target: CENTRO.clone().add(V(0, 0, 9000)), up: UP.clone(), fov: 42 };
    };
    // Way 3: near the Sun, then all the way out.
    const cerca = (p: number): Vista => {
      const az = 0.35 + 0.05 * p;
      const d0 = lerp(420, 300, ease(P('voz'), P('lejos'), p));
      const k = ease(P('lejos'), P('planetas') - 0.2, p);
      const d = Math.exp(lerp(Math.log(d0), Math.log(155000), k));
      const target = V(0, 0, 0).lerp(CENTRO.clone().multiplyScalar(0.62), ease(0.35, 1, k));
      return { pos: sph(target, d, lerp(0.18, 1.0, ease(0.0, 0.8, k)), az), target, up: UP.clone(), fov: 46 };
    };
    // The dive: wherever we are, to the Sun, then to the Earth, which hides it.
    const approach = E.clone().normalize();
    const llegada = (k: number, from: Vista): Vista => {
      // Distance to the Sun, in log, from where we are to just beyond the Earth; then to the Earth itself.
      const d0 = from.pos.length();
      const dirFrom = from.pos.clone().normalize();
      const dir = dirFrom.lerp(approach, ease(0.0, 0.42, k)).normalize();
      const dSun = Math.exp(lerp(Math.log(d0), Math.log(AU_LY * 1.0), ease(0, 0.78, k)));
      const onEarth = ease(0.62, 1, k);
      const center = V(0, 0, 0).lerp(E, onEarth);
      const dEnd = 4.2 * R_E_LY;
      const dist = Math.exp(lerp(Math.log(dSun), Math.log(dEnd), onEarth));
      const pos = center.clone().addScaledVector(dir, dist);
      const target = from.target.clone().lerp(V(0, 0, 0), ease(0, 0.3, k)).lerp(E, onEarth);
      return { pos, target, up: UP.clone(), fov: lerp(from.fov, 40, ease(0, 0.6, k)) };
    };
    function camara(p: number): Vista {
      let v: Vista;
      if (s === 1) v = flight(tl.get('f', p));
      else if (s === 2) v = fuera(p);
      else v = cerca(p);
      const k = tl.get('dive', p);
      if (k > 0) {
        const from = s === 1 ? flight(tl.get('f', P('caida'))) : s === 2 ? fuera(P('caida')) : cerca(P('caida'));
        v = llegada(k, from);
      }
      return v;
    }

    // The bubble's place and size.
    const B1 = V(-1700, 40, -700);
    const bubble = (p: number) => {
      const k = tl.get('bub', p);
      if (s === 1) return { c: B1, r: 8 + 7200 * k, on: ease(0.0, 0.08, k) * (1 - ease(0.78, 0.98, k)) };
      if (s === 2) return { c: SB, r: 20 + 120000 * ease(0, 0.82, k), on: ease(0.0, 0.06, k) * (1 - ease(0.84, 1.0, k)) };
      return { c: V(0, 0, 0), r: 100 * ease(0, 1, tl.get('voz', p)), on: tl.get('voz', p) > 0.001 ? 1 : 0 };
    };

    const ended = (p: number) => tl.get('dive', p) > 0.985;
    const tmp = V();
    return {
      tl,
      listo: earth.listo,
      lectura: (p) => (ended(p) ? { lp: 13.28, ly: -1, lr: 5.6 } : null),
      // The power that is there and nobody uses; on the dive it falls with what is in view.
      libre: (p) => {
        const k = tl.get('dive', p);
        const lp = lerp(lerp(lerp(37.0, 26.58, ease(0.1, 0.35, k)), 17.24, ease(0.5, 0.75, k)), 13.28, ease(0.85, 0.985, k));
        const linea =
          k > 0.85 ? 'la Tierra · ocho mil millones de personas'
          : k > 0.5 ? 'la luz del Sol que llega a un planeta azul'
          : k > 0.1 ? 'una estrella amarilla · el Sol'
          : s === 3 ? 'la Vía Láctea · 13 000 millones de años · nuestra radio: 100 años luz'
          : `la Vía Láctea · 13 000 millones de años · ${tl.get('plan', p) > 0.05 ? '6 451 planetas confirmados' : 'nadie la usa'}`;
        return { lp, linea };
      },
      rotulo: (p) => tl.captionAt(p),
      update(f: Frame) {
        const { camera, p, time } = f;
        const v = camara(p);
        // The pivot: the camera at the origin, the world scaled so the target is one unit away.
        const d = Math.max(v.pos.distanceTo(v.target), 1e-15);
        const k = 1 / d;
        root.scale.setScalar(k);
        root.position.copy(v.pos).multiplyScalar(-k);
        camera.position.set(0, 0, 0);
        camera.up.copy(v.up);
        camera.lookAt(tmp.copy(v.target).sub(v.pos).multiplyScalar(k));
        camera.fov = v.fov;
        camera.near = 1e-4;
        camera.far = 1e30;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        root.updateMatrixWorld(true);
        G.update(k, v.pos);
        // The light of the galaxy: dimmer once we are among the stars of the solar system.
        const inSolar = smoothstep(Math.log(5), Math.log(0.002), Math.log(v.pos.length() + 1e-12));
        // Inside the disk its light comes from every side: dimmer per pixel than from outside.
        const rel = v.pos.clone().sub(CENTRO);
        const inDisk = (1 - smoothstep(1500, 9000, Math.abs(rel.y))) * (1 - smoothstep(45000, 70000, Math.hypot(rel.x, rel.z)));
        G.luz.u.uLight.value = lerp(1.4, 0.55, inDisk) * (1 - 0.4 * inSolar);
        sky.u.uBrillo.value = 0.8 * inDisk;
        G.nube.u.uFlux.value = lerp(1, 3, inDisk);
        G.nube.u.uNear.value = s === 1 ? 260 : 600;
        G.nube.u.uFloor.value = s === 1 ? 0.012 : 0.05;
        G.nube.u.uOld.value = tl.get('old', p);
        const bb = bubble(p);
        bub.group.position.copy(bb.c);
        bub.group.scale.setScalar(Math.max(bb.r, 1e-6));
        bub.nube.u.uGain.value = s === 3 ? bb.on * (1 - 0.6 * ease(P('lejos'), P('lejos') + 1.4, p)) * (1 - tl.get('dive', p)) : bb.on * 0.5;
        G.nube.u.uBub.value.copy(bb.c);
        G.nube.u.uBubR.value = bb.r;
        G.nube.u.uBubOn.value = s === 3 ? 0 : bb.on;
        // The Sun and the Earth.
        sun.update(camera, time, 0.55);
        const camL = v.pos.clone().sub(E).divideScalar(R_E_LY);
        earth.update(E.clone().negate().normalize(), camL, 0.36);
        const focal = f.H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const px = (c: THREE.Vector3, r: number) => (r / Math.max(c.distanceTo(v.pos), 1e-18)) * focal;
        const dive = tl.get('dive', p);
        B.set(0, V(0, 0, 0), (1 - smoothstep(2, 8, px(V(), R_SUN_LY))) * (s === 1 ? 0.6 + 0.4 * ease(0.05, 0.3, dive) : 1));
        B.set(1, E, (1 - smoothstep(2, 6, px(E, R_E_LY))) * ease(0.4, 0.55, dive));
        B.commit();
        B.mat.uniforms.uDpr.value = f.dpr;
        for (const n of [G.nube, bub.nube, ...earth.nubes]) {
          enfocar(n, focal, f.dpr, time);
          n.u.uSizeUnit.value = n.points.getWorldScale(tmp).x;
          n.u.uMinPx.value = 1.3 * f.dpr;
        }
        G.nube.u.uMaxPx.value = 6 * f.dpr;
        for (const n of earth.nubes) n.u.uMinPx.value = 1.4 * f.dpr;
      },
      placa(g: CanvasRenderingContext2D, f: Frame) {
        const { p, W, H, u, camera, time } = f;
        const v = camara(p);
        const k = 1 / Math.max(v.pos.distanceTo(v.target), 1e-15);
        const toScene = (w: THREE.Vector3) => w.clone().sub(v.pos).multiplyScalar(k);
        const proj = (w: THREE.Vector3) => pr(toScene(w), camera, W, H);
        // The title.
        const ta = 1 - ease(P('portada') + 1.0, P('portada') + 1.7, p);
        if (ta > 0.01) {
          g.save();
          g.globalAlpha = ta;
          g.textAlign = 'center';
          g.shadowColor = 'rgba(0,0,0,0.8)';
          g.shadowBlur = 20 * u;
          g.font = FONT.serif(118 * u);
          g.fillStyle = ink();
          g.fillText('Destino', W / 2, H * 0.44);
          g.font = FONT.italic(30 * u);
          g.fillStyle = ink(0.75);
          g.fillText('¿Adónde podemos llegar?', W / 2, H * 0.44 + 54 * u);
          g.restore();
        }
        const dive = tl.get('dive', p);
        // Planets: orbits around the stars that have them (size illustrative).
        const plan = tl.get('plan', p) * (1 - ease(0.05, 0.25, dive));
        if (plan > 0.01) {
          let shown = 0;
          let zona: { x: number; y: number; a: number } | null = null;
          for (let i = 0; i < G.conPlanetas.length && shown < 260; i++) {
            const st = G.conPlanetas[i];
            const dly = st.distanceTo(v.pos);
            const q = proj(st);
            if (!q || q.x < 0 || q.x > W || q.y < 0 || q.y > H) continue;
            if (s === 1) {
              if (dly > 650 || shown > 12 + 70 * tl.get('plan', p)) continue;
              const r = clamp(9000 / dly, 7, 34) * u;
              const a = plan * (1 - smoothstep(420, 650, dly));
              const tilt = (i * 0.618) % 1;
              const rot = (i * 2.399) % Math.PI;
              const amber = G.viejos[i] ? tl.get('old', p) : 0;
              for (let o = 0; o < 1 + (i % 3); o++) {
                const rr = r * (0.55 + 0.45 * o);
                g.save();
                g.globalAlpha = a * 0.95;
                g.strokeStyle = amber > 0.5 ? 'rgba(255,170,90,0.95)' : o === 1 ? 'rgba(111,227,193,0.95)' : ink(0.75);
                g.lineWidth = Math.max(1, 1.0 * u);
                if (o === 1) g.setLineDash([2 * u, 2.5 * u]);
                g.beginPath();
                g.ellipse(q.x, q.y, rr, rr * (0.25 + 0.6 * tilt), rot, 0, Math.PI * 2);
                g.stroke();
                // The planet, going round.
                const ang = time * (0.4 / (1 + o)) + i;
                const px = q.x + Math.cos(ang) * rr * Math.cos(rot) - Math.sin(ang) * rr * (0.25 + 0.6 * tilt) * Math.sin(rot);
                const py = q.y + Math.cos(ang) * rr * Math.sin(rot) + Math.sin(ang) * rr * (0.25 + 0.6 * tilt) * Math.cos(rot);
                if (o === 1 && amber <= 0.5 && !zona && q.x > W * 0.3 && q.x < W * 0.7 && q.y > H * 0.15 && q.y < H * 0.55) zona = { x: q.x + rr * Math.cos(rot), y: q.y + rr * Math.sin(rot), a: a };
                g.fillStyle = amber > 0.5 ? '#ffb070' : o === 1 ? TEAL : ink(0.85);
                g.beginPath();
                g.arc(px, py, 1.6 * u, 0, Math.PI * 2);
                g.fill();
                g.restore();
              }
              // The star itself, marked.
              g.save();
              g.globalAlpha = a;
              g.fillStyle = amber > 0.5 ? '#ffd0a0' : '#fff6e8';
              g.shadowColor = g.fillStyle as string;
              g.shadowBlur = 6 * u;
              g.beginPath();
              g.arc(q.x, q.y, 1.5 * u, 0, Math.PI * 2);
              g.fill();
              g.restore();
              shown++;
            } else {
              // From afar: a dot of lámina on each star that has planets.
              if (i < 1500 && s === 2 && tl.get('plan', p) < 0.5) continue;
              g.save();
              g.globalAlpha = plan * 0.7;
              g.fillStyle = i % 4 === 1 ? TEAL : ink(0.8);
              g.beginPath();
              g.arc(q.x, q.y, 1.2 * u, 0, Math.PI * 2);
              g.fill();
              g.restore();
              shown += 0.1;
            }
          }
          if (s === 1) {
            texto(g, u, W / 2, H - 300 * u, 'órbitas dibujadas · tamaño ilustrativo', ink(0.5), plan, 9, 'center', false);
            const z = zona as { x: number; y: number; a: number } | null;
            if (z) nota(g, u, z.x, z.y, 'zona habitable: agua líquida posible', 36, -30, z.a * ease(P('planetas') + 0.6, P('planetas') + 1.2, p) * (1 - ease(P('viejos') - 0.2, P('viejos') + 0.3, p)));
          } else {
            // The key, from afar: the teal ones have a planet in their habitable zone.
            const ka = plan * ease(P('planetas') + 0.6, P('planetas') + 1.2, p);
            if (ka > 0.01) {
              g.save();
              g.globalAlpha = ka;
              g.fillStyle = ink(0.8);
              g.beginPath();
              g.arc(W / 2 - 150 * u, H - 300 * u, 2.4 * u, 0, Math.PI * 2);
              g.fill();
              g.fillStyle = TEAL;
              g.beginPath();
              g.arc(W / 2 + 6 * u, H - 300 * u, 2.4 * u, 0, Math.PI * 2);
              g.fill();
              g.restore();
              texto(g, u, W / 2 - 142 * u, H - 300 * u, 'una estrella con planetas', ink(0.7), ka, 9.5, 'left', false);
              texto(g, u, W / 2 + 14 * u, H - 300 * u, 'uno en la zona habitable', TEAL, ka, 9.5, 'left', false);
            }
          }
          // The count, as the show.
          if (s !== 3) {
            const c = ease(P('planetas') + 0.2, P('planetas') + 0.8, p) * (1 - ease(P('viejos') - 0.3, P('viejos'), p));
            const half = ease(P('planetas') + 1.4, P('planetas') + 2.0, p);
            cifra(g, u, W * 0.72, H * 0.3, half > 0.5 ? '10' : '6 451', half > 0.5 ? '11' : '', 64, c, half > 0.5 ? TEAL : ink(0.95), half > 0.5 ? 'planetas en la galaxia, al menos' : 'planetas confirmados');
          }
        }
        // 2 · What we have seen: almost all of it close to us.
        if (s === 2) {
          const a = ease(P('planetas') + 0.1, P('planetas') + 0.6, p) * (1 - ease(P('planetas') + 1.6, P('planetas') + 2.2, p));
          const sunQ = proj(V());
          const edge = proj(V(3000, 0, 0));
          if (sunQ && edge && a > 0.01) {
            const r = Math.hypot(edge.x - sunQ.x, edge.y - sunQ.y);
            g.save();
            g.globalAlpha = a;
            g.strokeStyle = TEAL;
            g.setLineDash([3 * u, 3 * u]);
            g.lineWidth = Math.max(1, 1.2 * u);
            g.beginPath();
            g.ellipse(sunQ.x, sunQ.y, r, r * 0.55, 0, 0, Math.PI * 2);
            g.stroke();
            g.restore();
            nota(g, u, sunQ.x, sunQ.y - r * 0.55, 'casi todo lo que hemos visto: unos miles de años luz', 40, -40, a);
          }
          // «You are here».
          const here = proj(V());
          if (here) nota(g, u, here.x, here.y, 'el Sol', -40, 30, ease(P('portada') + 1.4, P('portada') + 2, p) * (1 - ease(0.3, 0.5, dive)));
          // The ages, on a bar of 13 000 million years.
          const ba = ease(P('viejos') + 0.1, P('viejos') + 0.6, p) * (1 - ease(P('caida') - 0.2, P('caida') + 0.4, p));
          if (ba > 0.01) edades(g, f, ba, ease(P('silencio') + 0.6, P('silencio') + 1.2, p));
          // The bubble: a timer, and then nothing.
          const bk = tl.get('bub', p);
          if (bk > 0.01 && bk < 0.999) {
            const q = proj(SB);
            if (q) nota(g, u, q.x, q.y, 'una civilización · a 0,1 c', 30, -34, ease(0, 0.08, bk) * (1 - ease(0.3, 0.45, bk)));
            const years = Math.round((650000 * ease(0, 0.82, bk)) / 1000) * 1000;
            cifra(g, u, W * 0.74, H * 0.28, years.toLocaleString('es').replace(/\./g, ' '), '', 52, ease(0.02, 0.1, bk) * (1 - ease(0.86, 0.95, bk)), TEAL, 'años');
          }
          const none = ease(0.86, 0.95, bk) * (1 - ease(P('caida'), P('caida') + 0.5, p));
          texto(g, u, W / 2, H * 0.3, 'bastaría una · no vemos ninguna', ink(0.9), none, 13, 'center');
        }
        // 1 · The bubble passing over us, and then nothing.
        if (s === 1) {
          const bk = tl.get('bub', p);
          const q = proj(B1);
          if (bk > 0.01 && bk < 0.5 && q) nota(g, u, q.x, q.y, 'si una civilización hubiera salido de aquí…', 30, -40, ease(0, 0.06, bk) * (1 - ease(0.3, 0.45, bk)));
          const pass = ease(0.25, 0.35, bk) * (1 - ease(0.6, 0.7, bk));
          texto(g, u, W / 2, H * 0.3, '…a 0,1 c su burbuja cruzaría la galaxia en 650 000 años', TEAL, pass, 12, 'center', false);
          const none = ease(0.82, 0.95, bk) * (1 - ease(P('caida'), P('caida') + 0.5, p));
          texto(g, u, W / 2, H * 0.3, 'y no está', ink(0.92), none, 14, 'center');
        }
        // 3 · Our voice, and how far it is from everything.
        if (s === 3) {
          const vq = proj(V(0, 100, 0));
          const sq = proj(V());
          const a = ease(P('voz') + 0.4, P('voz') + 1.0, p) * (1 - ease(P('lejos') + 0.4, P('lejos') + 1.0, p));
          if (vq && a > 0.01) nota(g, u, vq.x, vq.y, 'nuestra radio · 100 años luz', 34, -30, a);
          const b2 = ease(P('lejos') + 1.0, P('lejos') + 1.6, p) * (1 - ease(P('caida'), P('caida') + 0.4, p));
          if (sq && b2 > 0.01) {
            g.save();
            g.globalAlpha = b2;
            g.strokeStyle = TEAL;
            g.lineWidth = Math.max(1, 1.3 * u);
            g.beginPath();
            g.arc(sq.x, sq.y, 5 * u, 0, Math.PI * 2);
            g.stroke();
            g.restore();
            nota(g, u, sq.x, sq.y, 'nuestra voz · todo cabe en este punto', 40, 36, b2);
            const e1 = proj(CENTRO.clone().add(V(-50000, 0, 0)));
            const e2 = proj(CENTRO.clone().add(V(50000, 0, 0)));
            if (e1 && e2) {
              const y = Math.max(e1.y, e2.y) + 40 * u;
              linea(g, u, [{ x: e1.x, y }, { x: e2.x, y }], ink(0.5), b2, [], 1);
              linea(g, u, [{ x: e1.x, y: y - 5 * u }, { x: e1.x, y: y + 5 * u }], ink(0.5), b2, [], 1);
              linea(g, u, [{ x: e2.x, y: y - 5 * u }, { x: e2.x, y: y + 5 * u }], ink(0.5), b2, [], 1);
              texto(g, u, (e1.x + e2.x) / 2, y + 14 * u, '100 000 años luz', ink(0.7), b2, 10, 'center', false);
            }
          }
        }
        // The dive: a yellow star, a blue planet.
        const sq = proj(V());
        if (sq && dive > 0.05) nota(g, u, sq.x, sq.y, 'una estrella amarilla', 30, -34, ease(0.05, 0.2, dive) * (1 - ease(0.45, 0.58, dive)));
        const eq = proj(E);
        if (eq && dive > 0.4) nota(g, u, eq.x, eq.y, 'un planeta azul', 34, 34, ease(0.45, 0.6, dive) * (1 - ease(0.8, 0.9, dive)));
      },
      dispose() {},
    };

    /** The ages of the galaxy on a bar (way 2): the galaxy, the older Earths, the Sun, and how short 650 000 years is. */
    function edades(g: CanvasRenderingContext2D, f: Frame, a: number, hart: number) {
      const { W, H, u } = f;
      const x0 = W * 0.18;
      const x1 = W * 0.82;
      const y = H - 330 * u;
      const X = (myrAgo: number) => x0 + ((13000 - myrAgo) / 13000) * (x1 - x0);
      g.save();
      g.globalAlpha = a;
      g.fillStyle = 'rgba(4,6,8,0.6)';
      g.beginPath();
      g.roundRect(x0 - 24 * u, y - 52 * u, x1 - x0 + 48 * u, 100 * u, 8 * u);
      g.fill();
      g.restore();
      linea(g, u, [{ x: x0, y }, { x: x1, y }], ink(0.7), a, [], 2);
      const tick = (m: number, label: string, col: string, up: boolean) => {
        const x = X(m);
        linea(g, u, [{ x, y: y - 6 * u }, { x, y: y + 6 * u }], col, a, [], 1.4);
        texto(g, u, x, y + (up ? -20 : 22) * u, label, col, a, 9.5, 'center', false);
      };
      tick(13000, 'nace la galaxia', ink(0.75), true);
      tick(4600, 'nace el Sol', '#ffe0a0', true);
      tick(0, 'hoy', ink(0.75), true);
      // Where the Earth-like planets are born on average: 1 800 ± 900 million years before.
      const m = 6400;
      g.save();
      g.globalAlpha = a * 0.5;
      g.fillStyle = '#ff9a4a';
      g.fillRect(X(m + 900), y - 3 * u, X(m - 900) - X(m + 900), 6 * u);
      g.restore();
      tick(m, 'la Tierra promedio: 1 800 millones antes', '#ffb070', false);
      if (hart > 0.01) {
        const x = X(0.65);
        g.save();
        g.globalAlpha = a * hart;
        g.fillStyle = TEAL;
        g.fillRect(x - 1, y - 14 * u, 2, 28 * u);
        g.restore();
        const pts: P2[] = [{ x: x - 2 * u, y: y + 16 * u }, { x: x - 60 * u, y: y + 32 * u }];
        linea(g, u, pts, TEAL, a * hart, [], 1);
        texto(g, u, x - 64 * u, y + 32 * u, '650 000 años: no se ve en esta barra', TEAL, a * hart, 9.5, 'right', false);
      }
    }
  },
};
