import { NextResponse } from "next/server";

export function ok(data: any = {}, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function fail(code: string, message: string, status = 400, extra?: any) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(extra ?? {}) } },
    { status }
  );
}
