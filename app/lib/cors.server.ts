// CORS helper for teacher-facing API routes.
// The teacher portal SPA runs on theglobalconservatory.com (via Shopify app proxy)
// but makes API calls to tgc-faculty-app-production.up.railway.app (cross-origin).

const ALLOWED_ORIGINS = [
  "https://theglobalconservatory.com",
  "https://www.theglobalconservatory.com",
  "https://krjpjc-cy.myshopify.com",
];

function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return null;
}

/** Standard CORS headers for a given request */
export function corsHeaders(request: Request): HeadersInit {
  const origin = getAllowedOrigin(request);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/** Handle OPTIONS preflight — return this from loader if method is OPTIONS */
export function handleCorsOptions(request: Request): Response | null {
  if (request.method !== "OPTIONS") return null;
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

/** Wrap a json Response with CORS headers */
export function withCors(request: Request, response: Response): Response {
  const headers = corsHeaders(request);
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
  for (const [key, value] of Object.entries(headers)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}
