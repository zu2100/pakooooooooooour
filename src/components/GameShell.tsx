"use client";

import { useEffect, useState } from "react";
import ParkourGame from "@/components/ParkourGame";
import AdminPanel from "@/components/AdminPanel";
import { DEFAULT_COURSE, type CourseData } from "@/lib/courseData";

export default function GameShell() {
  const [course, setCourse] = useState<CourseData>(DEFAULT_COURSE);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

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
      <ParkourGame key={version} course={course} onOpenAdmin={() => setShowAdmin(true)} />
      {showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          onSaved={(saved) => {
            setCourse(saved);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
