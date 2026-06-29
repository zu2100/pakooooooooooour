"use client";

import { useEffect, useRef, useState } from "react";
import ParkourGame, { type GizmoMode, type ParkourGameHandle, type PointSelection } from "@/components/ParkourGame";
import AdminPanel from "@/components/AdminPanel";
import { DEFAULT_COURSE, type CourseData, type CoursePoint, type Stage } from "@/lib/courseData";

const emptyPoint = (): CoursePoint => ({ x: 0, y: 0, z: 0, w: 5, d: 5 });

export default function GameShell() {
  const [course, setCourse] = useState<CourseData>(DEFAULT_COURSE);
  const [loaded, setLoaded] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [draftStages, setDraftStages] = useState<Stage[] | null>(null);
  const [selected, setSelected] = useState<PointSelection>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
  const gameRef = useRef<ParkourGameHandle>(null);

  useEffect(() => {
    fetch("/api/course")
      .then((res) => res.json())
      .then((data: CourseData) => {
        setCourse(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <div className="flex h-screen w-screen items-center justify-center bg-[#05060a] text-sky-200">불러오는 중...</div>;
  }

  const editMode = showAdmin && authenticated;

  function closeAdmin() {
    setShowAdmin(false);
    setAuthenticated(false);
    setDraftStages(null);
    setSelected(null);
    gameRef.current?.deselectPoint();
  }

  function handleAuthenticated(stages: Stage[]) {
    setAuthenticated(true);
    setDraftStages(stages);
  }

  function updateStage(stageIdx: number, patch: Partial<Stage>) {
    setDraftStages((prev) => {
      if (!prev) return prev;
      const next = prev.map((s, i) => (i === stageIdx ? { ...s, ...patch } : s));
      gameRef.current?.previewCourse({ stages: next });
      return next;
    });
  }

  function updatePoint(stageIdx: number, pointIdx: number, patch: Partial<CoursePoint>) {
    setDraftStages((prev) => {
      if (!prev) return prev;
      const next = prev.map((s, i) =>
        i === stageIdx ? { ...s, points: s.points.map((p, j) => (j === pointIdx ? { ...p, ...patch } : p)) } : s
      );
      gameRef.current?.previewCourse({ stages: next });
      return next;
    });
  }

  function addPoint(stageIdx: number) {
    setDraftStages((prev) => {
      if (!prev) return prev;
      const stage = prev[stageIdx];
      const last = stage.points[stage.points.length - 1];
      const newPoint = last ? { ...emptyPoint(), x: last.x, y: last.y, z: last.z - 8 } : emptyPoint();
      const nextPoints = [...stage.points, newPoint];
      const next = prev.map((s, i) => (i === stageIdx ? { ...s, points: nextPoints } : s));
      gameRef.current?.previewCourse({ stages: next });
      const newIndex = nextPoints.length - 1;
      setSelected({ stageId: stage.id, pointIndex: newIndex });
      gameRef.current?.selectPoint(stage.id, newIndex);
      return next;
    });
  }

  function removePoint(stageIdx: number, pointIdx: number) {
    setDraftStages((prev) => {
      if (!prev) return prev;
      const stage = prev[stageIdx];
      const next = prev.map((s, i) => (i === stageIdx ? { ...s, points: s.points.filter((_, j) => j !== pointIdx) } : s));
      gameRef.current?.previewCourse({ stages: next });
      if (selected?.stageId === stage.id && selected.pointIndex === pointIdx) {
        setSelected(null);
        gameRef.current?.deselectPoint();
      }
      return next;
    });
  }

  function addStage() {
    setDraftStages((prev) => {
      if (!prev) return prev;
      const newStage: Stage = {
        id: `stage-${Date.now()}`,
        name: `스테이지 ${prev.length + 1}`,
        theme: "normal",
        points: [emptyPoint()],
      };
      const next = [...prev, newStage];
      gameRef.current?.previewCourse({ stages: next });
      return next;
    });
  }

  function removeStage(stageIdx: number) {
    setDraftStages((prev) => {
      if (!prev) return prev;
      const stage = prev[stageIdx];
      const next = prev.filter((_, i) => i !== stageIdx);
      gameRef.current?.previewCourse({ stages: next });
      if (selected?.stageId === stage.id) {
        setSelected(null);
        gameRef.current?.deselectPoint();
      }
      return next;
    });
  }

  function selectRow(stageId: string, pointIndex: number) {
    setSelected({ stageId, pointIndex });
    gameRef.current?.selectPoint(stageId, pointIndex);
  }

  function handlePointChangeFromGizmo(stageId: string, pointIndex: number, patch: Partial<CoursePoint>) {
    setDraftStages((prev) => {
      if (!prev) return prev;
      // 기즈모로 드래그하는 동안에는 3D 장면이 이미 실시간으로 반영되어 있으므로 previewCourse를 다시 호출하지 않음
      return prev.map((s) => (s.id === stageId ? { ...s, points: s.points.map((p, j) => (j === pointIndex ? { ...p, ...patch } : p)) } : s));
    });
  }

  async function handleSave(): Promise<{ ok: boolean; error?: string }> {
    if (!draftStages) return { ok: false, error: "편집 중인 데이터가 없습니다." };
    try {
      const res = await fetch("/api/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: draftStages }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || "저장에 실패했습니다." };
      setCourse({ stages: draftStages });
      return { ok: true };
    } catch {
      return { ok: false, error: "저장 중 오류가 발생했습니다." };
    }
  }

  return (
    <>
      <ParkourGame
        ref={gameRef}
        course={course}
        onOpenAdmin={() => setShowAdmin(true)}
        editMode={editMode}
        gizmoMode={gizmoMode}
        onPointChange={handlePointChangeFromGizmo}
        onMeshSelected={setSelected}
      />
      {showAdmin && (
        <AdminPanel
          authenticated={authenticated}
          stages={draftStages}
          selected={selected}
          gizmoMode={gizmoMode}
          onGizmoModeChange={setGizmoMode}
          onAuthenticated={handleAuthenticated}
          onClose={closeAdmin}
          onUpdateStage={updateStage}
          onUpdatePoint={updatePoint}
          onAddPoint={addPoint}
          onRemovePoint={removePoint}
          onAddStage={addStage}
          onRemoveStage={removeStage}
          onSelectRow={selectRow}
          onSave={handleSave}
        />
      )}
    </>
  );
}
