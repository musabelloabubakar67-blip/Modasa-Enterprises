import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Staff screens. Everything else is the public online shop.
const STAFF_PATHS = ["/app", "/login", "/setup"];
const isStaffPath = (path: string) => STAFF_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * With STAFF_SITE_URL set, staff and the online shop use separate addresses served by the same deployment:
 * staff pages only answer on the staff address, shop pages only on NEXT_PUBLIC_SITE_URL, and a visitor on the
 * wrong one is sent to the right one. Unset (e.g. on a development machine), one address serves both.
 */
function addressRedirect(request: NextRequest) {
  const staffUrl = process.env.STAFF_SITE_URL;
  if (!staffUrl) return null;
  const staff = new URL(staffUrl);
  const { pathname, search, hostname } = request.nextUrl;
  if (pathname.startsWith("/_next/") || pathname.startsWith("/_vercel/")) return null; // framework files
  const staffPath = isStaffPath(pathname);

  if (hostname === staff.hostname) {
    if (staffPath) return null;
    // The staff address's home is the staff area; shop pages belong on the shop address.
    const shopUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (pathname === "/" || !shopUrl) return NextResponse.redirect(new URL("/app", staff));
    return NextResponse.redirect(new URL(pathname + search, shopUrl));
  }
  return staffPath ? NextResponse.redirect(new URL(pathname + search, staff)) : null;
}

// Refreshes the Supabase session cookie on every request and sends signed-out
// visitors of staff pages to the login screen. Real permission checks happen in
// the pages and server actions themselves (see src/lib/auth.ts).
export async function proxy(request: NextRequest) {
  const redirect = addressRedirect(request);
  if (redirect) return redirect;
  // Shop visitors have no sign-in, so shop pages skip the session check entirely.
  if (!isStaffPath(request.nextUrl.pathname)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Also refreshes an expiring session. getClaims verifies the token locally where it can.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && request.nextUrl.pathname.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
