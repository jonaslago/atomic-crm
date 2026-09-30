import { accessToken, PROJECT_REF } from "./supabaseAdmin.mjs";
const token = accessToken();
const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error("fejl:", res.status, await res.text());
  process.exit(1);
}
const cfg = await res.json();
console.log(JSON.stringify({
  jwt_exp: cfg.jwt_exp,
  refresh_token_rotation_enabled: cfg.refresh_token_rotation_enabled,
  security_refresh_token_reuse_interval: cfg.security_refresh_token_reuse_interval,
  session_timebox: cfg.session_timebox,
  session_inactivity_timeout: cfg.session_inactivity_timeout,
  site_url: cfg.site_url,
}, null, 2));
