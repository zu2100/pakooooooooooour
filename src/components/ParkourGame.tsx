"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { CourseData, CoursePoint, Theme } from "@/lib/courseData";

interface ParkourGameProps {
  course: CourseData;
  onOpenAdmin: () => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function ParkourGame({ course, onOpenAdmin }: ParkourGameProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const blockerRef = useRef<HTMLDivElement>(null);
  const checkpointMsgRef = useRef<HTMLDivElement>(null);
  const fallMsgRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const checkpointCountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    const blocker = blockerRef.current;
    const checkpointMsg = checkpointMsgRef.current;
    const fallMsg = fallMsgRef.current;
    const lightningFlash = flashRef.current;
    const checkpointCountEl = checkpointCountRef.current;
    if (!mount || !blocker || !checkpointMsg || !fallMsg || !lightningFlash || !checkpointCountEl) return;
    const mountEl = mount as HTMLDivElement;
    const blockerEl = blocker as HTMLDivElement;
    const checkpointMsgEl = checkpointMsg as HTMLDivElement;
    const fallMsgEl = fallMsg as HTMLDivElement;
    const lightningFlashEl = lightningFlash as HTMLDivElement;
    const checkpointCountElNonNull = checkpointCountEl as HTMLDivElement;

    // -----------------------------------------------------------------------
    // 기본 씬 / 카메라 / 렌더러
    // -----------------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    scene.fog = new THREE.FogExp2(0x0a0d14, 0.007);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountEl.appendChild(renderer.domElement);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // -----------------------------------------------------------------------
    // 조명
    // -----------------------------------------------------------------------
    const hemi = new THREE.HemisphereLight(0x6f93b8, 0x10131a, 1.2);
    scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xaecbff, 1.3);
    moon.position.set(-40, 60, -30);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 200;
    moon.shadow.camera.left = -80;
    moon.shadow.camera.right = 80;
    moon.shadow.camera.top = 80;
    moon.shadow.camera.bottom = -80;
    scene.add(moon);

    const fillLight = new THREE.PointLight(0xff9a5a, 0.9, 90);
    fillLight.position.set(10, 12, 10);
    scene.add(fillLight);

