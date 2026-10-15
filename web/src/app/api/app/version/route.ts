import { parseAndroidAppRelease } from "@/lib/appRelease";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { android: parseAndroidAppRelease(process.env.ANDROID_APP_RELEASE) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
