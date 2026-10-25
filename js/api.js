/* Live data adapter. Local preview NEVER writes to a database or processes payments. */
let client=null;
export function isConfigured() {
  const c=window.SOCIALPANEL_CONFIG || {};
  return Boolean(/^https:\/\/.+\.supabase\.co\/?$/.test(c.supabaseUrl||'') && (c.supabasePublishableKey||c.supabaseAnonKey) && !/placeholder/i.test(c.supabasePublishableKey||c.supabaseAnonKey));
}
export async function connect() {
  if(!isConfigured())return null;
  if (client) return client;
  // Browser-safe anon key only; never expose a service-role key in config.js.
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.10/+esm');
  const c=window.SOCIALPANEL_CONFIG;
  client=createClient(c.supabaseUrl,c.supabasePublishableKey||c.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}
export function getClient(){return client;}
function assertClient(){if(!client)throw Error('Connect Supabase to enable this feature.');return client;}
function unwrap(promise){return promise.then(({data,error})=>{if(error)throw Error(error.message);return data;});}
export async function session(){const c=assertClient();const {data,error}=await c.auth.getSession();if(error)throw Error(error.message);return data.session;}
export async function googleLogin(){const c=assertClient();return unwrap(c.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.href.split('#')[0]}}));}
export async function magicLink(email){const c=assertClient();return unwrap(c.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href.split('#')[0]}}));}
export async function logout(){const c=assertClient();const {error}=await c.auth.signOut();if(error)throw Error(error.message);}
export async function userIsAdmin(userId){if(!userId)return false;const c=assertClient();const {data,error}=await c.from('app_admins').select('user_id').eq('user_id',userId).maybeSingle();if(error)throw Error(error.message);return Boolean(data);}
export async function services(){return unwrap(assertClient().from('services').select('id,code,platform,name,description,price_cents,delivery,unit,featured,is_active').eq('is_active',true).order('featured',{ascending:false}).order('name'));}
export async function balance(){return unwrap(assertClient().rpc('my_balance'));}
export async function orders(){return unwrap(assertClient().from('orders').select('id,service_name,service_code,platform,target_url,quantity,amount_cents,status,created_at').order('created_at',{ascending:false}).limit(200));}
export async function placeOrder(serviceId,targetUrl,quantity){return unwrap(assertClient().rpc('place_order',{p_service_id:serviceId,p_target_url:targetUrl,p_quantity:quantity}));}
export async function tickets(){return unwrap(assertClient().from('tickets').select('id,subject,message,status,created_at').order('created_at',{ascending:false}).limit(100));}
export async function createTicket(subject,message){return unwrap(assertClient().from('tickets').insert({subject,message}).select('id').single());}
export async function allServices(){return unwrap(assertClient().from('services').select('*').order('created_at',{ascending:false}));}
export async function adminOrders(){return unwrap(assertClient().from('orders').select('id,user_id,service_name,amount_cents,status,created_at').order('created_at',{ascending:false}).limit(200));}
export async function saveService(row){const c=assertClient();const clean={platform:row.platform,name:row.name,description:row.description,price_cents:row.price_cents,delivery:row.delivery,unit:row.unit,featured:row.featured,is_active:row.is_active};if(row.id){return unwrap(c.from('services').update(clean).eq('id',row.id).select().single());}return unwrap(c.from('services').insert({...clean,code:row.code}).select().single());}
export async function updateOrder(id,status){return unwrap(assertClient().rpc('admin_set_order_status',{p_order_id:id,p_status:status}));}
export async function creditWallet(userId,amountCents,reference){return unwrap(assertClient().rpc('admin_credit_wallet',{p_user_id:userId,p_amount_cents:amountCents,p_reference:reference}));}
