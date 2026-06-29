"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CourseData, CoursePoint, Theme } from "@/lib/courseData";

export type GizmoMode = "translate" | "scale";
export type PointSelection = { stageId: string; pointIndex: number } | null;

interface ParkourGameProps {
  course: CourseData;
  onOpenAdmin: () => void;
  /** 관리자 모드 + 로그인 상태일 때만 true. 켜지면 1인칭 조작이 멈추고 자유 카메라 + 플랫폼 선택/이동/크기조절이 활성화됨 */
  editMode?: boolean;
  gizmoMode?: GizmoMode;
  /** 기즈모로 플랫폼을 옮기거나 크기를 조절할 때마다 호출 (드래그 중 연속 호출) */
  onPointChange?: (stageId: string, pointIndex: number, patch: Partial<CoursePoint>) => void;
  /** 3D 화면에서 플랫폼을 클릭해 선택/해제했을 때 호출 */
  onMeshSelected?: (selection: PointSelection) => void;
}

export interface ParkourGameHandle {
  /** 관리자 편집 중인 코스 데이터를 즉시 3D 장면에 반영 (플레이어 위치는 유지) */
  previewCourse: (course: CourseData) => void;
  /** 특정 플랫폼을 3D 화면에서 선택 상태로 만들고 기즈모를 붙임 */
  selectPoint: (stageId: string, pointIndex: number) => void;
  /** 선택 해제 */
  deselectPoint: () => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const ParkourGame = forwardRef<ParkourGameHandle, ParkourGameProps>(function ParkourGame(
  { course, onOpenAdmin, editMode, gizmoMode, onPointChange, onMeshSelected },
  ref
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const blockerRef = useRef<HTMLDivElement>(null);
  const checkpointMsgRef = useRef<HTMLDivElement>(null);
  const fallMsgRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const checkpointCountRef = useRef<HTMLDivElement>(null);
  const applyCourseRef = useRef<(course: CourseData) => void>(() => {});
  const selectPointRef = useRef<(stageId: string, pointIndex: number) => void>(() => {});
  const deselectPointRef = useRef<() => void>(() => {});

  const editModeRef = useRef(false);
  const gizmoModeRef = useRef<GizmoMode>("translate");
  const onPointChangeRef = useRef(onPointChange);
  const onMeshSelectedRef = useRef(onMeshSelected);
  const syncEditModeRef = useRef<((enabled: boolean) => void) | null>(null);
  const syncGizmoModeRef = useRef<((mode: GizmoMode) => void) | null>(null);

  useImperativeHandle(ref, () => ({
    previewCourse: (newCourse: CourseData) => applyCourseRef.current(newCourse),
    selectPoint: (stageId: string, pointIndex: number) => selectPointRef.current(stageId, pointIndex),
    deselectPoint: () => deselectPointRef.current(),
  }));

  useEffect(() => {
    onPointChangeRef.current = onPointChange;
  }, [onPointChange]);

  useEffect(() => {
    onMeshSelectedRef.current = onMeshSelected;
  }, [onMeshSelected]);

  useEffect(() => {
    editModeRef.current = !!editMode;
    syncEditModeRef.current?.(!!editMode);
  }, [editMode]);

  useEffect(() => {
    gizmoModeRef.current = gizmoMode ?? "translate";
    syncGizmoModeRef.current?.(gizmoModeRef.current);
  }, [gizmoMode]);

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
    // 관리자 모드: 자유 카메라(OrbitControls) + 플랫폼 선택/이동/크기조절(TransformControls)
    // -----------------------------------------------------------------------
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enabled = false;
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.1;
    orbitControls.maxDistance = 400;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.enabled = false;
    transformControls.setSize(0.9);
    scene.add(transformControls.getHelper());

    transformControls.addEventListener("dragging-changed", (event) => {
      orbitControls.enabled = !event.value && editModeRef.current;
    });

    const editableMeshes: { mesh: THREE.Mesh; stageId: string; pointIndex: number }[] = [];
    let currentSelection: { stageId: string; pointIndex: number } | null = null;
    const editRaycaster = new THREE.Raycaster();

    function findEditable(mesh: THREE.Object3D | null) {
      if (!mesh) return undefined;
      return editableMeshes.find((e) => e.mesh === mesh);
    }

    function selectMesh(entry: { mesh: THREE.Mesh; stageId: string; pointIndex: number }) {
      currentSelection = { stageId: entry.stageId, pointIndex: entry.pointIndex };
      transformControls.attach(entry.mesh);
      onMeshSelectedRef.current?.(currentSelection);
    }

    function clearSelection() {
      currentSelection = null;
      transformControls.detach();
      onMeshSelectedRef.current?.(null);
    }

    selectPointRef.current = (stageId, pointIndex) => {
      const entry = editableMeshes.find((e) => e.stageId === stageId && e.pointIndex === pointIndex);
      if (entry) selectMesh(entry);
    };
    deselectPointRef.current = () => clearSelection();

    transformControls.addEventListener("objectChange", () => {
      if (!currentSelection) return;
      const obj = transformControls.object;
      if (!obj) return;
      const patch: Partial<CoursePoint> = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
      if (gizmoModeRef.current === "scale") {
        const base = obj.userData as { baseW?: number; baseD?: number };
        if (base.baseW) patch.w = Math.max(1, Math.round(base.baseW * obj.scale.x * 10) / 10);
        if (base.baseD) patch.d = Math.max(1, Math.round(base.baseD * obj.scale.z * 10) / 10);
      }
      // 드래그 중에도 충돌용 box3을 최신 위치/크기로 갱신 (재빌드 없이도 물리와 어긋나지 않도록)
      obj.updateMatrixWorld(true);
      const platformEntry = platforms.find((p) => p.mesh === obj);
      if (platformEntry) platformEntry.box3.setFromObject(obj);
      onPointChangeRef.current?.(currentSelection.stageId, currentSelection.pointIndex, patch);
    });

    const handleEditClick = (e: MouseEvent) => {
      if (!editModeRef.current || transformControls.dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      editRaycaster.setFromCamera(ndc, camera);
      const hits = editRaycaster.intersectObjects(editableMeshes.map((e) => e.mesh), false);
      if (hits.length > 0) {
        const entry = findEditable(hits[0].object);
        if (entry) selectMesh(entry);
      } else {
        clearSelection();
      }
    };
    renderer.domElement.addEventListener("click", handleEditClick);

    syncEditModeRef.current = (enabled: boolean) => {
      orbitControls.enabled = enabled;
      transformControls.enabled = enabled;
      // 편집 중에는 "클릭하여 시작" 안내창이 캔버스 클릭을 가로채지 않도록 숨기고,
      // 마우스 커서도 항상 보이게 함 (포인터 락이 걸려있지 않으므로 보통 자동으로 보이지만 명시적으로 보장)
      blockerEl.style.display = enabled ? "none" : "flex";
      renderer.domElement.style.cursor = enabled ? "default" : "";
      if (!enabled) {
        clearSelection();
        return;
      }
      // 편집 모드로 들어갈 때 플레이어가 보던 방향 앞쪽을 자유 카메라의 시점 기준으로 삼음
      const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(-1);
      orbitControls.target.copy(player.position).addScaledVector(forward, 20);
      orbitControls.update();
    };
    syncGizmoModeRef.current = (mode: GizmoMode) => {
      transformControls.setMode(mode);
      transformControls.showY = mode === "translate";
    };

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

    // 코스 경로 근처에는 건물을 두지 않음 (다음 플랫폼이 건물에 가려지지 않도록)
    const coursePathPoints = course.stages.flatMap((s) => s.points.map((p) => ({ x: p.x, z: p.z })));
    const BUILDING_CLEARANCE = 26;
    function isClearOfCourse(x: number, z: number) {
      return coursePathPoints.every((p) => Math.hypot(p.x - x, p.z - z) > BUILDING_CLEARANCE);
    }

    let buildingsPlaced = 0;
    let buildingAttempts = 0;
    while (buildingsPlaced < 50 && buildingAttempts < 300) {
      buildingAttempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = rand(45, 160);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!isClearOfCourse(x, z)) continue;
      makeBuilding(x, z, rand(8, 18), rand(20, 90), rand(8, 18));
      buildingsPlaced++;
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
    interface StageClearEntry {
      position: THREE.Vector3;
      message: string;
      shown: boolean;
    }

    // 도시 건물까지의 플랫폼 개수 (코스를 다시 빌드할 때 보존 대상)
    const cityPlatformCount = platforms.length;
    let checkpoints: CheckpointEntry[] = [];
    let goalPosition: THREE.Vector3 | null = null;
    let stageClears: StageClearEntry[] = [];
    let courseDecor: THREE.Object3D[] = [];
    let lavaZoneStartZ = -Infinity;
    let lavaZoneEndZ = -Infinity;
    let lavaSurfaceY = 3;
    let lavaGround: THREE.Mesh | null = null;
    let lavaLight: THREE.PointLight | null = null;

    function buildStage(stage: CourseData["stages"][number]) {
      stage.points.forEach((p: CoursePoint, pointIndex: number) => {
        const mesh = addPlatform(p.x, p.y, p.z, p.w, 1, p.d, !!(p.checkpoint || p.goal || p.stageClear), stage.theme);
        mesh.userData = { stageId: stage.id, pointIndex, baseW: p.w, baseD: p.d };
        editableMeshes.push({ mesh, stageId: stage.id, pointIndex });
        if (p.checkpoint) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(2, 0.18, 12, 32),
            new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffae42, emissiveIntensity: 1.0 })
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.set(p.x, p.y + 2.2, p.z);
          scene.add(ring);
          courseDecor.push(ring);
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
          courseDecor.push(flag);
        }
      });
    }