    // -----------------------------------------------------------------------
    // 도시 배경: 안개 속 건물 실루엣
    // -----------------------------------------------------------------------
    const cityGroup = new THREE.Group();
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x12161f, roughness: 0.9, metalness: 0.1 });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xffdd88,
      emissive: 0xffaa44,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    });
    const platforms: { mesh: THREE.Mesh; box3: THREE.Box3 }[] = [];

    function makeBuilding(x: number, z: number, w: number, h: number, d: number) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, buildingMat);
      mesh.position.set(x, h / 2, z);
      mesh.receiveShadow = true;
      cityGroup.add(mesh);
      mesh.updateMatrixWorld(true);
      platforms.push({ mesh, box3: new THREE.Box3().setFromObject(mesh) });

      const winCount = Math.floor(h / 6);
      for (let i = 0; i < winCount; i++) {
        if (Math.random() > 0.55) continue;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 1.2), windowMat);
        win.position.set(x, 3 + i * 6, z + d / 2 + 0.05);
        cityGroup.add(win);
      }
    }

    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = rand(45, 160);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      makeBuilding(x, z, rand(8, 18), rand(20, 90), rand(8, 18));
    }
    scene.add(cityGroup);

    const groundGeo = new THREE.PlaneGeometry(2000, 2000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: 0.25, metalness: 0.6 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -60;
    ground.receiveShadow = true;
    scene.add(ground);

    // -----------------------------------------------------------------------
    // 비
    // -----------------------------------------------------------------------
    const RAIN_COUNT = 4000;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(RAIN_COUNT * 3);
    const rainVel = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainPos[i * 3 + 0] = rand(-80, 80);
      rainPos[i * 3 + 1] = rand(0, 100);
      rainPos[i * 3 + 2] = rand(-80, 80);
      rainVel[i] = rand(40, 70);
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0xbcd4ff, size: 0.18, transparent: true, opacity: 0.55 });
    const rain = new THREE.Points(rainGeo, rainMat);
    scene.add(rain);

    function updateRain(dt: number, centerX: number, centerZ: number) {
      const pos = rainGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < RAIN_COUNT; i++) {
        pos[i * 3 + 1] -= rainVel[i] * dt;
        if (pos[i * 3 + 1] < -5) {
          pos[i * 3 + 1] = rand(60, 100);
          pos[i * 3 + 0] = centerX + rand(-80, 80);
          pos[i * 3 + 2] = centerZ + rand(-80, 80);
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // -----------------------------------------------------------------------
    // 천둥 / 번개
    // -----------------------------------------------------------------------
    const moonBaseIntensity = moon.intensity;
    let audioCtx: AudioContext | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const setTimer = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.push(id);
      return id;
    };

    function initAudio() {
      if (audioCtx) return;
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    function playThunder(volume: number) {
      if (!audioCtx) return;
      const duration = 2.2;
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const lowpass = audioCtx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(900, audioCtx.currentTime);
      lowpass.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + duration);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      noise.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(audioCtx.destination);

      noise.start();
      noise.stop(audioCtx.currentTime + duration);
    }

    function flashLightning(intensity: number) {
      lightningFlashEl!.style.transition = "opacity 0.05s ease-out";
      lightningFlashEl!.style.opacity = String(intensity);
      moon.intensity = moonBaseIntensity + intensity * 6;
      setTimer(() => {
        lightningFlashEl!.style.transition = "opacity 0.25s ease-in";
        lightningFlashEl!.style.opacity = "0";
        moon.intensity = moonBaseIntensity;
      }, 70);
    }

    function triggerLightning() {
      const closeness = rand(0.4, 1.0);
      flashLightning(0.5 + closeness * 0.5);
      setTimer(() => flashLightning(0.3 + closeness * 0.3), rand(80, 160));
      const soundDelay = (1 - closeness) * 2200 + rand(100, 300);
      setTimer(() => playThunder(0.5 + closeness * 0.5), soundDelay);
    }

    function scheduleNextLightning() {
      const delay = rand(6000, 16000);
      setTimer(() => {
        triggerLightning();
        scheduleNextLightning();
      }, delay);
    }
    scheduleNextLightning();

    // -----------------------------------------------------------------------
    // 플랫폼 빌드 (코스 데이터 기반)
    // -----------------------------------------------------------------------
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x7d92a8,
      roughness: 0.45,
      metalness: 0.25,
      emissive: 0x1c2a38,
      emissiveIntensity: 0.4,
    });
    const platformEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x9fe8ff,
      emissive: 0x2a9fd6,
      emissiveIntensity: 0.9,
      roughness: 0.4,
    });
    const edgeLineMat = new THREE.LineBasicMaterial({ color: 0x9fe8ff });

    const platformMatLava = new THREE.MeshStandardMaterial({
      color: 0x8a2418,
      roughness: 0.5,
      metalness: 0.2,
      emissive: 0xff3300,
      emissiveIntensity: 0.55,
    });
    const platformEdgeMatLava = new THREE.MeshStandardMaterial({
      color: 0xffae42,
      emissive: 0xff6a00,
      emissiveIntensity: 1.1,
      roughness: 0.4,
    });
    const edgeLineMatLava = new THREE.LineBasicMaterial({ color: 0xffae42 });

    const platformMatSky = new THREE.MeshStandardMaterial({
      color: 0x4a3f8a,
      roughness: 0.4,
      metalness: 0.3,
      emissive: 0x6a4fff,
      emissiveIntensity: 0.5,
    });
    const platformEdgeMatSky = new THREE.MeshStandardMaterial({
      color: 0xbfa9ff,
      emissive: 0x9a6aff,
      emissiveIntensity: 1.1,
      roughness: 0.35,
    });
    const edgeLineMatSky = new THREE.LineBasicMaterial({ color: 0xbfa9ff });

    const THEME_MATS: Record<Theme, { base: THREE.Material; edge: THREE.Material; line: THREE.Material }> = {
      normal: { base: platformMat, edge: platformEdgeMat, line: edgeLineMat },
      lava: { base: platformMatLava, edge: platformEdgeMatLava, line: edgeLineMatLava },
      sky: { base: platformMatSky, edge: platformEdgeMatSky, line: edgeLineMatSky },
    };

    function addPlatform(
      x: number,
      y: number,
      z: number,
      w = 6,
      h = 1,
      d = 6,
      glow = false,
      theme: Theme = "normal"
    ) {
      const themeMat = THEME_MATS[theme] || THEME_MATS.normal;
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = glow ? themeMat.edge : themeMat.base;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), themeMat.line);
      mesh.add(edges);

      mesh.updateMatrixWorld(true);
      const box3 = new THREE.Box3().setFromObject(mesh);
      platforms.push({ mesh, box3 });
      return mesh;
    }

    interface CheckpointEntry {
      mesh: THREE.Mesh;
      position: THREE.Vector3;
      reached: boolean;
    }
    const checkpoints: CheckpointEntry[] = [];
    let goalPosition: THREE.Vector3 | null = null;

    interface StageClearEntry {
      position: THREE.Vector3;
      message: string;
      shown: boolean;
    }
    const stageClears: StageClearEntry[] = [];

    function buildStage(stage: CourseData["stages"][number]) {
      stage.points.forEach((p: CoursePoint) => {
        addPlatform(p.x, p.y, p.z, p.w, 1, p.d, !!(p.checkpoint || p.goal || p.stageClear), stage.theme);
        if (p.checkpoint) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(2, 0.18, 12, 32),
            new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffae42, emissiveIntensity: 1.0 })
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.set(p.x, p.y + 2.2, p.z);
          scene.add(ring);
          checkpoints.push({ mesh: ring, position: new THREE.Vector3(p.x, p.y + 1.5, p.z), reached: false });
        }
        if (p.stageClear) {
          stageClears.push({
            position: new THREE.Vector3(p.x, p.y + 1.5, p.z),
            message: stage.clearMessage || `${stage.name} 클리어!`,
            shown: false,
          });
        }
        if (p.goal) {
          goalPosition = new THREE.Vector3(p.x, p.y + 1.5, p.z);
          const flag = new THREE.Mesh(
            new THREE.ConeGeometry(1.4, 3, 16),
            new THREE.MeshStandardMaterial({ color: 0x7affb0, emissive: 0x2bff8a, emissiveIntensity: 0.8 })
          );
          flag.position.set(p.x, p.y + 2.5, p.z);
          scene.add(flag);
        }
      });
    }

    course.stages.forEach(buildStage);
    checkpointCountElNonNull.textContent = `체크포인트: 0 / ${checkpoints.length}`;

    // 장식용 작은 플랫폼들 (각 테마 구간에 분산)
    const allZ = course.stages.flatMap((s) => s.points.map((p) => p.z));
    const minZ = allZ.length ? Math.min(...allZ) : -10;
    course.stages.forEach((stage, idx) => {
      const stageZs = stage.points.map((p) => p.z);
      const zHigh = Math.max(...stageZs) + (idx === 0 ? 30 : 6);
      const zLow = Math.min(...stageZs) - 6;
      const yVals = stage.points.map((p) => p.y);
      const yLow = Math.min(...yVals) - 5;
      const yHigh = Math.max(...yVals) + 5;
      for (let i = 0; i < 18; i++) {
        const x = rand(-55, 55);
        const z = rand(zLow, zHigh);
        const y = rand(yLow, yHigh);
        if (idx === 0 && Math.abs(x) < 20 && z > zLow && z < zHigh) continue;
        if (idx > 0 && Math.abs(x) < 18) continue;
        addPlatform(x, y, z, rand(3, 6), 1, rand(3, 6), false, stage.theme);
      }
    });

    // -----------------------------------------------------------------------
    // 용암 바닥 & 분위기 전환 구간 (lava 테마 스테이지 기준 자동 계산)
    // -----------------------------------------------------------------------
    const stageIndexByTheme = course.stages.findIndex((s) => s.theme === "lava");
    let lavaZoneStartZ = -Infinity;
    let lavaZoneEndZ = -Infinity;
    let lavaCenterZ = 0;
    let lavaSurfaceY = 3;
    if (stageIndexByTheme >= 0) {
      const lavaStage = course.stages[stageIndexByTheme];
      const prevStage = course.stages[stageIndexByTheme - 1];
      const lavaZs = lavaStage.points.map((p) => p.z);
      lavaZoneStartZ = prevStage ? Math.max(...prevStage.points.map((p) => p.z)) : Math.max(...lavaZs) + 13;
      lavaZoneEndZ = Math.min(...lavaZs) - 7;
      lavaCenterZ = (lavaZoneStartZ + lavaZoneEndZ) / 2;
      lavaSurfaceY = Math.min(...lavaStage.points.map((p) => p.y)) - 12;
    }

    const lavaGround = new THREE.Mesh(
      new THREE.PlaneGeometry(160, Math.max(20, lavaZoneStartZ - lavaZoneEndZ)),
      new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff3300, emissiveIntensity: 1.3, roughness: 0.35 })
    );
    lavaGround.rotation.x = -Math.PI / 2;
    lavaGround.position.set(-2, lavaSurfaceY, lavaCenterZ);
    if (stageIndexByTheme >= 0) scene.add(lavaGround);

    const lavaLight = new THREE.PointLight(0xff5522, 1.4, 140);
    lavaLight.position.set(-2, lavaSurfaceY + 15, lavaCenterZ);
    if (stageIndexByTheme >= 0) scene.add(lavaLight);

    const COOL_BG = new THREE.Color(0x0a0d14);
    const HOT_BG = new THREE.Color(0x3a0f05);
    const COOL_FOG = new THREE.Color(0x0a0d14);
    const HOT_FOG = new THREE.Color(0x2a0e06);
    const COOL_HEMI = new THREE.Color(0x6f93b8);
    const HOT_HEMI = new THREE.Color(0xff8a3d);
    const COOL_MOON = new THREE.Color(0xaecbff);
    const HOT_MOON = new THREE.Color(0xff7a3d);

    function updateAtmosphere(playerZ: number) {
      const enter = THREE.MathUtils.clamp((lavaZoneStartZ - playerZ) / 40, 0, 1);
      const exit = THREE.MathUtils.clamp(1 - (lavaZoneEndZ - playerZ) / 40, 0, 1);
      const hotFactor = enter * exit;
      (scene.background as THREE.Color).copy(COOL_BG).lerp(HOT_BG, hotFactor);
      (scene.fog as THREE.FogExp2).color.copy(COOL_FOG).lerp(HOT_FOG, hotFactor);
      (scene.fog as THREE.FogExp2).density = 0.007 + hotFactor * 0.006;
      hemi.color.copy(COOL_HEMI).lerp(HOT_HEMI, hotFactor);
      moon.color.copy(COOL_MOON).lerp(HOT_MOON, hotFactor);
      lavaLight.intensity = 1.0 + hotFactor * 0.8 + Math.sin(performance.now() * 0.004) * 0.15;
      rainMat.opacity = 0.55 * (1 - hotFactor);
      return hotFactor;
    }

    // -----------------------------------------------------------------------
    // 플레이어
    // -----------------------------------------------------------------------
    const PLAYER_RADIUS = 0.5;
    const PLAYER_HEIGHT = 1.8;
    const GRAVITY = -28;
    const JUMP_VELOCITY = 10.5;
    const MOVE_SPEED = 9;
    const MAX_JUMPS = 2;

    const startPoint = course.stages[0]?.points[0] ?? { x: 0, y: 0, z: 0 };
    const startPos = new THREE.Vector3(startPoint.x, startPoint.y + 1 + PLAYER_HEIGHT / 2, startPoint.z);

    const player = {
      position: startPos.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      onGround: false,
      jumpsUsed: 0,
      yaw: Math.PI,
      pitch: 0,
    };
    let spaceWasDown = false;
    let lastCheckpointPos = startPos.clone();

    const playerMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT - PLAYER_RADIUS * 2, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xff7a59, roughness: 0.5 })
    );
    playerMesh.castShadow = true;
    playerMesh.visible = false;
    scene.add(playerMesh);

    // -----------------------------------------------------------------------
    // 입력 처리
    // -----------------------------------------------------------------------
    const keys: Record<string, boolean> = {};
    const navKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (navKeys.has(e.code)) e.preventDefault();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    let pointerLocked = false;
    const handleBlockerClick = () => {
      renderer.domElement.requestPointerLock();
      initAudio();
    };
    blockerEl.addEventListener("click", handleBlockerClick);

    const handlePointerLockChange = () => {
      pointerLocked = document.pointerLockElement === renderer.domElement;
      blockerEl.style.display = pointerLocked ? "none" : "flex";
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    const handleMouseMove = (e: MouseEvent) => {
      if (!pointerLocked) return;
      const sensitivity = 0.0022;
      player.yaw -= e.movementX * sensitivity;
      player.pitch -= e.movementY * sensitivity;
      player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, player.pitch));
    };
    document.addEventListener("mousemove", handleMouseMove);

    // -----------------------------------------------------------------------
    // 충돌 / 물리
    // -----------------------------------------------------------------------
    function getPlayerBox(pos: THREE.Vector3) {
      return new THREE.Box3(
        new THREE.Vector3(pos.x - PLAYER_RADIUS, pos.y - PLAYER_HEIGHT / 2, pos.z - PLAYER_RADIUS),
        new THREE.Vector3(pos.x + PLAYER_RADIUS, pos.y + PLAYER_HEIGHT / 2, pos.z + PLAYER_RADIUS)
      );
    }

    function resolveCollisions(nextPos: THREE.Vector3, velocity: THREE.Vector3) {
      let onGround = false;

      let testPos = nextPos.clone();
      let box = getPlayerBox(testPos);
      for (const p of platforms) {
        if (!box.intersectsBox(p.box3)) continue;
        const pb = p.box3;
        const overlapTop = testPos.y - PLAYER_HEIGHT / 2 - pb.max.y;
        const overlapBottom = pb.min.y - (testPos.y + PLAYER_HEIGHT / 2);
        if (velocity.y <= 0 && Math.abs(overlapTop) < 1.2 && testPos.y - PLAYER_HEIGHT / 2 + velocity.y * 0.02 <= pb.max.y) {
          testPos.y = pb.max.y + PLAYER_HEIGHT / 2;
          velocity.y = 0;
          onGround = true;
        } else if (velocity.y > 0 && Math.abs(overlapBottom) < 1.2) {
          testPos.y = pb.min.y - PLAYER_HEIGHT / 2;
          velocity.y = 0;
        }
      }

      box = getPlayerBox(testPos);
      for (const p of platforms) {
        if (!box.intersectsBox(p.box3)) continue;
        const pb = p.box3;
        if (testPos.y - PLAYER_HEIGHT / 2 >= pb.max.y - 0.05) continue;

        const dx1 = pb.max.x - (testPos.x - PLAYER_RADIUS);
        const dx2 = testPos.x + PLAYER_RADIUS - pb.min.x;
        const dz1 = pb.max.z - (testPos.z - PLAYER_RADIUS);
        const dz2 = testPos.z + PLAYER_RADIUS - pb.min.z;
        const minPush = Math.min(dx1, dx2, dz1, dz2);
        if (minPush === dx1) testPos.x += dx1;
        else if (minPush === dx2) testPos.x -= dx2;
        else if (minPush === dz1) testPos.z += dz1;
        else if (minPush === dz2) testPos.z -= dz2;
      }

      return { pos: testPos, onGround };
    }

    // -----------------------------------------------------------------------
    // 체크포인트 / 추락 처리
    // -----------------------------------------------------------------------
    let msgTimer = 0;
    let fallMsgTimer = 0;
    let reachedCount = 0;
    let gameWon = false;

    function checkCheckpoints() {
      for (const cp of checkpoints) {
        if (cp.reached) continue;
        if (player.position.distanceTo(cp.position) < 3.2) {
          cp.reached = true;
          reachedCount++;
          lastCheckpointPos = cp.position.clone();
          (cp.mesh.material as THREE.MeshStandardMaterial).color.set(0x6fffb0);
          (cp.mesh.material as THREE.MeshStandardMaterial).emissive.set(0x2bff8a);
          checkpointCountElNonNull.textContent = `체크포인트: ${reachedCount} / ${checkpoints.length}`;
          checkpointMsgEl.textContent = "체크포인트 통과!";
          checkpointMsgEl.style.opacity = "1";
          msgTimer = 1.6;
        }
      }
      for (const sc of stageClears) {
        if (!sc.shown && player.position.distanceTo(sc.position) < 4) {
          sc.shown = true;
          lastCheckpointPos = sc.position.clone();
          checkpointMsgEl.textContent = sc.message;
          checkpointMsgEl.style.opacity = "1";
          msgTimer = 2.4;
        }
      }
      if (!gameWon && goalPosition && player.position.distanceTo(goalPosition) < 4) {
        gameWon = true;
        checkpointMsgEl.textContent = "도착! 파쿠르 완주 🎉";
        checkpointMsgEl.style.opacity = "1";
        msgTimer = 4;
      }
    }

    function checkFall() {
      const inLavaZone = player.position.z < lavaZoneStartZ && player.position.z > lavaZoneEndZ;
      const failY = inLavaZone ? lavaSurfaceY : -20;
      if (player.position.y < failY) {
        player.position.copy(lastCheckpointPos).add(new THREE.Vector3(0, 1, 0));
        player.velocity.set(0, 0, 0);
        player.jumpsUsed = 0;
        fallMsgEl.textContent = inLavaZone
          ? "용암에 빠졌다... 마지막 체크포인트에서 다시 시작합니다"
          : "추락... 마지막 체크포인트에서 다시 시작합니다";
        fallMsgEl.style.opacity = "1";
        fallMsgTimer = 1.8;
      }
    }

    // -----------------------------------------------------------------------
    // 메인 루프
    // -----------------------------------------------------------------------
    const clock = new THREE.Clock();
    let rafId = 0;

    function animate() {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      if (pointerLocked) {
        const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
        const right = new THREE.Vector3(Math.sin(player.yaw + Math.PI / 2), 0, Math.cos(player.yaw + Math.PI / 2));

        const moveDir = new THREE.Vector3();
        if (keys["KeyW"] || keys["ArrowUp"]) moveDir.sub(forward);
        if (keys["KeyS"] || keys["ArrowDown"]) moveDir.add(forward);
        if (keys["KeyA"] || keys["ArrowLeft"]) moveDir.sub(right);
        if (keys["KeyD"] || keys["ArrowRight"]) moveDir.add(right);
        if (moveDir.lengthSq() > 0) moveDir.normalize().multiplyScalar(MOVE_SPEED);

        player.velocity.x = moveDir.x;
        player.velocity.z = moveDir.z;

        player.velocity.y += GRAVITY * dt;
        const spaceIsDown = !!keys["Space"];
        if (spaceIsDown && !spaceWasDown && player.jumpsUsed < MAX_JUMPS) {
          player.velocity.y = JUMP_VELOCITY;
          player.onGround = false;
          player.jumpsUsed++;
        }
        spaceWasDown = spaceIsDown;

        const nextPos = player.position.clone();
        nextPos.x += player.velocity.x * dt;
        nextPos.y += player.velocity.y * dt;
        nextPos.z += player.velocity.z * dt;

        const result = resolveCollisions(nextPos, player.velocity);
        player.position.copy(result.pos);
        player.onGround = result.onGround;
        if (player.onGround) player.jumpsUsed = 0;

        checkCheckpoints();
        checkFall();
      }

      camera.position.copy(player.position);
      camera.rotation.order = "YXZ";
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

      playerMesh.position.copy(player.position);
      playerMesh.rotation.y = player.yaw;

      fillLight.position.set(player.position.x + 5, player.position.y + 10, player.position.z + 5);

      updateRain(dt, player.position.x, player.position.z);
      updateAtmosphere(player.position.z);

      if (msgTimer > 0) {
        msgTimer -= dt;
        if (msgTimer <= 0) checkpointMsgEl.style.opacity = "0";
      }
      if (fallMsgTimer > 0) {
        fallMsgTimer -= dt;
        if (fallMsgTimer <= 0) fallMsgEl.style.opacity = "0";
      }

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      blockerEl.removeEventListener("click", handleBlockerClick);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("mousemove", handleMouseMove);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      renderer.dispose();
      if (renderer.domElement.parentElement === mountEl) mountEl.removeChild(renderer.domElement);
      audioCtx?.close().catch(() => {});
    };
  }, [course]);

  return (
    <div ref={mountRef} className="relative h-screen w-screen overflow-hidden bg-[#05060a]">
      <div className="pointer-events-none absolute left-4 top-4 z-[5] text-sm leading-relaxed text-sky-100 [text-shadow:0_0_6px_rgba(0,0,0,0.8)]">
        <h1 className="m-0 mb-1.5 text-xl font-semibold tracking-wide text-sky-300">3D 파쿠우우우르</h1>
        <div>WASD / 방향키 : 이동 &nbsp;/&nbsp; SPACE : 점프(2단 가능) &nbsp;/&nbsp; 마우스 : 시야</div>
        <div ref={checkpointCountRef}>체크포인트: 0 / 0</div>
      </div>

      <button
        onClick={onOpenAdmin}
        className="absolute right-4 top-4 z-20 rounded-md border border-sky-700/60 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-sky-200 backdrop-blur-sm transition hover:bg-slate-800/80"
      >
        관리자 모드
      </button>

      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 z-[7] bg-[#eaf3ff] opacity-0"
      />

      <div
        ref={checkpointMsgRef}
        className="pointer-events-none absolute left-1/2 top-[40%] z-[6] -translate-x-1/2 -translate-y-1/2 text-2xl font-bold text-amber-200 opacity-0 transition-opacity duration-300 [text-shadow:0_0_12px_rgba(0,0,0,0.9)]"
      >
        체크포인트 통과!
      </div>

      <div
        ref={fallMsgRef}
        className="pointer-events-none absolute bottom-[18%] left-1/2 z-[6] -translate-x-1/2 text-lg text-red-300 opacity-0 transition-opacity duration-300 [text-shadow:0_0_8px_rgba(0,0,0,0.9)]"
      >
        추락... 마지막 체크포인트에서 다시 시작합니다
      </div>

      <div
        ref={blockerRef}
        className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/60 text-center text-white"
      >
        <div className="max-w-[480px] rounded-lg border border-sky-800/70 bg-slate-950/85 px-8 py-6">
          <h2 className="mt-0 text-sky-300">3D 파쿠우우우르</h2>
          <p className="text-sm leading-relaxed text-emerald-50">
            비 내리는 도시 위, 둥둥 떠 있는 사각 플랫폼을 밟고 건너가는 여가용 파쿠르 게임입니다.
            <br />
            <br />
            WASD로 이동, SPACE로 점프, 마우스로 시야를 조작하세요.
            <br />
            플랫폼에서 떨어지면 마지막 체크포인트에서 다시 시작합니다.
            <br />
            <br />
            <b>클릭하여 시작</b>
          </p>
        </div>
      </div>
    </div>
  );
}
