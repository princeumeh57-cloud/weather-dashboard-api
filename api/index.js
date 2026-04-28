export const config = { runtime: "edge" };

const TARGET_BASE = (process.env.API_BACKEND_URL || "").replace(/\/$/, "");

const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handler(req) {
  const url = new URL(req.url);
  const SECRET_PATH = "/api/v2/sync";

  if (!url.pathname.startsWith(SECRET_PATH)) {
    return new Response(
      JSON.stringify({ status: "active", service: "weather-data-node", timestamp: Date.now() }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  if (!TARGET_BASE) {
    return new Response("Service Setup Required", { status: 500 });
  }

  try {
    const targetUrl = TARGET_BASE + url.pathname + url.search;

    const out = new Headers();
    let clientIp = null;
    
    for (const [k, v] of req.headers) {
      if (STRIP_HEADERS.has(k)) continue;
      if (k.startsWith("x-vercel-")) continue;
      if (k === "x-real-ip") {
        clientIp = v;
        continue;
      }
      if (k === "x-forwarded-for") {
        if (!clientIp) clientIp = v;
        continue;
      }
      out.set(k, v);
    }
    
    if (clientIp) out.set("x-forwarded-for", clientIp);

    const method = req.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    return await fetch(targetUrl, {
      method,
      headers: out,
      body: hasBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    return new Response("Service Temporarily Unavailable", { status: 503 });
  }
}
