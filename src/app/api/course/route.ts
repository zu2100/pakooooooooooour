import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_COURSE, type CourseData, type Theme } from "@/lib/courseData";
import { isAdminRequest } from "@/lib/adminSession";

const DATA_FILE = path.join(process.cwd(), "data", "course.json");
const THEMES: Theme[] = ["normal", "lava", "sky"];

async function readCourse(): Promise<CourseData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as CourseData;
  } catch {
    return DEFAULT_COURSE;
  }
}

function validateCourse(body: unknown): body is CourseData {
  if (!body || typeof body !== "object" || !Array.isArray((body as CourseData).stages)) return false;
  return (body as CourseData).stages.every((stage) => {
    if (!stage || typeof stage.id !== "string" || typeof stage.name !== "string") return false;
    if (!THEMES.includes(stage.theme)) return false;
    if (!Array.isArray(stage.points)) return false;
    return stage.points.every(
      (p) =>
        typeof p.x === "number" &&
        typeof p.y === "number" &&
        typeof p.z === "number" &&
        typeof p.w === "number" &&
        typeof p.d === "number"
    );
  });
}

export async function GET() {
  const course = await readCourse();
  return NextResponse.json(course);
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!validateCourse(body)) {
    return NextResponse.json({ ok: false, error: "맵 데이터 형식이 올바르지 않습니다." }, { status: 400 });
  }

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(body, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  await fs.rm(DATA_FILE, { force: true });
  return NextResponse.json({ ok: true });
}
