"use client";

import { useState } from "react";
import type { CoursePoint, Stage, Theme } from "@/lib/courseData";
import type { GizmoMode, PointSelection } from "@/components/ParkourGame";

interface AdminPanelProps {
  authenticated: boolean;
  stages: Stage[] | null;
  selected: PointSelection;
  gizmoMode: GizmoMode;
  onGizmoModeChange: (mode: GizmoMode) => void;
  onAuthenticated: (stages: Stage[]) => void;
  onClose: () => void;
  onUpdateStage: (stageIdx: number, patch: Partial<Stage>) => void;
  onUpdatePoint: (stageIdx: number, pointIdx: number, patch: Partial<CoursePoint>) => void;
  onAddPoint: (stageIdx: number) => void;
  onRemovePoint: (stageIdx: number, pointIdx: number) => void;
  onAddStage: () => void;
  onRemoveStage: (stageIdx: number) => void;
  onSelectRow: (stageId: string, pointIndex: number) => void;
  onSave: () => Promise<{ ok: boolean; error?: string }>;
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "normal", label: "기본 (하늘색)" },
  { value: "lava", label: "용암 (빨간색)" },
  { value: "sky", label: "하늘길 (보라색)" },
];

export default function AdminPanel({
  authenticated,
  stages,
  selected,
  gizmoMode,
  onGizmoModeChange,
  onAuthenticated,
  onClose,
  onUpdateStage,
  onUpdatePoint,
  onAddPoint,
  onRemovePoint,
  onAddStage,
  onRemoveStage,
  onSelectRow,
  onSave,
}: AdminPanelProps) {
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleLogin() {
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLoginError(body.error || "비밀번호가 올바르지 않습니다.");
        return;
      }
      const courseRes = await fetch("/api/course");
      const course = await courseRes.json();
      onAuthenticated(course.stages);
    } catch {
      setLoginError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    setSaveOk(false);
    const result = await onSave();
    if (result.ok) setSaveOk(true);
    else setSaveError(result.error || "저장에 실패했습니다.");
    setSaving(false);
  }

  return (
    <div className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col overflow-hidden border-l border-sky-800/60 bg-slate-950/95 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div>
          <h2 className="text-lg font-semibold text-sky-300">관리자 모드 - 맵 에디터</h2>
          {authenticated && (
            <p className="text-xs text-slate-400">3D 화면에서 플랫폼을 클릭해 선택하고, 화살표로 옮기거나 크기를 조절하세요</p>
          )}
        </div>
        <button onClick={onClose} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">
          ✕
        </button>
      </div>

      {!authenticated || !stages ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10">
          <p className="text-sm text-slate-300">관리자 비밀번호를 입력하세요.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-64 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-center text-white outline-none focus:border-sky-500"
            placeholder="비밀번호"
            autoFocus
          />
          {loginError && <p className="text-sm text-red-400">{loginError}</p>}
          <button
            onClick={handleLogin}
            disabled={loggingIn}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {loggingIn ? "확인 중..." : "입장"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-3">
            <span className="text-xs text-slate-400">기즈모 모드:</span>
            <button
              onClick={() => onGizmoModeChange("translate")}
              className={`rounded px-3 py-1 text-xs font-medium ${
                gizmoMode === "translate" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              이동
            </button>
            <button
              onClick={() => onGizmoModeChange("scale")}
              className={`rounded px-3 py-1 text-xs font-medium ${
                gizmoMode === "scale" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              크기
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {stages.map((stage, stageIdx) => (
              <div key={stage.id} className="mb-5 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input
                    value={stage.name}
                    onChange={(e) => onUpdateStage(stageIdx, { name: e.target.value })}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
                  />
                  <select
                    value={stage.theme}
                    onChange={(e) => onUpdateStage(stageIdx, { theme: e.target.value as Theme })}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
                  >
                    {THEME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={stage.clearMessage ?? ""}
                    onChange={(e) => onUpdateStage(stageIdx, { clearMessage: e.target.value })}
                    placeholder="클리어 메시지"
                    className="min-w-[200px] flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
                  />
                  <button
                    onClick={() => onRemoveStage(stageIdx)}
                    className="rounded bg-red-900/60 px-2 py-1 text-xs text-red-200 hover:bg-red-800"
                  >
                    스테이지 삭제
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-slate-200">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="px-1 py-1"></th>
                        <th className="px-1 py-1">x</th>
                        <th className="px-1 py-1">y</th>
                        <th className="px-1 py-1">z</th>
                        <th className="px-1 py-1">w</th>
                        <th className="px-1 py-1">d</th>
                        <th className="px-1 py-1">체크</th>
                        <th className="px-1 py-1">클리어</th>
                        <th className="px-1 py-1">골</th>
                        <th className="px-1 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stage.points.map((p, pointIdx) => {
                        const isSelected = selected?.stageId === stage.id && selected.pointIndex === pointIdx;
                        return (
                          <tr
                            key={pointIdx}
                            className={`cursor-pointer border-t border-slate-800 ${isSelected ? "bg-sky-900/50" : "hover:bg-slate-800/40"}`}
                            onClick={() => onSelectRow(stage.id, pointIdx)}
                          >
                            <td className="px-1 py-1 text-center">{isSelected ? "▶" : ""}</td>
                            {(["x", "y", "z", "w", "d"] as const).map((field) => (
                              <td key={field} className="px-1 py-1">
                                <input
                                  type="number"
                                  value={p[field]}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => onUpdatePoint(stageIdx, pointIdx, { [field]: Number(e.target.value) })}
                                  className="w-16 rounded border border-slate-700 bg-slate-900 px-1 py-0.5"
                                />
                              </td>
                            ))}
                            <td className="px-1 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={!!p.checkpoint}
                                onChange={(e) => onUpdatePoint(stageIdx, pointIdx, { checkpoint: e.target.checked })}
                              />
                            </td>
                            <td className="px-1 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={!!p.stageClear}
                                onChange={(e) => onUpdatePoint(stageIdx, pointIdx, { stageClear: e.target.checked })}
                              />
                            </td>
                            <td className="px-1 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={!!p.goal}
                                onChange={(e) => onUpdatePoint(stageIdx, pointIdx, { goal: e.target.checked })}
                              />
                            </td>
                            <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => onRemovePoint(stageIdx, pointIdx)}
                                className="rounded px-1.5 py-0.5 text-red-300 hover:bg-red-900/50"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => onAddPoint(stageIdx)}
                  className="mt-2 rounded bg-slate-800 px-2 py-1 text-xs text-sky-200 hover:bg-slate-700"
                >
                  + 플랫폼 놓기
                </button>
              </div>
            ))}

            <button onClick={onAddStage} className="rounded bg-slate-800 px-3 py-1.5 text-sm text-sky-200 hover:bg-slate-700">
              + 스테이지 추가
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-5 py-3">
            {saveError && <span className="text-sm text-red-400">{saveError}</span>}
            {saveOk && <span className="text-sm text-emerald-400">저장되었습니다.</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "맵 저장"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
