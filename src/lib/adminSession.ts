import { NextRequest } from "next/server";

const COOKIE_NAME = "admin_session";

export function isAdminRequest(req: NextRequest): boolean {
  return req.cookies.get(COOKIE_NAME)?.value === "ok";
}
