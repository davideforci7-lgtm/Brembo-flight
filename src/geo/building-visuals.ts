// SPDX-License-Identifier: AGPL-3.0-only
import * as THREE from "three";
import type { Building, Point } from "./sector";
import type { TerrainProvider } from "../core/terrain";

/** Display-only plaster tints. Never a claim about real facade colours. */
export function facadeTint(id: string) {
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return new THREE.Color(["#c7c3b8", "#bdb9b0", "#d1cabe", "#c5bcad"][Math.abs(hash) % 4]);
}

export function buildingWalls(b: Building, terrain: TerrainProvider) {
  const positions: number[] = [], indices: number[] = [], facade: number[] = [], colors: number[] = [];
  const tint = facadeTint(b.id);
  for (const [ringIndex, source] of [b.points, ...b.holes].entries()) {
    const ring: Point[] = [...source];
    const area = ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
    // Cross(edge, up) points left: exterior clockwise, holes counterclockwise.
    if ((ringIndex === 0 && area > 0) || (ringIndex > 0 && area < 0)) ring.reverse();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length];
      const width = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const bottomA = terrain.heightAt(...a) - .5, bottomC = terrain.heightAt(...c) - .5;
      const n = positions.length / 3, top = b.base + b.height;
      positions.push(a[0], bottomA, a[1], c[0], bottomC, c[1], a[0], top, a[1], c[0], top, c[1]);
      // Local metres along the wall and above its building base; no global-axis stretch.
      facade.push(0, bottomA - b.base, width, bottomC - b.base, 0, b.height, width, b.height);
      for (let v = 0; v < 4; v++) colors.push(tint.r, tint.g, tint.b);
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("facade", new THREE.Float32BufferAttribute(facade, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Filter the existing illustrative windows in screen space, fading subpixel detail. */
export function configureFacade(material: THREE.MeshStandardMaterial) {
  material.vertexColors = true;
  material.color.set("#ffffff");
  material.customProgramCacheKey = () => "brembo-facade-filtered-v2";
  material.onBeforeCompile = shader => {
    shader.vertexShader = "attribute vec2 facade; varying vec2 vFacade;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\nvFacade=facade;");
    shader.fragmentShader = "varying vec2 vFacade;\n" + shader.fragmentShader.replace(
      "#include <color_fragment>", `#include <color_fragment>
      // Stable family per facade tint: illustrative fenestration, never a survey.
      float family = fract(vColor.r*31.7+vColor.g*17.3);
      vec2 cell = vFacade / vec2(3.2+family*.8, 3.2);
      vec2 pane = fract(cell);
      vec2 footprint = max(fwidth(cell), vec2(0.001));
      vec2 aa = min(footprint, vec2(0.2));
      vec2 edges = smoothstep(vec2(.28,.30)-aa, vec2(.28,.30)+aa, pane)
                 * (1.0-smoothstep(vec2(.58,.70)-aa, vec2(.58,.70)+aa, pane));
      float detail = 1.0-smoothstep(.08,.28,max(footprint.x,footprint.y));
      float fade = (1.0-smoothstep(180.0,450.0,length(vViewPosition))) * detail;
      float mask = edges.x * edges.y * fade * smoothstep(.4,1.2,vFacade.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.10,.13,.14),mask*.65);
      vec2 frameEdges = smoothstep(vec2(.24,.26)-aa,vec2(.24,.26)+aa,pane)
        * (1.0-smoothstep(vec2(.62,.74)-aa,vec2(.62,.74)+aa,pane));
      float frame = max(0.0,frameEdges.x*frameEdges.y-edges.x*edges.y)*fade;
      diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.44,.41,.35),frame*.45);
      float sill=(1.0-smoothstep(.025,.025+aa.y,abs(pane.y-.27)))*frameEdges.x*fade;
      diffuseColor.rgb += vec3(.035)*sill;
      diffuseColor.rgb *= mix(.82,1.0,smoothstep(0.0,3.0,vFacade.y));`);
  };
}
