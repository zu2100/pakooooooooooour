"use client";

import { useState } from "react";
import type { CourseData, CoursePoint, Stage, Theme } from "@/lib/courseData";

interface AdminPanelProps {
  onClose: () => void;
  onSaved: (course: CourseData) => void;
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "normal", label: "기본 (하늘색)" },
  { value: "lava", label: "용암 (빨간색)" },
  { value: "sky", label: "하늘길 (보라색)" },
];

const emptyPoint = (): CoursePoint => ({ x: 0, y: 0, z: 0, w: 5, d: 5 });

export default function AdminPanel({ onClose, onSaved }: AdminPanelProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [stages, setStages] = useState<Stage[]>([]);
  const [loadError, setLoadError] = useState("");
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
      const course: CourseData = await courseRes.json();
      setStages(course.stages);
      setAuthenticated(true);
    } catch {
      setLoginError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoggingIn(false);
    }
  }

  function updateStage(stageIdx: number, patch: Partial<Stage>) {
    setStages((prev) => prev.map((s, i) => (i === stageIdx ? { ...s, ...patch } : s)));
  }

  function updatePoint(stageIdx: number, pointIdx: number, patch: Partial<CoursePoint>) {
    setStages((prev) =>
      prev.map((s, i) =>
        i === stageIdx
          ? { ...s, points: s.points.map((p, j) => (j === pointIdx ? { ...p, ...patch } : p)) }
          : s
      )
    );
  }

  function addPoint(stageIdx: number) {
    setStages((prev) =>
      prev.map((s, i) => (i === stageIdx ? { ...s, points: [...s.points, emptyPoint()] } : s))
    );
  }

  function removePoint(stageIdx: number, pointIdx: number) {
    setStages((prev) =>
      prev.map((s, i) => (i === stageIdx ? { ...s, points: s.points.filter((_, j) => j !== pointIdx) } : s))
    );
  }

  function addStage() {
    setStages((prev) => [
      ...prev,
      {
        id: `stage${prev.length + 1}-${Date.now()}`,
        name: `스테이지 ${prev.length + 1}`,
        theme: "normal",
        points: [emptyPoint()],
      },
    ]);
  }

  function removeStage(stageIdx: number) {
    setStages((prev) => prev.filter((_, i) => i !== stageIdx));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    setSaveOk(false);
    try {
      const res = await fetch("/api/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages } as CourseData),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(body.error || "저장에 실패했습니다.");
        return;
      }
      setSaveOk(true);
      onSaved({ stages });
    } catch {
      setSaveError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-sky-800/60 bg-slate-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-lg font-semibold text-sky-300">관리자 모드 - 맵 에디터</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            ✕
          </button>
        </div>

        {!authenticated ? (
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
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loadError && <p className="mb-3 text-sm text-red-400">{loadError}</p>}

            {stages.map((stage, stageIdx) => (
              <div key={stage.id} className="mb-5 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input
                    value={stage.name}
                    onChange={(e) => updateStage(stageIdx, { name: e.target.value })}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
                  />
                  <select
                    value={stage.theme}
                    onChange={(e) => updateStage(stageIdx, { theme: e.target.value as Theme })}
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
                    onChange={(e) => updateStage(stageIdx, { clearMessage: e.target.value })}
                    placeholder="클리어 메시지 (stageClear 플랫폼 도달 시 표시)"
                    className="min-w-[260px] flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
                  />
                  <button
                    onClick={() => removeStage(stageIdx)}
                    className="rounded bg-red-900/60 px-2 py-1 text-xs text-red-200 hover:bg-red-800"
                  >
                    스테이지 삭제
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-slate-200">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="px-1 py-1">x</th>
                        <th className="px-1 py-1">y</th>
                        <th className="px-1 py-1">z</th>
                        <th className="px-1 py-1">w</th>
                        <th className="px-1 py-1">d</th>
                        <th className="px-1 py-1">체크포인트</th>
                        <th className="px-1 py-1">스테이지클리어</th>
                        <th className="px-1 py-1">최종골</th>
                        <th className="px-1 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stage.points.map((p, pointIdx) => (
                        <tr key={pointIdx} className="border-t border-slate-800">
                          {(["x", "y", "z", "w", "d"] as const).map((field) => (
                            <td key={field} className="px-1 py-1">
                              <input
                                type="number"
                                value={p[field]}
                                onChange={(e) =>
                                  updatePoint(stageIdx, pointIdx, { [field]: Number(e.target.value) })
                                }
                                className="w-16 rounded border border-slate-700 bg-slate-900 px-1 py-0.5"
                              />
                            </td>
                          ))}
                          <td className="px-1 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={!!p.checkpoint}
                              onChange={(e) => updatePoint(stageIdx, pointIdx, { checkpoint: e.target.checked })}
                            />
                          </td>
                          <td className="px-1 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={!!p.stageClear}
                              onChange={(e) => updatePoint(stageIdx, pointIdx, { stageClear: e.target.checked })}
                            />
                          </td>
                          <td className="px-1 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={!!p.goal}
                              onChange={(e) => updatePoint(stageIdx, pointIdx, { goal: e.target.checked })}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <button
                              onClick={() => removePoint(stageIdx, pointIdx)}
                              className="rounded px-1.5 py-0.5 text-red-300 hover:bg-red-900/50"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => addPoint(stageIdx)}
                  className="mt-2 rounded bg-slate-800 px-2 py-1 text-xs text-sky-200 hover:bg-slate-700"
                >
                  + 플랫폼 추가
                </button>
              </div>
            ))}

            <button onClick={addStage} className="rounded bg-slate-800 px-3 py-1.5 text-sm text-sky-200 hover:bg-slate-700">
              + 스테이지 추가
            </button>
          </div>
        )}

        {authenticated && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-5 py-3">
            {saveError && <span className="text-sm text-red-400">{saveError}</span>}
            {saveOk && <span className="text-sm text-emerald-400">저장되었습니다. 새로고침하면 적용됩니다.</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "맵 저장"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
