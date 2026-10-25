/* These are fictitious SAMPLE packages and prices. They are never represented as live services. */
export const PLATFORMS = [
  {id:'facebook',name:'Facebook',glyph:'f',color:'#1877f2'},
  {id:'youtube',name:'YouTube',glyph:'▶',color:'#ff0033'},
  {id:'instagram',name:'Instagram',glyph:'◎',color:'#c13584'},
  {id:'tiktok',name:'TikTok',glyph:'♪',color:'#111827'},
  {id:'x',name:'X / Twitter',glyph:'𝕏',color:'#101828'},
  {id:'linkedin',name:'LinkedIn',glyph:'in',color:'#0a66c2'},
  {id:'telegram',name:'Telegram',glyph:'➤',color:'#289bd5'},
  {id:'spotify',name:'Spotify',glyph:'≋',color:'#16bb62'},
  {id:'soundcloud',name:'SoundCloud',glyph:'☁',color:'#ff6800'},
  {id:'website',name:'Website traffic',glyph:'◉',color:'#405add'},
  {id:'pinterest',name:'Pinterest',glyph:'P',color:'#e60023'},
  {id:'bluesky',name:'Bluesky',glyph:'✦',color:'#1685fe'},
  {id:'kick',name:'Kick',glyph:'K',color:'#2dab43'},
  {id:'vimeo',name:'Vimeo',glyph:'v',color:'#18b5f8'},
  {id:'dailymotion',name:'Dailymotion',glyph:'D',color:'#0673ff'},
  {id:'shazam',name:'Shazam',glyph:'S',color:'#0688f9'},
  {id:'reddit',name:'Reddit',glyph:'●',color:'#ff4500'},
  {id:'other',name:'Other services',glyph:'✧',color:'#635bdf'},
];

// Pricing is indicative for interface demonstration, not an offer to supply services.
export const DEMO_SERVICES = [
  {id:'demo-1001',code:'1001',platform:'youtube',name:'YouTube video SEO & title audit',description:'Research-backed title, description, keywords and thumbnail recommendations.',price_cents:3900,delivery:'2–3 business days',unit:'per video',featured:true},
  {id:'demo-1002',code:'1002',platform:'facebook',name:'Facebook page growth strategy',description:'Custom content and community engagement plan for your audience.',price_cents:4900,delivery:'3–5 business days',unit:'per plan',featured:true},
  {id:'demo-1003',code:'1003',platform:'tiktok',name:'TikTok creative review',description:'Feedback on hooks, storytelling and retention for your short videos.',price_cents:2900,delivery:'2–3 business days',unit:'per video',featured:true},
  {id:'demo-1004',code:'1004',platform:'instagram',name:'Instagram content calendar',description:'Two-week publishing calendar with post concepts and captions.',price_cents:6900,delivery:'4–5 business days',unit:'per calendar',featured:true},
  {id:'demo-1005',code:'1005',platform:'youtube',name:'YouTube Ads campaign planning',description:'Audience, creative and budget planning. Ad spend is separate.',price_cents:7900,delivery:'3–5 business days',unit:'per campaign',featured:false},
  {id:'demo-1006',code:'1006',platform:'facebook',name:'Facebook Ads account review',description:'Review campaign structure, targeting and opportunities for improvement.',price_cents:5900,delivery:'2–4 business days',unit:'per account',featured:false},
  {id:'demo-1007',code:'1007',platform:'tiktok',name:'TikTok Ads launch checklist',description:'Campaign readiness review and compliant launch recommendations.',price_cents:5900,delivery:'2–4 business days',unit:'per campaign',featured:false},
  {id:'demo-1008',code:'1008',platform:'linkedin',name:'LinkedIn profile optimisation',description:'Profile rewrite and recommendations for professional discoverability.',price_cents:6500,delivery:'4–5 business days',unit:'per profile',featured:false},
  {id:'demo-1009',code:'1009',platform:'website',name:'Website SEO quick audit',description:'Technical and on-page issues, accessibility and search recommendations.',price_cents:8900,delivery:'3–5 business days',unit:'per site',featured:true},
  {id:'demo-1010',code:'1010',platform:'spotify',name:'Music release marketing plan',description:'Legitimate fan discovery and promotional planning without fake streams.',price_cents:5900,delivery:'3–5 business days',unit:'per release',featured:false},
  {id:'demo-1011',code:'1011',platform:'pinterest',name:'Pinterest pin strategy',description:'Search-friendly pin ideas, keywords and creative checklist.',price_cents:3900,delivery:'2–4 business days',unit:'per plan',featured:false},
  {id:'demo-1012',code:'1012',platform:'telegram',name:'Telegram community setup guide',description:'Group moderation, welcome flow and community guidelines.',price_cents:3900,delivery:'2–3 business days',unit:'per community',featured:false},
  {id:'demo-1013',code:'1013',platform:'x',name:'X content strategy',description:'Post ideas, profile optimisation and community engagement tactics.',price_cents:4500,delivery:'3–5 business days',unit:'per plan',featured:false},
  {id:'demo-1014',code:'1014',platform:'soundcloud',name:'SoundCloud artist profile review',description:'Metadata, profile and discoverability advice for music creators.',price_cents:2900,delivery:'2–3 business days',unit:'per profile',featured:false},
  {id:'demo-1015',code:'1015',platform:'bluesky',name:'Bluesky creator launch kit',description:'Profile copy, starter content and community engagement guidance.',price_cents:3500,delivery:'2–4 business days',unit:'per kit',featured:false},
  {id:'demo-1016',code:'1016',platform:'reddit',name:'Reddit community strategy',description:'Community research and participation plan respecting subreddit rules.',price_cents:5900,delivery:'3–5 business days',unit:'per plan',featured:false},
  {id:'demo-1017',code:'1017',platform:'kick',name:'Kick channel optimisation',description:'Stream branding, descriptions and content scheduling review.',price_cents:4500,delivery:'3–5 business days',unit:'per channel',featured:false},
  {id:'demo-1018',code:'1018',platform:'vimeo',name:'Vimeo showcase review',description:'Video presentation, titles and channel organisation recommendations.',price_cents:2900,delivery:'2–3 business days',unit:'per showcase',featured:false},
];

export function platformFor(id) { return PLATFORMS.find(p=>p.id===id) || PLATFORMS[PLATFORMS.length-1]; }