    const COOL_BG = new THREE.Color(0x0a0d14);
    const HOT_BG = new THREE.Color(0x3a0f05);
    const COOL_FOG = new THREE.Color(0x0a0d14);
    const HOT_FOG = new THREE.Color(0x2a0e06);
    const COOL_HEMI = new THREE.Color(0x6f93b8);
    const HOT_HEMI = new THREE.Color(0xff8a3d);
    const COOL_MOON = new THREE.Color(0xaecbff);
    const HOT_MOON = new THREE.Color(0xff7a3d);

    // 코스 데이터를 기반으로 플랫폼/체크포인트/용암지대를 새로 빌드 (관리자 모드 실시간 편집용으로 재호출 가능)
    function applyCourse(newCourse: CourseData) {
      transformControls.detach();
      editableMeshes.length = 0;
      for (let i = platforms.length - 1; i >= cityPlatformCount; i--) {
        const entry = platforms[i];
        scene.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        platforms.splice(i, 1);
      }
      courseDecor.forEach((obj) => scene.remove(obj));
      courseDecor = [];
      checkpoints = [];
      stageClears = [];
      goalPosition = null;
      if (lavaGround) {
        scene.remove(lavaGround);
        lavaGround.geometry.dispose();
        lavaGround = null;
      }
      if (lavaLight) {
        scene.remove(lavaLight);
        lavaLight = null;
      }

      newCourse.stages.forEach(buildStage);
      checkpointCountElNonNull.textContent = `체크포인트: 0 / ${checkpoints.length}`;

      // 장식용 작은 플랫폼들 (각 테마 구간에 분산)
      newCourse.stages.forEach((stage, idx) => {
        const stageZs = stage.points.map((p) => p.z);
        if (stageZs.length === 0) return;
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

      // 용암 바닥 & 분위기 전환 구간 (lava 테마 스테이지 기준 자동 계산)
      const stageIndexByTheme = newCourse.stages.findIndex((s) => s.theme === "lava");
      lavaZoneStartZ = -Infinity;
      lavaZoneEndZ = -Infinity;
      let lavaCenterZ = 0;
      lavaSurfaceY = 3;
      if (stageIndexByTheme >= 0) {
        const lavaStage = newCourse.stages[stageIndexByTheme];
        const prevStage = newCourse.stages[stageIndexByTheme - 1];
        const lavaZs = lavaStage.points.map((p) => p.z);
        lavaZoneStartZ = prevStage ? Math.min(...prevStage.points.map((p) => p.z)) : Math.max(...lavaZs) + 13;
        lavaZoneEndZ = Math.min(...lavaZs) - 7;
        lavaCenterZ = (lavaZoneStartZ + lavaZoneEndZ) / 2;
        lavaSurfaceY = Math.min(...lavaStage.points.map((p) => p.y)) - 12;

        lavaGround = new THREE.Mesh(
          new THREE.PlaneGeometry(160, Math.max(20, lavaZoneStartZ - lavaZoneEndZ)),
          new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff3300, emissiveIntensity: 1.3, roughness: 0.35 })
        );
        lavaGround.rotation.x = -Math.PI / 2;
        lavaGround.position.set(-2, lavaSurfaceY, lavaCenterZ);
        scene.add(lavaGround);

        lavaLight = new THREE.PointLight(0xff5522, 1.4, 140);
        lavaLight.position.set(-2, lavaSurfaceY + 15, lavaCenterZ);
        scene.add(lavaLight);
      }

      // 테이블 편집 등으로 코스가 재빌드되어도 이전에 선택했던 플랫폼이 있으면 다시 선택 상태로 복원
      if (currentSelection) {
        const restored = editableMeshes.find(
          (e) => e.stageId === currentSelection!.stageId && e.pointIndex === currentSelection!.pointIndex
        );
        if (restored) transformControls.attach(restored.mesh);
        else clearSelection();
      }
    }

