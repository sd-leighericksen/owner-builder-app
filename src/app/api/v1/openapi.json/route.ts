import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/openapi/document";

export function GET() {
  return NextResponse.json(buildOpenApiDocument());
}
