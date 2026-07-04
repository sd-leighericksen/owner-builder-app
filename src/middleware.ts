import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session cookie and gates app pages behind auth.
 * When Supabase isn't configured (AUTH_MODE=dev local development), this is a
 * pass-through — the API layer signs requests in as the dev owner.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies: CookieToSet[]) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  if (!data.user && !isLogin && !isApi) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  // Everything except static assets and PWA files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|manifest.webmanifest|sw.js).*)"],
};
