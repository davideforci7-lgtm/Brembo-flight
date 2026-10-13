// SPDX-License-Identifier: AGPL-3.0-only
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GraphicsGovernor, PRESETS, renderSize } from "./core/graphics";
import type { Quality } from "./core/settings";
import { type FlightSimulation } from "./core/flight";
import {
  type TerrainProvider,
  type Obstacle,
  riverX,
  WATER_LEVEL,
} from "./core/terrain";
import { type Checkpoint } from "./core/course";
import { clamp, seededRandom } from "./core/math";

export class FlightWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.1, 2500);
  private drone = new THREE.Group();
  private rotors: THREE.Mesh[] = [];
  private rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>[] =
    [];
  private markers: THREE.Group[] = [];
  private targetCamera = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private look = new THREE.Vector3();
  private shadow: THREE.Mesh;
  private water: THREE.Mesh;
  private sun = new THREE.DirectionalLight("#ffe2b7", 2.4);
  private waterTime = { value: 0 };
  readonly graphics = new GraphicsGovernor(
    "auto",
    matchMedia("(pointer: coarse)").matches || innerWidth < 800,
  );
  private smoothedYaw = 0;
  private time = 0;
  mode: "chase" | "fpv" = "chase";
  quality: Quality = "auto";
  private snap = true;
  constructor(
    canvas: HTMLCanvasElement,
    readonly terrain: TerrainProvider,
    trees: Obstacle[],
    checkpoints: Checkpoint[],
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color("#b9cdd0");
    this.scene.fog = new THREE.FogExp2("#b9cdd0", 0.00165);
    this.scene.add(new THREE.HemisphereLight("#eaf6f2", "#7d8260", 1.8));
    this.sun.position.set(-240, 360, -170);
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -18,
      right: 18,
      top: 18,
      bottom: -18,
      near: 1,
      far: 250,
    });
    this.sun.shadow.bias = -0.0008;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(this.sun, this.sun.target);
    this.addSky();
    this.addTerrain();
    this.water = this.addRiver();
    this.addDistantMountains();
    this.addTrees(trees);
    this.addLaunchPad();
    this.addCourse(checkpoints);
    this.addDrone();
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 20),
      new THREE.MeshBasicMaterial({
        color: "#153e38",
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
    window.addEventListener("resize", () => this.resize());
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    window.visualViewport?.addEventListener("resize", () => this.resize());
    this.setQuality("auto");
  }
  setQuality(value: Quality) {
    this.quality = value;
    this.graphics.select(value);
    this.applyPreset();
  }
  private applyPreset() {
    this.renderer.shadowMap.enabled = PRESETS[this.graphics.preset].shadows;
    this.sun.castShadow = PRESETS[this.graphics.preset].shadows;
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials) material.needsUpdate = true;
      }
    });
    this.resize();
  }
  resize() {
    const { width, height } = this.renderer.domElement.getBoundingClientRect();
    const size = renderSize(
      width,
      height,
      devicePixelRatio,
      this.graphics.preset,
    );
    // CSS owns the visible dimensions; the drawing buffer never stretches from old orientation.
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size.width, size.height, false);
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    // Keep the drone readable on short landscape screens without changing its physical size.
    this.camera.fov = THREE.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(THREE.MathUtils.degToRad(64) / 2) *
            Math.min(1, Math.max(0.68, height / 520)),
        ),
    );
    this.camera.updateProjectionMatrix();
    this.snap = true;
  }
  diagnostics() {
    const canvas = this.renderer.domElement;
    return {
      fps: Math.round(this.graphics.fps),
      preset: this.graphics.preset,
      width: canvas.width,
      height: canvas.height,
      antialias:
        this.renderer.getContext().getContextAttributes()?.antialias ?? false,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }
  toggleCamera() {
    this.mode = this.mode === "chase" ? "fpv" : "chase";
    this.snap = true;
  }
  resetCamera() {
    this.snap = true;
  }
  render(flight: FlightSimulation, dt: number) {
    if (this.graphics.observe(dt, flight.status === "flying"))
      this.applyPreset();
    this.time += Math.min(dt, 0.1);
    const p = flight.position,
      moving = flight.status === "flying";
    const a = 1 - Math.exp(-7 * dt);
    this.drone.position.set(p.x, p.y, p.z);
    this.drone.rotation.order = "YXZ";
    this.drone.rotation.y = flight.yaw;
    const forwardSpeed =
      -flight.velocity.x * Math.sin(flight.yaw) -
      flight.velocity.z * Math.cos(flight.yaw);
    const rightSpeed =
      flight.velocity.x * Math.cos(flight.yaw) -
      flight.velocity.z * Math.sin(flight.yaw);
    this.drone.rotation.x = THREE.MathUtils.lerp(
      this.drone.rotation.x,
      -forwardSpeed * 0.01,
      a,
    );
    this.drone.rotation.z = THREE.MathUtils.lerp(
      this.drone.rotation.z,
      -rightSpeed * 0.015,
      a,
    );
    for (let i = 0; i < this.rotors.length; i++)
      this.rotors[i].rotation.y += dt * (moving ? 65 : 10) * (i % 2 ? -1 : 1);
    this.drone.visible = this.mode !== "fpv" || flight.status === "ready";
    const ground = Math.max(this.terrain.heightAt(p.x, p.z), WATER_LEVEL);
    this.shadow.position.set(p.x, ground + 0.12, p.z);
    this.shadow.scale.setScalar(1 + (p.y - ground) * 0.02);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = clamp(
      0.3 - (p.y - ground) * 0.004,
      0,
      0.25,
    );
    for (let i = 0; i < this.rings.length; i++) {
      const active = i === flight.nextCheckpoint,
        passed = i < flight.nextCheckpoint;
      this.rings[i].material.color.set(
        passed ? "#5cd8ba" : active ? "#ffae63" : "#d1e3d8",
      );
      this.rings[i].material.emissive.set(active ? "#ed7845" : "#0d231d");
      this.rings[i].material.emissiveIntensity = active
        ? 0.7 + Math.sin(this.time * 3) * 0.15
        : 0.2;
      this.rings[i].material.opacity = passed ? 0.3 : active ? 1 : 0.42;
      this.markers[i].visible = active && flight.mode === "course";
      this.rings[i].visible = flight.mode === "course";
    }
    if (flight.status === "ready") {
      this.targetCamera.set(
        p.x + 20 + Math.sin(this.time * 0.1) * 5,
        p.y + 12,
        p.z + 32,
      );
      this.targetLook.set(p.x - 20, p.y + 9, p.z - 145);
    } else if (this.mode === "fpv") {
      this.targetCamera.set(p.x, p.y + 0.22, p.z);
      this.targetLook.set(
        p.x - Math.sin(flight.yaw) * 50,
        p.y - 1.7,
        p.z - Math.cos(flight.yaw) * 50,
      );
    } else {
      this.smoothedYaw +=
        Math.atan2(
          Math.sin(flight.yaw - this.smoothedYaw),
          Math.cos(flight.yaw - this.smoothedYaw),
        ) * (this.snap ? 1 : a);
      this.targetCamera.set(
        p.x + Math.sin(this.smoothedYaw) * 11.8,
        p.y + 4.8,
        p.z + Math.cos(this.smoothedYaw) * 11.8,
      );
      this.targetLook.set(
        p.x - Math.sin(flight.yaw) * 16,
        p.y - 3.0,
        p.z - Math.cos(flight.yaw) * 16,
      );
    }
    this.targetCamera.y = Math.max(
      this.targetCamera.y,
      this.terrain.heightAt(this.targetCamera.x, this.targetCamera.z) + 2,
      WATER_LEVEL + 1.5,
    );
    this.camera.position.lerp(
      this.targetCamera,
      this.snap || this.mode === "fpv" ? 1 : 1 - Math.exp(-5 * dt),
    );
    this.camera.position.y = Math.max(
      this.camera.position.y,
      this.terrain.heightAt(this.camera.position.x, this.camera.position.z) +
        1.2,
    );
    this.look.lerp(this.targetLook, this.snap || this.mode === "fpv" ? 1 : a);
    this.camera.lookAt(this.look);
    this.snap = false;
    (this.water.material as THREE.MeshStandardMaterial).roughness =
      0.39 + Math.sin(this.time * 0.4) * 0.025;
    this.waterTime.value = this.time;
    this.sun.position.set(p.x - 60, p.y + 90, p.z - 40);
    this.sun.target.position.set(p.x, p.y, p.z);
    this.renderer.render(this.scene, this.camera);
  }
  projectTarget(position: { x: number; y: number; z: number }) {
    const world = new THREE.Vector3(position.x, position.y, position.z);
    const local = this.camera.worldToLocal(world.clone());
    const projected = world.project(this.camera);
    return { x: projected.x, y: projected.y, behind: local.z > 0 };
  }
  private addTerrain() {
    const geometry = new THREE.BufferGeometry();
    const verts: number[] = [],
      indices: number[] = [];
    const n = this.terrain.segments,
      size = this.terrain.size;
    for (let z = 0; z <= n; z++)
      for (let x = 0; x <= n; x++) {
        verts.push(
          (x / n) * size - size / 2,
          this.terrain.heights[z * (n + 1) + x],
          (z / n) * size - size / 2,
        );
      }
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const i = z * (n + 1) + x;
        indices.push(i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2);
      }
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(verts, 3),
    );
    geometry.setIndex(indices);
    // Keep the collision triangles and elevation grid; smooth only their lighting.
    geometry.computeVertexNormals();
    const pos = geometry.attributes.position,
      normals = geometry.attributes.normal;
    const colors: number[] = [],
      color = new THREE.Color(),
      grass = new THREE.Color("#526a42"),
      rock = new THREE.Color("#838681");
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i),
        slope = normals.getY(i);
      const variation =
        Math.sin(pos.getX(i) * 0.031) * Math.cos(pos.getZ(i) * 0.025);
      color
        .copy(grass)
        .lerp(rock, clamp((h - 60) / 95 + (0.84 - slope) * 3, 0, 1));
      if (h > 139)
        color.lerp(new THREE.Color("#e2e0d5"), clamp((h - 139) / 23, 0, 0.85));
      if (h < 3.8) color.set("#9d9f7c");
      color.multiplyScalar(0.94 + variation * 0.065);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    );
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }
  private addRiver() {
    const vertices: number[] = [],
      indices: number[] = [],
      n = 420;
    for (let i = 0; i <= n; i++) {
      const z = -810 + (i / n) * 1620,
        x = riverX(z),
        width = 18.8;
      vertices.push(x - width, WATER_LEVEL, z, x + width, WATER_LEVEL, z);
      if (i < n) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const water = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: "#439c9b",
        roughness: 0.4,
        metalness: 0.26,
      }),
    );
    // A few sine ripples in the material, no reflection pass or texture downloads.
    water.material.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterTime = this.waterTime;
      shader.vertexShader =
        "varying vec3 vRiverPosition;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvRiverPosition = position;",
        );
      shader.fragmentShader =
        "uniform float uWaterTime; varying vec3 vRiverPosition;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          "#include <color_fragment>\nfloat ripple = sin(vRiverPosition.z * 1.8 + uWaterTime * 1.5 + sin(vRiverPosition.x * 0.8)) * sin(vRiverPosition.x * 2.2 - uWaterTime); diffuseColor.rgb *= 0.95 + ripple * 0.09;",
        );
    };
    this.scene.add(water);
    const lines: number[] = [],
      rand = seededRandom(28);
    for (let i = 0; i < 330; i++) {
      const z = -770 + rand() * 1540,
        x = riverX(z) + (rand() - 0.5) * 26;
      lines.push(
        x,
        WATER_LEVEL + 0.06,
        z,
        x + 0.2,
        WATER_LEVEL + 0.06,
        z - 1.5 - rand() * 4,
      );
    }
    const glints = new THREE.BufferGeometry();
    glints.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    this.scene.add(
      new THREE.LineSegments(
        glints,
        new THREE.LineBasicMaterial({
          color: "#c1e5d6",
          transparent: true,
          opacity: 0.28,
        }),
      ),
    );
    return water;
  }
  private addSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1900, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader:
          "varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "varying vec3 vPosition; void main(){float h=normalize(vPosition).y; vec3 c=mix(vec3(0.86,0.85,0.75),vec3(0.35,0.57,0.65),smoothstep(-0.1,0.9,h)); gl_FragColor=vec4(c,1.0);}",
      }),
    );
    this.scene.add(sky);
    const disk = new THREE.Mesh(
      new THREE.SphereGeometry(31, 20, 12),
      new THREE.MeshBasicMaterial({ color: "#fff1cb", fog: false }),
    );
    disk.position.set(-620, 350, -1400);
    this.scene.add(disk);
  }
  private addDistantMountains() {
    // Connected, irregular horizon ridges. Decorative only, outside the playable boundary.
    const segments = 192,
      rows = 8,
      vertices: number[] = [],
      indices: number[] = [],
      colors: number[] = [];
    const color = new THREE.Color();
    for (let row = 0; row <= rows; row++)
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2,
          r = 820 + row * 120;
        const ridge =
          220 +
          100 * Math.sin(angle * 5.0 + row * 0.4) +
          70 * Math.cos(angle * 11 - row * 0.7) +
          32 * Math.sin(angle * 29);
        const h =
          row === 0 ? -25 : ridge * Math.sin((row / rows) * Math.PI * 0.85);
        vertices.push(Math.sin(angle) * r, h, Math.cos(angle) * r);
        color.set(h > 280 ? "#bbc5bf" : "#607975");
        colors.push(color.r, color.g, color.b);
        if (row < rows && i < segments) {
          const n = row * (segments + 1) + i;
          indices.push(
            n,
            n + 1,
            n + segments + 1,
            n + 1,
            n + segments + 2,
            n + segments + 1,
          );
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    this.scene.add(
      new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
      ),
    );
  }
  private addTrees(trees: Obstacle[]) {
    const crown = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 7),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        flatShading: true,
        roughness: 1,
      }),
      trees.length * 2,
    );
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.1, 0.15, 1, 5),
      new THREE.MeshStandardMaterial({ color: "#63513b", roughness: 1 }),
      trees.length,
    );
    const matrix = new THREE.Object3D(),
      color = new THREE.Color(),
      rand = seededRandom(8);
    trees.forEach((tree, i) => {
      const { x, y, z } = tree.position,
        h = tree.height;
      matrix.position.set(x, y + h * 0.38, z);
      matrix.scale.set(1, h * 0.76, 1);
      matrix.updateMatrix();
      trunks.setMatrixAt(i, matrix.matrix);
      for (let layer = 0; layer < 2; layer++) {
        matrix.position.set(x, y + h * (layer ? 0.72 : 0.48), z);
        matrix.scale.set(
          tree.radius * (layer ? 0.75 : 1),
          h * (layer ? 0.56 : 0.65),
          tree.radius * (layer ? 0.75 : 1),
        );
        matrix.updateMatrix();
        crown.setMatrixAt(i * 2 + layer, matrix.matrix);
        color.setHSL(0.36 + rand() * 0.04, 0.21, 0.2 + rand() * 0.13);
        crown.setColorAt(i * 2 + layer, color);
      }
    });
    crown.computeBoundingSphere();
    trunks.computeBoundingSphere();
    this.scene.add(crown, trunks);
  }
  private addLaunchPad() {
    const y = this.terrain.heightAt(28, 180) + 0.1;
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 5.5, 0.18, 48),
      new THREE.MeshStandardMaterial({ color: "#2b4846", roughness: 1 }),
    );
    pad.position.set(28, y, 180);
    this.scene.add(pad);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.6, 4.8, 48),
      new THREE.MeshBasicMaterial({ color: "#e7d9a7", side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(28, y + 0.12, 180);
    this.scene.add(ring);
    const lineMat = new THREE.MeshBasicMaterial({ color: "#e7d9a7" });
    for (const x of [-1.2, 1.2]) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.03, 3),
        lineMat,
      );
      line.position.set(28 + x, y + 0.12, 180);
      this.scene.add(line);
    }
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.03, 0.32),
      lineMat,
    );
    cross.position.set(28, y + 0.12, 180);
    this.scene.add(cross);
  }
  private addCourse(checkpoints: Checkpoint[]) {
    checkpoints.forEach((gate) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(gate.radius, 0.23, 6, 64),
        new THREE.MeshStandardMaterial({
          color: "#ffae63",
          emissive: "#ed7845",
          emissiveIntensity: 0.7,
          transparent: true,
          roughness: 0.6,
        }),
      );
      ring.position.set(gate.position.x, gate.position.y, gate.position.z);
      ring.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(gate.normal.x, 0, gate.normal.z),
      );
      this.scene.add(ring);
      this.rings.push(ring);
      const group = new THREE.Group();
      group.position.copy(ring.position);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, gate.position.y, 6),
        new THREE.MeshBasicMaterial({
          color: "#ffbf82",
          transparent: true,
          opacity: 0.45,
        }),
      );
      beam.position.y = -gate.position.y / 2 - gate.radius;
      group.add(beam);
      const diamond = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.65),
        new THREE.MeshBasicMaterial({ color: "#ffe0a9" }),
      );
      diamond.position.y = gate.radius + 2.6;
      group.add(diamond);
      this.scene.add(group);
      this.markers.push(group);
    });
  }
  private addDrone() {
    const charcoal = new THREE.MeshStandardMaterial({
      color: "#263837",
      roughness: 0.6,
      metalness: 0.35,
    });
    const orange = new THREE.MeshStandardMaterial({
      color: "#ed9564",
      roughness: 0.42,
      metalness: 0.25,
    });
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(0.85, 0.3, 1.5, 2, 0.09),
      orange,
    );
    this.drone.add(body);
    const ivory = new THREE.MeshStandardMaterial({
      color: "#f2dfba",
      roughness: 0.45,
      metalness: 0.15,
    });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.045, 1.12, 3, 7),
        charcoal,
      );
      rail.rotation.x = Math.PI / 2;
      rail.position.set(side * 0.35, -0.39, 0.1);
      this.drone.add(rail);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.02, 1.02),
        ivory,
      );
      stripe.position.set(side * 0.28, 0.158, 0);
      this.drone.add(stripe);
      for (const z of [-0.38, 0.48]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6),
          charcoal,
        );
        leg.position.set(side * 0.35, -0.25, z);
        this.drone.add(leg);
      }
    }
    const battery = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.8),
      charcoal,
    );
    battery.position.y = 0.2;
    this.drone.add(battery);
    const cam = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.26, 0.25),
      charcoal,
    );
    cam.position.set(0, -0.18, -0.77);
    this.drone.add(cam);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.1, 12),
      new THREE.MeshStandardMaterial({
        color: "#70bace",
        metalness: 0.7,
        roughness: 0.1,
      }),
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, -0.18, -0.92);
    this.drone.add(lens);
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.1, 0.14),
          charcoal,
        );
        arm.position.set(x * 0.5, 0, z * 0.5);
        arm.rotation.y = (-x * z * Math.PI) / 4;
        this.drone.add(arm);
        const motor = new THREE.Mesh(
          new THREE.CylinderGeometry(0.17, 0.17, 0.18, 12),
          charcoal,
        );
        motor.position.set(x, 0.09, z);
        this.drone.add(motor);
        const prop = new THREE.Mesh(
          new THREE.BoxGeometry(1.18, 0.024, 0.1),
          charcoal,
        );
        prop.position.set(x, 0.2, z);
        this.drone.add(prop);
        this.rotors.push(prop);
        const guard = new THREE.Mesh(
          new THREE.TorusGeometry(0.6, 0.022, 4, 24),
          charcoal,
        );
        guard.rotation.x = Math.PI / 2;
        guard.position.set(x, 0.16, z);
        this.drone.add(guard);
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 6, 6),
          new THREE.MeshBasicMaterial({ color: z < 0 ? "#86ffd9" : "#ffae77" }),
        );
        led.position.set(x, 0, z * 1.16);
        this.drone.add(led);
      }
    this.drone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    this.scene.add(this.drone);
  }
}