    applyCourse(course);
    applyCourseRef.current = applyCourse;

    function updateAtmosphere(playerZ: number) {
      const enter = THREE.MathUtils.clamp((lavaZoneStartZ - playerZ) / 40, 0, 1);
      const exit = THREE.MathUtils.clamp(1 - (lavaZoneEndZ - playerZ) / 40, 0, 1);
      const hotFactor = enter * exit;
      (scene.background as THREE.Color).copy(COOL_BG).lerp(HOT_BG, hotFactor);
      (scene.fog as THREE.FogExp2).color.copy(COOL_FOG).lerp(HOT_FOG, hotFactor);
      (scene.fog as THREE.FogExp2).density = 0.007 + hotFactor * 0.006;
      hemi.color.copy(COOL_HEMI).lerp(HOT_HEMI, hotFactor);
      moon.color.copy(COOL_MOON).lerp(HOT_MOON, hotFactor);
      if (lavaLight) lavaLight.intensity = 1.0 + hotFactor * 0.8 + Math.sin(performance.now() * 0.004) * 0.15;
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
    const EDIT_MOVE_SPEED = 40; // 관리자 모드 자유 카메라 이동 속도

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

    // 마운트 시점의 editMode/gizmoMode prop 값으로 한 번 동기화 (player가 정의된 이후에 호출해야 함)
    syncEditModeRef.current(editModeRef.current);
    syncGizmoModeRef.current(gizmoModeRef.current);

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
      blockerEl.style.display = pointerLocked || editModeRef.current ? "none" : "flex";
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

    // 마우스 휠로 시야 확대/축소 (FOV 조절 방식의 줌)
    const MIN_FOV = 20;
    const MAX_FOV = 100;
    const handleWheel = (e: WheelEvent) => {
      if (editModeRef.current) return; // 편집 모드에서는 OrbitControls의 줌을 사용
      e.preventDefault();
      camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.05, MIN_FOV, MAX_FOV);
      camera.updateProjectionMatrix();
    };
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });

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

      if (editModeRef.current) {
        const activeTag = document.activeElement?.tagName;
        const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";
        if (!isTyping) {
          const editForward = new THREE.Vector3();
          camera.getWorldDirection(editForward);
          const editRight = new THREE.Vector3().crossVectors(editForward, camera.up).normalize();
          const editMove = new THREE.Vector3();
          if (keys["KeyW"] || keys["ArrowUp"]) editMove.add(editForward);
          if (keys["KeyS"] || keys["ArrowDown"]) editMove.sub(editForward);
          if (keys["KeyA"] || keys["ArrowLeft"]) editMove.sub(editRight);
          if (keys["KeyD"] || keys["ArrowRight"]) editMove.add(editRight);
          if (keys["Space"]) editMove.y += 1;
          if (keys["ShiftLeft"] || keys["ShiftRight"]) editMove.y -= 1;
          if (editMove.lengthSq() > 0) {
            editMove.normalize().multiplyScalar(EDIT_MOVE_SPEED * dt);
            camera.position.add(editMove);
            orbitControls.target.add(editMove);
          }
        }
        orbitControls.update();
      } else if (pointerLocked) {
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

      if (!editModeRef.current) {
        camera.position.copy(player.position);
        camera.rotation.order = "YXZ";
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;
      }

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
      renderer.domElement.removeEventListener("wheel", handleWheel);
      renderer.domElement.removeEventListener("click", handleEditClick);
      transformControls.dispose();
      orbitControls.dispose();
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
        <div>WASD / 방향키 : 이동 &nbsp;/&nbsp; SPACE : 점프(2단 가능) &nbsp;/&nbsp; 마우스 : 시야 &nbsp;/&nbsp; 휠 : 확대·축소</div>
        <div ref={checkpointCountRef}>체크포인트: 0 / 0</div>
      </div>

      <button
        onClick={() => {
          if (document.pointerLockElement) document.exitPointerLock();
          onOpenAdmin();
        }}
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
});

export default ParkourGame;
