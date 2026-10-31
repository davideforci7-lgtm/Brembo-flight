// SPDX-License-Identifier: AGPL-3.0-only
import * as THREE from "three";

/** Original illustrative material grain, not aerial imagery or surveyed detail.
 * One shared 128px mipmapped texture: 87,382 decoded bytes, no network request. */
export const DETAIL_TEXTURE_BYTES = Math.ceil(128 * 128 * 4 * 4 / 3);
let grain: THREE.DataTexture | undefined;
export function materialGrain() {
  if (grain) return grain;
  const data = new Uint8Array(128 * 128 * 4);
  let state = 1977;
  for (let i = 0; i < data.length; i += 4) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const n = 70 + (state >>> 25);
    data[i] = data[i + 1] = data[i + 2] = n;
    data[i + 3] = 255;
  }
  grain = new THREE.DataTexture(data, 128, 128, THREE.RGBAFormat);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.generateMipmaps = true;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.magFilter = THREE.LinearFilter;
  grain.needsUpdate = true;
  return grain;
}

/** Preserve the OSM colour boundaries and terrain geometry. World-space detail
 * softly concentrates on the 600m pilot around OSM way/127912869. */
export function configureGround(material: THREE.MeshStandardMaterial) {
  material.customProgramCacheKey = () => "brembo-ground-pilot-v1";
  material.onBeforeCompile = shader => {
    shader.uniforms.materialGrain = { value: materialGrain() };
    shader.vertexShader = "varying vec3 vGround;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\nvGround=position;");
    shader.fragmentShader = "uniform sampler2D materialGrain; varying vec3 vGround;\n" + shader.fragmentShader.replace(
      "#include <color_fragment>", `#include <color_fragment>
      float pilot = 1.0-smoothstep(250.0,400.0,length(vGround.xz-vec2(198.9,295.65)));
      float broad = texture2D(materialGrain,vGround.xz/170.0).r-.52;
      float fine = texture2D(materialGrain,vGround.xz/9.0).r-.52;
      // Derivatives and mipmaps suppress sparkling at grazing angles.
      float detailFade = 1.0-smoothstep(.03,.3,length(fwidth(vGround.xz/9.0)));
      diffuseColor.rgb *= 1.0 + pilot*(broad*.65+fine*.28*detailFade);
      `);
  };
}

/** Roofing joints in metres, filtered rather than individual tile geometry.
 * Material treatment is illustrative; footprint, flat top and height unchanged. */
export function configureRoof(material: THREE.MeshStandardMaterial) {
  material.vertexColors = true;
  material.color.set("#ffffff");
  material.customProgramCacheKey = () => "brembo-roof-pilot-v1";
  material.onBeforeCompile = shader => {
    shader.vertexShader = "varying vec2 vRoof;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\nvRoof=uv;");
    shader.fragmentShader = "varying vec2 vRoof;\n" + shader.fragmentShader.replace(
      "#include <color_fragment>", `#include <color_fragment>
      vec2 cell=vRoof/vec2(.32,.48);
      vec2 footprint=max(fwidth(cell),vec2(.001));
      vec2 edge=min(fract(cell),1.0-fract(cell));
      vec2 joint=1.0-smoothstep(vec2(.025),vec2(.025)+footprint,edge);
      float fade=1.0-smoothstep(.18,.65,max(footprint.x,footprint.y));
      diffuseColor.rgb *= 1.0-.22*max(joint.x,joint.y)*fade;
      `);
  };
}
