import { NextResponse } from "next/server";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export function jsonOk<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: JSON_HEADERS });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: JSON_HEADERS });
}
