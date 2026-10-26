import { Timeline } from '../timeline';
import type { Escena } from './tipos';

export const mente: Escena = {
  id: 'mente',
  nombre: 'mente',
  estilos: [{ key: '1', nombre: 'pendiente', nota: 'Pendiente.' }],
  montar() {
    const tl = new Timeline({});
    tl.to(1, {});
    return { tl, update() {}, lectura: () => null, rotulo: () => null, dispose() {} };
  },
};
