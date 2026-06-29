import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
import { DEFAULT_COURSE, type CourseData, type Theme } from "@/lib/courseData";
import { isAdminRequest } from "@/lib/adminSession";

const BLOB_PATHNAME = "course-data/course.json";
const DATA_FILE = path.join(process.cwd(), "data", "course.json");
const THEMES: Theme[] = ["normal", "lava", "sky"];

const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

async function readCourse(): Promise<CourseData> {
  try {
    if (hasBlob) {
      const result = await get(BLOB_PATHNAME, { access: "private" });
      if (!result || result.statusCode !== 200) throw new Error("blob not found");
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as CourseData;
    }
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as CourseData;
  } catch {
    return DEFAULT_COURSE;
  }
}

async function writeCourse(course: CourseData): Promise<void> {
  if (hasBlob) {
    await put(BLOB_PATHNAME, JSON.stringify(course, null, 2), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(course, null, 2), "utf-8");
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
  return NextResponse.json(course, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!validateCourse(body)) {
    return NextResponse.json({ ok: false, error: "맵 데이터 형식이 올바르지 않습니다." }, { status: 400 });
  }

  await writeCourse(body);
  return NextResponse.json({ ok: true });
}
