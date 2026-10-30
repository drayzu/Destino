import type * as THREE from 'three';

/**
 * The renderer keeps a logarithmic depth buffer (planets and stars write their depth that way, so
 * worlds of very different sizes sort right). A ShaderMaterial of our own that tests or writes depth
 * must do the same, or it sorts wrongly against them (a shell drawn behind the star it encloses).
 * This adds three's chunks for it to a material's shaders (call it before the first render).
 */
export function logDepth<T extends THREE.ShaderMaterial>(m: T): T {
  m.vertexShader = `#include <common>\n#include <logdepthbuf_pars_vertex>\n${m.vertexShader.replace(/\}\s*$/, '  #include <logdepthbuf_vertex>\n}\n')}`;
  m.fragmentShader = `#include <logdepthbuf_pars_fragment>\n${m.fragmentShader.replace(/void main\(\)\s*\{/, 'void main() {\n  #include <logdepthbuf_fragment>')}`;
  return m;
}
