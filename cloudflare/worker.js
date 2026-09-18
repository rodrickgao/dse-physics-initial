const SESSION_COOKIE = "dse_physics_access";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth" && request.method === "POST") {
      return authenticate(request, env);
    }
    if (url.pathname === "/logout" && request.method === "POST") {
      return new Response(null, {
        status: 204,
        headers: {
          "Set-Cookie": `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (!(await hasValidSession(request, env))) {
      return invitePage();
    }
    return env.ASSETS.fetch(request);
  },
};

async function authenticate(request, env) {
  let code = "";
  try {
    ({ code } = await request.json());
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  if (typeof code !== "string" || !constantTimeEqual(code, env.INVITE_CODE || "")) {
    return json({ error: "Invalid invite code." }, 401);
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const signature = await sign(String(expiresAt), env.SESSION_SECRET);
  return json(
    { ok: true },
    200,
    {
      "Set-Cookie": `${SESSION_COOKIE}=${expiresAt}.${signature}; Path=/; Max-Age=${SESSION_LIFETIME_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
    },
  );
}

async function hasValidSession(request, env) {
  const value = getCookie(request.headers.get("Cookie"), SESSION_COOKIE);
  if (!value) return false;

  const [expiresAt, signature] = value.split(".");
  if (!/^\d+$/.test(expiresAt) || !signature || Number(expiresAt) < Date.now() / 1000) return false;

  const expected = await sign(expiresAt, env.SESSION_SECRET);
  return constantTimeEqual(signature, expected);
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function getCookie(header, name) {
  if (!header) return null;
  const prefix = `${name}=`;
  return header.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) || null;
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store", ...headers },
  });
}

function invitePage() {
  return new Response(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSE Physics access</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f8fc;color:#172033;font-family:system-ui,sans-serif}.card{width:min(420px,calc(100% - 40px));padding:32px;border:1px solid #e3e7ee;border-radius:18px;background:#fff;box-shadow:0 18px 45px #1a31501a}h1{margin:0 0 8px;font-size:1.6rem}p{color:#637087;line-height:1.5}label{display:block;margin:22px 0 7px;font-size:.84rem;font-weight:700}input,button{box-sizing:border-box;width:100%;font:inherit;border-radius:9px}input{padding:12px;border:1px solid #cbd4e1}button{margin-top:12px;padding:12px;border:0;background:#245ec7;color:#fff;font-weight:800;cursor:pointer}button:disabled{opacity:.65}.error{min-height:1.3em;margin:10px 0 0;color:#b42318;font-size:.9rem}</style>
<main class="card"><h1>DSE Physics</h1><p>Enter your invite code to access the past-paper study desk.</p><form id="form"><label for="code">Invite code</label><input id="code" name="code" autocomplete="current-password" required autofocus><button id="submit">Continue</button><p class="error" id="error" role="alert"></p></form></main>
<script>const form=document.getElementById('form'),code=document.getElementById('code'),button=document.getElementById('submit'),error=document.getElementById('error');form.addEventListener('submit',async(e)=>{e.preventDefault();button.disabled=true;error.textContent='';try{const r=await fetch('/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code.value})});if(!r.ok)throw new Error((await r.json()).error||'Unable to verify code.');location.reload()}catch(e){error.textContent=e.message;button.disabled=false}})</script></html>`, {
    headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY" },
  });
}
