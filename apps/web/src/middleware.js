import { NextResponse } from "next/server";


const PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/contact",
  "/login",
  "/signup",
]);

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow next internals & static
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images")
  ) {
    return NextResponse.next();
  }

  const jwt = req.cookies.get("jwt")?.value;

  const isPublic = PUBLIC_PATHS.has(pathname);
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtected = !isPublic;

  // 🚫 Not logged in & trying to access protected
  if (!jwt && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // 🚫 Logged in & trying to access login/signup
  if (jwt && isAuthPage) {
    return NextResponse.redirect(new URL("/spaces", req.url));
  }

  // ✅ Otherwise allow
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
