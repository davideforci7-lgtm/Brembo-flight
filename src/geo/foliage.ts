// SPDX-License-Identifier: AGPL-3.0-only
import * as THREE from "three";
import type { Obstacle } from "../core/terrain";
import { seededRandom } from "../core/math";
import type { Preset } from "../core/graphics";

/** Display-only broadleaf crowns at the existing OSM-woodland sample locations.
 * Neither a tree census nor a change to flight collision envelopes. */
export class SectorFoliage {
  readonly group = new THREE.Group();
  private coarse = new THREE.IcosahedronGeometry(1, 0);
  private detailed = new THREE.IcosahedronGeometry(1, 1);
  private near: THREE.InstancedMesh;
  private detailedActive = false;
  readonly pilotTrees: number;
  constructor(trees: Obstacle[]) {
    const pilot = trees.filter(t => Math.hypot(t.position.x-198.9,t.position.z-295.65)<350).slice(0,128);
    const chosen = new Set(pilot);
    this.pilotTrees = pilot.length;
    const material = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 });
    const distant = new THREE.InstancedMesh(this.coarse,material,(trees.length-pilot.length)*2);
    this.near = new THREE.InstancedMesh(this.coarse,material,pilot.length*2);
    this.near.castShadow = true;
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.1,.15,1,5),
      new THREE.MeshStandardMaterial({ color: "#63513b", roughness: 1 }),trees.length);
    const transform = new THREE.Object3D(), color = new THREE.Color(), rand = seededRandom(8);
    let ni=0, di=0;
    trees.forEach((tree,i) => {
      const {x,y,z}=tree.position, h=tree.height;
      transform.rotation.set(0,0,0);
      transform.position.set(x,y+h*.38,z);
      transform.scale.set(1,h*.76,1);
      transform.updateMatrix(); trunks.setMatrixAt(i,transform.matrix);
      const mesh=chosen.has(tree)?this.near:distant;
      for(let layer=0;layer<2;layer++) {
        const v=rand(), radius=tree.radius*(layer?.75:1);
        transform.position.set(x,y+h*(layer?.72:.48),z);
        transform.rotation.y=v*Math.PI*2;
        transform.scale.set(radius*(.82+v*.18),h*(layer?.28:.35),radius);
        transform.updateMatrix();
        const index=mesh===this.near?ni++:di++;
        mesh.setMatrixAt(index,transform.matrix);
        color.setHSL(.30+rand()*.06,.19+v*.07,.23+rand()*.10);
        mesh.setColorAt(index,color);
      }
    });
    for(const mesh of [distant,this.near,trunks]) { mesh.computeBoundingSphere(); this.group.add(mesh); }
  }
  update(preset: Preset, x: number, z: number) {
    const distance=Math.hypot(x-198.9,z-295.65);
    // Hysteresis prevents flicker at the boundary; Eco always keeps the old budget.
    const detailed=preset!=="eco" && distance<(this.detailedActive?750:650);
    if(detailed===this.detailedActive) return;
    this.detailedActive=detailed;
    this.near.geometry=detailed?this.detailed:this.coarse;
  }
  get stats() { return {pilotTrees:this.pilotTrees, detailed:this.detailedActive,
    extraCrownTriangles:this.detailedActive?this.pilotTrees*120:0}; }
}
