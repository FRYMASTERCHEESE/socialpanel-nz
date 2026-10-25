// Private, read-only owner preview of the SMMFollows API.
// This function CANNOT create, refill, cancel, or pay for supplier orders.
// Deploy only to a NEW SocialPanel NZ Supabase project. Set SMMFOLLOWS_API_KEY via Secrets.
import { normalizeSupplierList, normalizeSupplierBalance } from './normalize.mjs';

const PROVIDER_URL = 'https://smmfollows.com/api/v2';
const SITE_ORIGIN = 'https://frymastercheese.github.io';
const LOCAL_ORIGINS = new Set(['http://localhost:8080','http://127.0.0.1:8080']);
const headers = (origin: string | null) => ({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store',
  'vary': 'Origin',
  'access-control-allow-origin': origin === SITE_ORIGIN || (origin && LOCAL_ORIGINS.has(origin)) ? origin : SITE_ORIGIN,
  'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
});
function response(data: object, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {status, headers:headers(origin)});
}
function getEnvironment(name: string) { return Deno.env.get(name)?.trim() || ''; }

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, {status:204,headers:headers(origin)});
  if (request.method !== 'POST') return response({error:'POST required'},405,origin);
  if (origin && origin !== SITE_ORIGIN && !LOCAL_ORIGINS.has(origin)) return response({error:'Origin not allowed'},403,origin);

  // Never trust a client-supplied email, role, API key or service ID.
  const auth = request.headers.get('authorization') || '';
  const match = /^Bearer ([A-Za-z0-9._~-]{40,})$/.exec(auth);
  if (!match) return response({error:'Sign in as the owner'},401,origin);
  const project = getEnvironment('SUPABASE_URL');
  const publishableKey = getEnvironment('SUPABASE_PUBLISHABLE_KEY') || getEnvironment('SUPABASE_ANON_KEY');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(project) || !publishableKey) {
    return response({error:'Backend environment is not ready'},503,origin);
  }
  try {
    // The Auth server validates the actual session JWT. User-controlled metadata is ignored.
    const authResponse = await fetch(`${project.replace(/\/$/,'')}/auth/v1/user`,{
      method:'GET',headers:{apikey:publishableKey,authorization:auth},signal:AbortSignal.timeout(8000),
    });
    if (!authResponse.ok) return response({error:'Session expired or invalid'},401,origin);
    const user = await authResponse.json();
    if (!/^[0-9a-f-]{36}$/i.test(String(user?.id || '')) || user?.is_anonymous === true) {
      return response({error:'Owner account required'},403,origin);
    }
    // Query the public.app_admins table as this SAME user, enforced by its RLS policy.
    const admins = await fetch(`${project.replace(/\/$/,'')}/rest/v1/app_admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,{
      headers:{apikey:publishableKey,authorization:auth},signal:AbortSignal.timeout(8000),
    });
    if (!admins.ok) return response({error:'Owner verification unavailable'},503,origin);
    const adminRows = await admins.json();
    if (!Array.isArray(adminRows) || adminRows.length !== 1 || adminRows[0]?.user_id !== user.id) {
      return response({error:'Owner access only'},403,origin);
    }
    const payload = await request.json().catch(()=>({}));
    const action = payload?.action;
    if (action !== 'services' && action !== 'balance') return response({error:'Only read-only supplier checks are allowed'},400,origin);
    const key = getEnvironment('SMMFOLLOWS_API_KEY');
    if (!key) return response({error:'Supplier key not configured in private backend secrets'},503,origin);
    // Fixed destination and action: no client-controlled URL, credentials, or order creation.
    const form = new URLSearchParams({key,action});
    const upstream = await fetch(PROVIDER_URL,{
      method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','accept':'application/json'},
      body:form.toString(),signal:AbortSignal.timeout(15000),redirect:'error',
    });
    if (!upstream.ok) return response({error:'Supplier unavailable; please retry later'},502,origin);
    if (Number(upstream.headers.get('content-length') || 0) > 4_000_000) return response({error:'Supplier response exceeds safety limit'},502,origin);
    const raw = await upstream.text();
    if (raw.length > 4_000_000) return response({error:'Supplier response exceeds safety limit'},502,origin);
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return response({error:'Supplier returned invalid JSON'},502,origin); }
    if (data && !Array.isArray(data) && typeof data === 'object' && 'error' in data) {
      return response({error:'Supplier rejected the request. Check your private API key or account permissions.'},502,origin);
    }
    const result = action === 'services' ? normalizeSupplierList(data,300) : normalizeSupplierBalance(data);
    return response({provider:'SMMFollows',readOnly:true, ...result},200,origin);
  } catch (error) {
    // Never log tokens, supplier keys or upstream bodies.
    if (error instanceof Error && /^Supplier (returned|balance)/.test(error.message)) return response({error:error.message},502,origin);
    return response({error:'Secure supplier check failed'},502,origin);
  }
});
