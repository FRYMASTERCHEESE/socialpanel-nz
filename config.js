// PUBLIC browser configuration. Never put a service-role key, payment secret, or other private credential here.
// Leave the Supabase fields blank to run the safe, local preview.
window.SOCIALPANEL_CONFIG = Object.freeze({
  brand: 'SocialPanel NZ',
  currency: 'NZD',
  supabaseUrl: '',
  supabasePublishableKey: '', // use a browser-safe sb_publishable_... key
  supabaseAnonKey: '', // legacy anon key fallback only
  // Optional public contact email, shown on the support page.
  supportEmail: '',
});
