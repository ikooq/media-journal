import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isConfigured, supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";
import { safeNext } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  if (!isConfigured()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const { url, key } = supabaseConfig();
  const db = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const { data, error } = await db.auth.getClaims();
  const path = request.nextUrl.pathname;
  const publicPath = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/auth/confirm",
  ].includes(path);
  let destination: string | undefined;
  if ((error || !data?.claims) && !publicPath && !path.startsWith("/api/"))
    destination = `/login?next=${encodeURIComponent(path + request.nextUrl.search)}`;
  if (data?.claims && ["/login", "/signup"].includes(path))
    destination = safeNext(request.nextUrl.searchParams.get("next"));
  const final = destination
    ? NextResponse.redirect(new URL(destination, request.url))
    : response;
  if (destination)
    response.cookies.getAll().forEach((c) => final.cookies.set(c));
  final.headers.set("Cache-Control", "private, no-store");
  return final;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
