"use client";

import { useEffect, useRef, useState } from "react";
import ParkourGame, { type ParkourGameHandle } from "@/components/ParkourGame";
import AdminPanel from "@/components/AdminPanel";
import { DEFAULT_COURSE, type CourseData } from "@/lib/courseData";

export default function GameShell() {
  const [course, setCourse] = useState<CourseData>(DEFAULT_COURSE);
  const [loaded, setLoaded] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
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

  return (
    <>
      <ParkourGame ref={gameRef} course={course} onOpenAdmin={() => setShowAdmin(true)} />
      {showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          onPreview={(preview) => gameRef.current?.previewCourse(preview)}
          onSaved={(saved) => setCourse(saved)}
        />
      )}
    </>
  );
}
