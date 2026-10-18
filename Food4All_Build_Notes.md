# Food4All — Build Notes

### Ab tak kya banaya, kaun si technology li, kyun li, aur "best" kya hota

**Yeh document kiske liye hai:** mere liye (Harsh), college mein time nikaal ke padhne ke liye.
Yeh ek *reference manual* nahi hai — yeh ek *learning doc* hai. Har jagah teen cheezein likhi hain:

1. **Yeh cheez hoti kya hai** (ekdum basic se)
2. **Humne kya choose kiya aur kyun** (free tier ki majboori samet)
3. **Agar paisa/time hota to best kya hota** (taaki pata rahe ki hum kahan khade hain)

> **Padhne ka tarika:** Part 1 aur 2 ek baar poora padho — wahan se poori picture banegi.
> Part 3 se aage reference hai: jab usi file pe kaam karo tab khol ke padho.

---

## Table of Contents

| Part | Kya hai ismein |
|---|---|
| **1** | Ekdum basic — ek web app banane ke liye kya-kya chahiye hota hai |
| **2** | Technology choices — har ek ke options, humara choice, aur "best" |
| **3** | Database design — har table, har column, kyun |
| **4** | State machine — donation ka lifecycle |
| **5** | Security — RLS, aur browser se DB baat kaise kare |
| **6** | 4 security holes jo mile aur unke fix |
| **7** | Auto-expiry (cron) |
| **8** | Food safety / FSSAI alignment |
| **9** | Frontend architecture |
| **10** | Testing — 27 assertions kya prove karti hain |
| **11** | Cost sheet — sab kuch ₹0 mein |
| **12** | Abhi bhi kya missing hai (honest list) |
| **13** | Viva / interview Q&A |
| **14** | Research paper kya hota hai + hum kis pe likh sakte hain |

---
---

# PART 1 — Ekdum Basic: ek web app ke liye kya-kya chahiye hota hai

Pehle bina Food4All ka naam liye, **general** baat. Koi bhi real web app (Zomato, Instagram, college ka ERP) — sabko yeh 7 cheezein chahiye hoti hain. Agar yeh 7 clear ho gaye, to baaki poora doc asaan lagega.

### 1.1 Frontend — jo user ko dikhta hai

Browser mein jo screen dikhti hai. Teen cheezon se banti hai:

- **HTML** — dhancha (structure). "Yahan heading hai, yahan button hai."
- **CSS** — kapde (styling). "Button neela hai, 8px padding hai."
- **JavaScript** — jaan (behaviour). "Button dabao to yeh ho."

Chhoti site inhi teenon se ban jaati hai. Lekin jab screen pe **data badalta rehta hai** (jaise donation ka status `available` → `claimed`), to plain JS mein har jagah manually DOM update karna padta hai — aur wahan bugs aate hain. Isi problem ko solve karne ke liye **frameworks** bane (React, Vue, Angular).

> **Mental model:** Framework ka kaam ek hi hai — *"main data badal doon, tu screen khud sambhal le."*

### 1.2 Backend — jo logic chalata hai

Frontend pe kabhi bhi bharosa nahi kiya ja sakta. User browser ka DevTools khol ke JavaScript badal sakta hai, network request edit kar sakta hai.

**Golden rule (ise yaad rakhna, poora Part 5 isi pe khada hai):**

> Frontend validation = **user ki suvidha** (UX).
> Backend validation = **actual security**.
> Jo rule frontend mein hai lekin backend mein nahi — wo rule hai hi nahi.

### 1.3 Database — jo yaad rakhta hai

Server restart ho jaaye to bhi data rehna chahiye. Do badi families:

| | **SQL / Relational** (Postgres, MySQL) | **NoSQL / Document** (MongoDB, Firestore) |
|---|---|---|
| Data kaisa dikhta | Tables, rows, columns (Excel jaisa) | JSON documents |
| Rishte (relations) | `JOIN` se, DB khud enforce karta hai | Aapko code mein sambhalna padta hai |
| Schema | Fixed — galat data **ghus hi nahi sakta** | Flexible — kuch bhi ghus sakta hai |
| Kab best | Data mein saaf rishte ho | Shape badalta rehta ho |

### 1.4 Authentication — "tu hai kaun?"

Login/signup. Dikhne mein simple, banane mein **sabse khatarnak** cheez. Isme yeh sab aata hai: password hashing (bcrypt — plain text **kabhi nahi**), session tokens (JWT), token refresh, email confirmation, password reset, rate limiting.

> Ismein ek bhi galti = poora data gaya. Isiliye duniya mein best practice yahi hai: **auth khud mat likho, kisi tested service se lo.**

### 1.5 Authorization — "tu kar kya sakta hai?"

Authentication aur Authorization alag cheezein hain — log aksar confuse karte hain:

- **Authentication (AuthN)** = *Tu kaun hai?* → "Main Harsh hoon."
- **Authorization (AuthZ)** = *Tujhe iski ijazat hai?* → "Harsh dusre ka donation delete nahi kar sakta."

Food4All mein AuthZ hi asli dimaag hai, kyunki yahan 4 alag role hain (donor, NGO, volunteer, admin) aur har ek ko **alag cheez dikhni** aur **alag cheez karne** ki ijazat honi chahiye.

### 1.6 Hosting — duniya tak pahunchana

Code aapke laptop pe chal raha hai = sirf aapke liye. Internet pe daalne ke liye server chahiye. Options: apna VPS (AWS/DigitalOcean — sab khud manage karo) ya PaaS (Vercel/Netlify — git push karo, baaki wo sambhalein).

### 1.7 Plumbing — jo koi nahi batata

Yeh sab bhi chahiye hota hai, aur inhi mein time jaata hai:

- **Environment variables** — secret keys code mein **kabhi nahi**, `.env` file mein (jo git mein jaati hi nahi)
- **Migrations** — DB ka structure badalne ka version-controlled tarika
- **Background jobs** — jo bina user ke apne aap chale (hamara auto-expiry)
- **File storage** — photos vagairah (DB mein image daalna galat practice hai)
- **Testing** — proof ki cheez chal rahi hai

---

### 1.8 Ab yeh sab Food4All pe lagao

| Chahiye tha | Food4All mein kya hai |
|---|---|
| Frontend | Next.js 15 + React 19 + Tailwind |
| Backend | Next.js Server Actions + **Postgres functions (RPC)** |
| Database | Supabase Postgres |
| AuthN | Supabase Auth |
| AuthZ | **Postgres RLS + triggers** (yahi project ki jaan hai) |
| Hosting | Vercel (app) + Supabase (DB) |
| Env vars | `.env.local`, gitignored |
| Migrations | `supabase/migrations/0001…0007` |
| Background job | `pg_cron` har 10 min |
| File storage | Supabase Storage (abhi URL field, upload Phase 3) |
| Testing | `scripts/e2e-test.mjs` — 27 assertions |

Ek line mein pakad lo yeh baat, yahi is project ka central idea hai:

> **Normally business logic backend code mein hota hai. Food4All mein woh database ke andar hai.**
> Kyun — yeh Part 4 aur 5 mein poora khulega.

---
---

# PART 2 — Technology choices: kya, kyun, aur best kya hota

Pehle poora summary table, phir ek-ek pe detail.

| # | Kaam | Options the | **Humne liya** | Kyun | Paisa hota to best |
|---|---|---|---|---|---|
| 1 | UI framework | React, Vue, Angular, Svelte | **React 19** | Sabse bada ecosystem, India mein jobs | React hi (yeh choice paise se nahi badalti) |
| 2 | Meta-framework | Next.js, Remix, Vite SPA | **Next.js 15** | SSR + server actions + Vercel free | Next.js hi |
| 3 | Language | JS, TypeScript | **TS strict** | Bug compile pe pakde | TS hi |
| 4 | Styling | Tailwind, MUI, Bootstrap, CSS Modules | **Tailwind 3.4** | Zero runtime cost, fast | Tailwind + shadcn/ui |
| 5 | Database | Postgres, MySQL, Mongo | **Postgres** | Enums, CHECK, **RLS** | Postgres hi |
| 6 | Backend platform | Supabase, Firebase, custom Node | **Supabase** | Postgres + Auth + RLS free | Supabase Pro ($25/mo) |
| 7 | Auth | Supabase, Clerk, Auth0, khud | **Supabase Auth** | DB ke saath integrated | Clerk (behtar UI) |
| 8 | Maps | Google, Mapbox, Leaflet+OSM | **Leaflet + OSM** | **Card hi nahi chahiye** | Mapbox ($0 tak 50k loads) |
| 9 | Geocoding | Google, Mapbox, Nominatim | **Nominatim** | Free, no key | Google (India addresses best) |
| 10 | Distance | Haversine, PostGIS, Routing API | **Haversine** | 10 line, zero dependency | **PostGIS** (proper geo index) |
| 11 | Hosting | Vercel, Netlify, Render, VPS | **Vercel** | Free, Next.js ka ghar | Vercel Pro ($20/mo) |
| 12 | Cron | pg_cron, Vercel Cron, GH Actions | **pg_cron** | DB ke andar, free | pg_cron hi |
| 13 | Notifications | FCM, Twilio, WhatsApp API, email | **Abhi kuch nahi** | Sab paid | **WhatsApp Business API** |

---

## 2.1 React 19 — aur "framework" hota kya hai

**Problem jo React solve karta hai.** Plain JS mein agar donation ka status badla, to aapko khud dhoondhna padta hai ki screen pe kin-kin jagah woh status dikh raha hai, aur har jagah manually badalna padta hai. 3 jagah pe theek hai. 30 jagah pe guaranteed bug.

React kehta hai: **UI = f(state)**. Tum sirf data badlo, screen kaisi dikhegi woh maine likh rakha hai, main khud re-render kar loonga.

**React 19 mein naya kya:** Server Components (component **server pe** chalta hai, browser ko sirf HTML milta hai — JS bundle chhota), aur `useActionState`/form actions (form ka data seedha server function ko).

**Alternatives honest comparison:**

| | Seekhne mein | Jobs (India) | Performance |
|---|---|---|---|
| **React** | Medium | ★★★★★ | Achhi |
| Vue | Aasaan | ★★★ | Achhi |
| Angular | Mushkil | ★★★ (enterprise) | Achhi |
| Svelte | Aasaan | ★ | **Sabse best** |

**Faisla:** Svelte technically behtar hai lekin India mein job market nahi hai. Final year project ka ek maqsad resume bhi hai → React.

---

## 2.2 Next.js 15 — "meta-framework" kyun chahiye

Akela React sirf UI deta hai. Yeh nahi deta: routing (URL), server-side rendering, API endpoints, image optimization, bundling. Next.js yeh sab deta hai.

**Teen rendering models (yeh viva mein poocha jaata hai):**

| Model | Kaam kaise karta | SEO | Food4All mein |
|---|---|---|---|
| **CSR** (plain React) | Khaali HTML → JS load → data fetch → render | ❌ Kharab | Nahi |
| **SSR** | Server HTML banata → bhejta | ✅ Badhiya | ✅ Haan |
| **SSG** | Build time pe HTML ban gaya | ✅ Best | Nahi (data live hai) |

**Food4All ke liye SSR kyun zaroori tha:** donation list har second badal sakti hai, aur `/trace/[id]` page WhatsApp pe share hoga — wahan link preview chahiye. CSR mein crawler ko khaali page milta hai.

**App Router ka asli faida — Server Component:**

```tsx
// Yeh component server pe chalta hai. Browser isko kabhi nahi dekhta.
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('public_impact');  // DB call, seedhe yahan
  return <ImpactCards data={data} />;
}
```

Dekho kya **nahi** likhna pada: koi `/api/impact` route nahi, koi `fetch()` nahi, koi `useState`/`useEffect` nahi, koi loading state nahi. Purane React mein yeh 40 line hoti, yahan 4 hai.

> **Trade-off (honestly):** Server Components naya concept hai, aur "yeh component server ka hai ya client ka" — isme confusion hota hai. `'use client'` kab lagana hai yeh seekhne mein time lagta hai.

---

## 2.3 TypeScript strict — bug compile time pe

```jsonc
// tsconfig.json
"strict": true,              // saari safety checks ON
"moduleResolution": "bundler",
"paths": { "@/*": ["./src/*"] }   // '../../../lib/x' ki jagah '@/lib/x'
```

`strict: true` ka matlab — TypeScript aapko `null` ignore nahi karne dega:

```ts
const { data: { user } } = await supabase.auth.getUser();
// user ka type: User | null
if (!user) return { error: 'Not authenticated' };   // yeh likhna PADEGA
// ab yahan se neeche user ka type: User   ← TS khud samajh gaya
```

JS mein yeh check bhool jaate, aur production mein `Cannot read property 'id' of null` crash milta. **TS mein woh crash hone se pehle hi, laptop pe, pakda jaata hai.**

> **Best practice jo humne ki:** `npx tsc --noEmit` chala ke verify kiya → exit code 0, zero errors.

---

## 2.4 Tailwind CSS — aur "runtime cost" ka matlab

```tsx
<div className="rounded-lg border p-4 shadow-sm">
```

**Pehli nazar mein gandा lagta hai. Teen asli faide hain:**

1. **Naam nahi sochna padta.** CSS mein sabse zyada time `.card-header-wrapper-inner` jaise naam sochne mein jaata hai.
2. **Dead CSS nahi bachta.** Tailwind sirf wahi CSS build karta hai jo aapne actually use kiya.
3. **Zero runtime cost** — yeh important hai. `styled-components` jaise libraries **browser mein** CSS generate karti hain = har render pe kaam. Tailwind build time pe plain CSS file bana deta hai = browser pe **zero** extra JS.

| Option | Bundle | Kab lena chahiye |
|---|---|---|
| **Tailwind** | ~10KB | Custom design |
| MUI / Ant | ~300KB | Dashboard jaldi banana ho |
| Bootstrap | ~160KB | Design nahi aata |
| styled-components | ~15KB + runtime | React-heavy team |

**Paisa hota to:** Tailwind hi, lekin **shadcn/ui** ke saath — woh ready components deta hai jo aapke codebase mein copy ho jaate hain (dependency nahi bante).

---

## 2.5 Postgres vs MySQL vs MongoDB — yeh choice sabse important thi

**Food4All ka data relational hai.** Ek donation ka ek donor hota hai, ek NGO claim karta hai, ek volunteer uthata hai. Yeh rishte hain. Mongo mein yeh rishte **aapko code mein** sambhalne padte — aur agar kahin bhool gaye to orphan data ban jaata hai.

**Postgres ne yeh 4 cheezein di jo MySQL/Mongo nahi deta (ya kam deta hai):**

**(a) ENUM types** — galat value DB mein ghus hi nahi sakti:
```sql
create type donation_status as enum ('draft','available','claimed', ...);
-- status = 'kuch_bhi' likho → ERROR. App ko pata bhi nahi chalega, DB mana kar dega.
```

**(b) CHECK constraints** — business rule DB mein:
```sql
constraint valid_pickup_window check (pickup_window_start < pickup_window_end)
```

**(c) Row-Level Security** — *yahi asli wajah hai.* Postgres **har row pe** permission rule laga sakta hai. Iske bina Supabase jaisa model (browser seedha DB se baat kare) possible hi nahi hota. Poora Part 5 isi pe hai.

**(d) Functions + triggers** — logic DB ke andar, taaki koi usse bypass na kar sake.

**Agar MongoDB chuna hota to kya hota (honest):** poori state machine JavaScript mein likhni padti → matlab agar koi developer ek jagah `transition()` call karna bhool gaya aur seedha `updateOne()` kar diya, to galat state DB mein chali jaati. Postgres mein **trigger usko rok deta hai, chahe call kahin se bhi aaye.**

---
## 2.6 Supabase vs Firebase vs apna Node backend

Yeh project ka **sabse bada architectural faisla** tha. Teen raste the:

### Rasta A — Traditional: Node + Express + Postgres (jo college mein padhate hain)

```
Browser  →  Express API  →  Postgres
         (yahan auth check,
          yahan validation,
          yahan business logic)
```

Har cheez aapke control mein. Lekin aapko **khud likhna padta:** password hashing, JWT issue + refresh, email verification, password reset, har endpoint pe role check, rate limiting, CORS, aur phir deploy + server maintain.

**Imaandari se:** iss project ka asli kaam (food rescue logic) 2 hafte ka hai. Yeh plumbing 3 hafte kha jaati, aur usme kuch naya nahi seekhne ko milta.

### Rasta B — Firebase (Google)

Auth + DB + hosting sab ek jagah. Lekin:

| Problem | Detail |
|---|---|
| **Firestore NoSQL hai** | Rishte khud sambhalo, `JOIN` hai hi nahi |
| **Aggregation kamzor** | "kitne completed hain" — Firestore mein yeh seedha nahi hota |
| **Security Rules apni language** | Postgres SQL kahin aur kaam aayega, Firebase rules nahi |
| **Vendor lock-in** | Firebase chhodna = poora app dobara likhna |
| **Billing surprise** | Reads pe charge. Ek loop galat likh do = bill |

### Rasta C — Supabase ✅ (yeh liya)

```
Browser  →  Postgres (seedha!)
            ↑ Row-Level Security har request pe
            ↑ transition_donation() business logic
```

Supabase = **asli Postgres** + uske upar auto-generated REST API + Auth + Storage + Realtime.

**Yeh kaise safe hai?** Yahi sabse chaunkane wala part hai, aur viva mein yahi poocha jaayega:

> **"Agar browser seedha database se baat kar raha hai, to koi bhi kuch bhi nahi padh sakta?"**
>
> Nahi. Kyunki har query Postgres ke **Row-Level Security** se guzarti hai. Browser jo bhi bheje, Postgres pehle check karta hai: *"iss user ko yeh row dikhni bhi chahiye ya nahi?"* Jo rows allowed nahi, woh query ke result mein aati hi nahi — chahe `select *` hi kyun na likh do.

**Isiliye `NEXT_PUBLIC_SUPABASE_ANON_KEY` public hona safe hai** — woh key sirf kehti hai "main iss project ka anonymous user hoon". Us key se kya dikhega, yeh **RLS policies** decide karti hain, key nahi.

> ⚠️ **Lekin `SUPABASE_SERVICE_ROLE_KEY` bilkul alag cheez hai — woh RLS ko poora bypass karti hai.** Woh key kisi ko bhi nahi deni, kabhi bhi, mujhe bhi nahi. Isiliye `.env.local` mein woh jaanbujh ke khaali chhodi hai, aur `.env.local` gitignored hai.

**Kya khoya (honest trade-off):**
- Free tier: project 1 hafte inactive rahe to **pause** ho jaata hai (demo se pehle ek baar khol lena)
- Email: ~2 emails/hour (isi wajah se poora `demo_seed.sql` likhna pada — Part 10 dekho)
- Lock-in kam hai lekin zero nahi (Auth Supabase-specific hai; DB poora portable hai)

---

## 2.7 Auth — jo humne **nahi** likha, woh sabse achha decision tha

Signup/login khud likhne ka matlab yeh sab khud sambhalna:

```
password → bcrypt hash (cost factor?) → store
login → compare → JWT banao (secret? expiry? algorithm?)
       → refresh token (rotate? revoke kaise?)
       → email verify link (token? expiry? one-time?)
       → password reset (same sawal)
       → rate limit (brute force rokna)
```

Har line pe ek known vulnerability hai. **Industry rule: auth khud mat likho.**

Supabase Auth ne yeh sab diya. Humne sirf ek cheez likhi — **signup ke baad profile banana**:

```sql
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Jaise hi Supabase `auth.users` mein row daalta hai, hamara trigger `public.profiles` mein uski row bana deta hai. **Yeh app code mein nahi likha** — kyunki agar app code mein hota aur network beech mein toot jaata, to user ban jaata par profile nahi banti. DB trigger mein dono **ek hi transaction** mein hain: ya dono banenge, ya dono nahi.

> Yeh **atomicity** ka practical example hai — ACID ka 'A'.

**Alternatives:** Clerk (UI sabse sundar, free tier 10k users — lekin DB se alag rehta hai), Auth0 (enterprise standard, free tier chhota). **Supabase isliye jeeta kyunki user table aur data table ek hi DB mein hain → foreign key lag sakti hai.**

---

## 2.8 Maps — "no paid map APIs" wali constraint

Yeh constraint khud lagayi thi, kyunki nonprofit platform ka monthly map bill nahi hona chahiye.

| Option | Free limit | Card chahiye? |
|---|---|---|
| Google Maps | $200 credit/mo | ✅ **Haan** |
| Mapbox | 50k loads/mo | ✅ **Haan** |
| **Leaflet + OpenStreetMap** | Unlimited* | ❌ **Nahi** |

\* fair-use policy ke andar

**Fark samajh lo (log confuse hote hain):**
- **Leaflet** = JavaScript library jo map *dikhati* hai (open source, free, hamesha)
- **OpenStreetMap** = map ka *data* (Wikipedia jaisa, volunteers ne banaya)
- **Tile server** = woh images jo browser download karta hai

**Humne kya kiya:** Leaflet se map, OSM tiles, aur "Directions" ke liye **external deep-link** — matlab user ka apna Google Maps app khulta hai:

```
https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>
```

> **Yeh trick yaad rakhna:** Google Maps **dikhana** paid hai. Google Maps **kholna** free hai. Volunteer ko waise bhi apne phone ka navigation chahiye, embedded map nahi.

**Best agar paisa hota:** Mapbox — tiles zyada sundar, India ke liye custom style ban sakti, aur Matrix API se "5 volunteers mein se kaun sabse jaldi pahunchega" nikal sakta (Haversine se nahi nikal sakta).

---

## 2.9 Geocoding — address se lat/lng

**Nominatim** (OSM ka free geocoder) liya. Limit: **1 request/second**, aur User-Agent header bhejna zaroori.

**Honest limitation:** India ke addresses Nominatim pe kamzor hain. "Plot 7, near Shiv Mandir, Sector 12" — isko woh nahi dhoondh paayega. Isiliye design mein **manual map pin** ko primary rakha hai, geocoding ko sirf *helper* — "shayad aapka matlab yeh hai?"

> **Yeh ek design lesson hai:** jab tool kamzor ho, to usko *suggestion* banao, *source of truth* nahi.

### Nominatim ko browser se seedha kyun nahi bulaya

`/api/geocode` ek apna server-side proxy hai. Chaar wajah:

1. **Browser `User-Agent` header set hi nahi kar sakta** — woh "forbidden header" hai, browser use chupke se apne naam se overwrite kar deta hai. Nominatim ki policy app-identifying User-Agent maangti hai. Matlab **policy follow karna browser se technically possible hi nahi** — sirf server kar sakta hai.
2. **1 req/sec limit sach mein enforce ho sakti hai.** 10 browser tabs mein se har ek "main polite hoon" sochega aur phir bhi 10 req/sec chale jaayenge. Ek server-side gate hi asli gate hai.
3. **Cache** — wahi query dobara aaye to upstream call hi nahi jaati.
4. **Geocoder swap ek file ka kaam** — browser ko pata hi nahi chalta ki peeche Nominatim hai. Kal paid geocoder lagana ho to sirf proxy badlega.

```ts
const MIN_GAP_MS = 1100;   // policy 1/sec + 100ms headroom
```

> **Honest limitation:** yeh gate ek instance ki memory mein hai. Vercel N serverless instances chala de to N req/sec ho sakta hai. Asli fix = shared store (Upstash Redis) ya paid geocoder. Yeh gap PART 12 mein likha hai.

---

## 2.10 Haversine — distance ka maths

```ts
// src/lib/haversine.ts
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;                        // Earth radius km
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2
          + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

**Yeh kya karta hai:** do lat/lng ke beech **seedhi doori** (jaise chidiya udti hai), Earth ko sphere maan ke.

**Yeh kya nahi karta:** road distance. Agar beech mein river hai to Haversine 2km bolega, actual 9km hoga.

**Kyun chalega:** hamara use case hai *"5km ke andar wale volunteers dikhao"* — rough filter. Uske liye yeh bilkul sahi hai, aur **zero dependency, zero API call, zero paisa**.

**Best agar scale hota — PostGIS:**

```sql
-- Aise dikhta
where ST_DWithin(v.location::geography, d.location::geography, 5000)
```

PostGIS ka asli faida **performance** hai: usme **GiST spatial index** lagta hai. Abhi hamare paas `(pickup_lat, pickup_lng)` pe normal B-tree index hai — jo 1000 donations tak theek hai, lakhs pe nahi.

> **Rule jo seekha:** "ab scale ke liye optimize mat karo, par jaanta raho ki kis line pe todega."

---

## 2.11 Hosting + Cron

**Vercel** — Next.js banane walon ki hi company. `git push` → deploy. Free tier: 100GB bandwidth, HTTPS, global CDN.

**Cron (background job) ke 3 raste the:**

| Option | Dikkat | Faisla |
|---|---|---|
| Vercel Cron | Free tier pe **din mein 1 baar** hi | ❌ Food expire minute-level hai |
| GitHub Actions | Free, lekin DB credentials GitHub pe daalni padti | ❌ Security |
| **pg_cron** | DB ke andar hi chalta | ✅ **Liya** |

```sql
perform cron.schedule('food4all-expire-stale', '*/10 * * * *',
  $cron$select public.expire_stale_donations();$cron$);
```

Har 10 minute. Isko kisi external service ki zaroorat hi nahi — DB khud apna ghar saaf karta hai. Poora detail Part 7 mein.

---

## 2.12 Notifications — jaanbujh ke nahi banaya

| Channel | Sachai |
|---|---|
| **WhatsApp Business API** | India ke liye **best** — sab use karte hain. Lekin business verification + per-message cost |
| SMS (Twilio/MSG91) | Paid, DLT registration ka jhanjhat |
| Email | Free hai lekin **India mein koi email nahi padhta** |
| Web Push (FCM) | Free, lekin user ko permission deni padti |

**Abhi kya kiya:** notifications ki jagah **shareable trace link + QR code**. Donor QR dikhata hai ya WhatsApp pe link bhejta hai — koi bhi khol ke live status dekh sakta hai, bina login ke.

> **Yeh "constraint ko feature banana" hai.** Push notification nahi bana sakte the, to aisa cheez banayi jo WhatsApp pe chipak jaaye — jahan log waise bhi hain.

**Phase 3 ka plan:** WhatsApp Business API, kyunki real volunteers app khol ke nahi baithte.

---

## 2.13 Ek nazar mein: "free" choices ne kya cost kiya

Yeh table imaandari ke liye hai — har free choice ki ek keemat hoti hai:

| Free choice | Kya khoya |
|---|---|
| OSM tiles | India mein kam detail, kabhi-kabhi slow |
| Nominatim | Indian addresses pe kharab accuracy |
| Haversine | Road distance nahi, spatial index nahi |
| Supabase free | 1 hafte baad pause, 2 emails/hour |
| Koi notifications nahi | User ko khud aa ke dekhna padta hai |
| Vercel free | Serverless cold start |

**Lekin:** inme se **ek bhi** cheez correctness ya security pe compromise nahi hai. Jahan compromise hota, wahan free option reject kiya. Yeh fark important hai.

---
---

# PART 3 — Database Design: har table, har column, aur kyun

> File: `supabase/migrations/0001_schema.sql` (160 lines)

## 3.0 Pehle basics: "schema" aur "normalization"

**Schema** = DB ka naksha. Kitni tables, har table mein kya columns, kaun se type, aur aapas mein kya rishta.

**Normalization** = data ko aise todna ki **ek cheez ek hi jagah likhi ho**. Teen level jo padhne padte hain:

| Form | Niyam | Simple matlab |
|---|---|---|
| **1NF** | Har cell mein ek hi value | `phone` column mein `"999,888"` mat likho |
| **2NF** | Har non-key column poori key pe depend kare | — |
| **3NF** | Non-key column dusre non-key pe depend na kare | Donation mein `donor_name` mat rakho — `donor_id` se mil jaayega |

**Food4All 3NF mein hai.** Ek example se samjho — humne `donations` table mein `donor_name` **nahi** rakha:

- ❌ Agar rakha hota: donor naam badle to **saari purani donations** mein purana naam dikhta
- ✅ Humne `donor_id` rakha: naam hamesha `profiles` se aata hai, hamesha current

> **Exception jo jaanbujh ke rakhi:** `deliveries.servings_delivered`. Yeh donation ke `servings_estimate` se alag hai — kyunki **estimate aur actual alag cheez hain**. 120 bole the, 38 pahunche. Yeh duplicate data nahi, yeh alag fact hai.

---

## 3.1 Enums — 6 banaye, aur kyun text nahi

```sql
create type user_role           as enum ('donor','ngo','volunteer','admin');
create type donor_kind          as enum ('individual','restaurant','hotel','banquet','other');
create type food_type           as enum ('veg','nonveg','vegan','jain');
create type storage_condition   as enum ('room','refrigerated','hot_held');
create type verification_status as enum ('pending','verified','rejected');
create type donation_status     as enum ('draft','available','claimed','pickup_scheduled',
                                         'picked_up','delivered','completed','cancelled','expired');
```

**Enum vs plain text — 4 wajah:**

| | `text` | `enum` |
|---|---|---|
| Galat value | `'avilable'` chhup ke ghus jaayegi | **ERROR, turant** |
| Storage | poora string har row mein | 4 bytes |
| Typo pakad | runtime pe, shayad kabhi nahi | **compile/insert pe** |
| Documentation | kahin nahi | **DB khud bata deta hai** |

Asli faida yeh hai: **`'avilable'` (typo) wali donation kabhi list mein dikhti hi nahi, aur kisi ko pata bhi nahi chalta ki kyun.** Enum isko din 1 pe pakad leta hai.

**Teen enums pe detail:**

**`food_type ('veg','nonveg','vegan','jain')`** — India-specific design. `jain` isliye hai kyunki Jain food mein pyaaz-lehsun-jameen ke neeche ugne wali cheezein allowed nahi — yeh `veg` ka subset nahi, **alag category** hai. Yeh column `not null` hai: India mein veg/non-veg batana optional nahi ho sakta.

**`storage_condition ('room','refrigerated','hot_held')`** — `hot_held` food-safety ki asli term hai: khana 60°C se upar rakha gaya hai. Shaadi ke chafing dish mein rakha khana `room` se **bahut zyada** der safe rehta hai.

**`donation_status`** — 9 values, aur **yeh poore project ki reedh ki haddi hai**. Part 4 poora isi pe.

---

## 3.2 `profiles` — `auth.users` ke saath 1:1

```sql
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           user_role   not null default 'donor',
  full_name      text        not null default '',
  phone          text,
  city           text,
  donor_kind     donor_kind,
  donor_org_name text,
  is_verified    boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

**Sawal: Supabase ke paas `auth.users` already hai, to yeh alag table kyun?**

Kyunki `auth.users` **Supabase ka internal table hai** — uspe aap apni marzi ke columns nahi jod sakte, aur usko seedha query karna safe nahi (usme password hash, tokens sab hai).

**Pattern yeh hai:** `auth.users` auth ke liye (Supabase ka), `public.profiles` app ke liye (hamara). Dono ki **id same** hai.

**`id uuid primary key references auth.users(id)`** — yeh ek line mein teen cheezein keh rahi hai:
1. `primary key` → ek user ki ek hi profile (1:1 enforce)
2. `references auth.users(id)` → bina user ke profile ban hi nahi sakti
3. `on delete cascade` → user delete to profile apne aap delete

> **`on delete cascade` India mein legally relevant hai** — DPDP Act 2023 mein "right to erasure" hai. Cascade ka matlab delete ek hi jagah se chalega aur poora chalega.

**`updated_at` ka trigger:**

```sql
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
```

Yeh app code mein nahi likha — kyunki app code mein likhne ka matlab hai **har jagah** yaad rakhna. Ek jagah bhool gaye, data jhooth bolne lagega. DB trigger kabhi nahi bhoolta.

---
## 3.3 `ngos` aur `volunteers` — alag tables kyun banaye

```sql
create table public.ngos (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  org_name            text,                    -- 0004 mein NOT NULL hataya
  registration_no     text,                    -- 12A / 80G / Darpan ID
  contact_person      text,
  contact_phone       text,
  address             text,
  lat                 numeric(9,6),
  lng                 numeric(9,6),
  capacity_notes      text,                    -- "~200 meals, 7-9pm"
  verification_status verification_status not null default 'pending',
  verified_by         uuid references public.profiles(id),
  verified_at         timestamptz,
  created_at          timestamptz not null default now()
);

create table public.volunteers (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type        text not null default 'none',   -- none | cycle | bike | car
  service_radius_km   int  not null default 5,
  current_lat         numeric(9,6),
  current_lng         numeric(9,6),
  location_updated_at timestamptz,
  is_available        boolean not null default true,
  total_pickups       int not null default 0,
  created_at          timestamptz not null default now()
);
```

**Sawal: yeh columns `profiles` mein hi daal dete, nullable bana ke?**

Woh galti hoti. Teen wajah:

1. **Semantic jhooth.** Donor ki row mein `service_radius_km` ka koi matlab nahi hai. `NULL` ka matlab "pata nahi" hota hai, "lागू nahi hota" nahi. Dono ko ek hi `NULL` se represent karna data ko gandा karta hai.

2. **Foreign key possible nahi hoti.** Yeh asli technical wajah hai:
   ```sql
   assigned_volunteer uuid references public.volunteers(id)
   ```
   Yeh line DB se guarantee le rahi hai: *"assigned_volunteer wahi ho sakta hai jo sach mein volunteer hai."* Agar sab kuch `profiles` mein hota, to `references profiles(id)` ka matlab hota "koi bhi user" — aur ek NGO ko volunteer bana ke assign kar dena possible ho jaata. **Design hi galti rok raha hai, code nahi.**

3. **RLS alag ho sakti hai.** NGO ki verification admin-only hai, volunteer ki location khud-editable. Alag table = alag policy, saaf rehta hai.

> **Yeh pattern ka naam:** *Class Table Inheritance* / *supertype-subtype*. `profiles` = common, `ngos`/`volunteers` = specific.

**`numeric(9,6)` kyun, `float` kyun nahi?**
`float` approximate hota hai (binary floating point) — `0.1 + 0.2 ≠ 0.3`. Coordinates exact chahiye. `numeric(9,6)` = 9 digits total, 6 decimal ke baad → `±999.999999`. 6 decimal places ≈ **11 cm** precision. Bas kaafi hai.

**`verified_by` + `verified_at`** — sirf `verification_status` rakh dete to pata nahi chalta **kisne** verify kiya. Trust system mein accountability chahiye. (Aur Part 6 mein dekhoge ki NGO khud ko verify kar sakta tha — woh bug tha.)

**`total_pickups` — ek known compromise:**
```sql
-- 0007 ke end mein likha hai:
-- volunteers.total_pickups is self-writable and could be inflated. It is
-- cosmetic — public_impact() derives its numbers from donations and deliveries,
-- not from this column — so it is left for Phase 3.
```
Yeh **jaanbujh ke** chhoda hai aur **likh ke** chhoda hai. Volunteer isko badha sakta hai, lekin yeh sirf uske dashboard pe dikhta hai — public impact numbers isse nahi aate. **Known gap documented > unknown gap.**

---

## 3.4 `donations` — central entity

```sql
create table public.donations (
  id                  uuid primary key default gen_random_uuid(),
  donor_id            uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  description         text,
  food_type           food_type not null,              -- MANDATORY (FSSAI + cultural)
  is_cooked           boolean not null default true,
  allergens           text,
  quantity_desc       text not null,
  servings_estimate   int check (servings_estimate >= 0),
  prepared_at         timestamptz,                     -- MANDATORY when is_cooked
  best_before         timestamptz not null,            -- MANDATORY, drives EXPIRED
  storage_condition   storage_condition not null default 'room',
  photo_url           text,
  pickup_address      text not null,
  pickup_landmark     text,
  pickup_lat          numeric(9,6) not null,
  pickup_lng          numeric(9,6) not null,
  pickup_window_start timestamptz not null,
  pickup_window_end   timestamptz not null,
  status              donation_status not null default 'draft',
  claimed_by_ngo      uuid references public.ngos(id),
  assigned_volunteer  uuid references public.volunteers(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint prepared_before_bestbefore check (prepared_at is null or prepared_at <= best_before),
  constraint valid_pickup_window       check (pickup_window_start < pickup_window_end)
);
```

### UUID primary key — auto-increment `id` kyun nahi

| | `serial` (1,2,3…) | **`uuid`** |
|---|---|---|
| Guess kar sakte? | **Haan** — `/donations/5` → `/donations/6` try karo | Nahi |
| Business leak | **Haan** — ID 400 matlab 400 donations hui | Nahi |
| Client-side bana sakte? | Nahi | Haan |

**Food4All mein decisive wajah:** `/trace/<id>` link WhatsApp pe public share hota hai. Agar ID `7` hoti, to koi bhi `1,2,3…` ghuma ke **sabke donations dekh leta**. UUID guess karna practically impossible hai.

> Isko **IDOR** (Insecure Direct Object Reference) kehte hain — OWASP ki top vulnerabilities mein hai.

### `quantity_desc text` **aur** `servings_estimate int` — dono kyun

Yeh ek **real-world design lesson** hai. Donor bolta hai *"2 bade degh, shayad 100-120 log"*. Usko sirf number mein force karoge to woh galat number daalega.

- `quantity_desc` (`not null`) = **insaan ke liye** — jaisa donor ne kaha
- `servings_estimate` (nullable) = **machine ke liye** — planning aur impact numbers

> **Rule:** jab insaan ki bhasha aur machine ka number alag ho, dono store karo. Ek ko doosre mein zabardasti mat thoso.

### Teen alag timestamps — `prepared_at`, `best_before`, `pickup_window_*`

Yeh teen alag cheezein hain aur teeno chahiye:

| Column | Sawal jiska jawab hai |
|---|---|
| `prepared_at` | Khana **bana kab**? → kitna purana hai |
| `best_before` | **Kab tak** safe hai? → `expired` isi se trigger hota |
| `pickup_window_*` | Donor **kab de sakta** hai? (availability — safety nahi) |

Inko mila dena sabse badi galti hoti. "Pickup 8pm tak" ka matlab yeh **nahi** ki khana 8pm tak safe hai. Shaadi ka khana 2pm ka bana ho sakta hai, 8pm tak pickup available ho — par safe sirf 6pm tak ho.

**`best_before` hi `not null` kyun hai (aur `prepared_at` nahi):** Packaged items (biscuit ke dabbe) mein `prepared_at` nahi pata hota. Par `best_before` hamesha pata hona chahiye — warna platform ko pata hi nahi ki kab rokna hai. **Jo column safety decision drive karta hai, wohi mandatory hai.**

### Do CHECK constraints — "DB mein validation kyun"

```sql
constraint prepared_before_bestbefore check (prepared_at is null or prepared_at <= best_before),
constraint valid_pickup_window       check (pickup_window_start < pickup_window_end)
```

Yeh form mein bhi check hota hai. **Phir DB mein kyun?**

Kyunki form sirf **ek** raasta hai. Data yahan se bhi aa sakta hai: server action, SQL editor, seed script, future mobile app, koi script. **CHECK constraint har raaste pe lagta hai.**

> **Defence in depth** — yeh phrase poore project mein baar-baar aayega. Ek hi rule ko **do-teen layer** pe lagao, kyunki ek layer kabhi na kabhi bypass hogi.

Note: `prepared_at is null or ...` — `NULL` allowed hai (packaged food), lekin agar diya hai to logical hona chahiye.

### `claimed_by_ngo` aur `assigned_volunteer` nullable kyun

Kyunki lifecycle ke shuru mein yeh hote hi nahi. Donation banti hai → tab koi NGO nahi. Yahan `NULL` ka matlab saaf hai: **"abhi tak nahi hua"**.

Aur `references public.ngos(id)` / `references public.volunteers(id)` (`profiles` nahi) — jaisa 3.3 mein bataya, **DB khud galat role ko assign hone se rok raha hai.**

---

## 3.5 `donation_events` — append-only audit trail

```sql
create table public.donation_events (
  id          uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  from_status donation_status,          -- nullable: pehli entry pe kuch nahi tha
  to_status   donation_status not null,
  actor_id    uuid references public.profiles(id),   -- nullable: system bhi actor ho sakta
  actor_role  user_role,
  note        text,
  created_at  timestamptz not null default now()
);
create index idx_events_donation on public.donation_events (donation_id);
```

**Yeh table kyun zaroori hai.** `donations.status` sirf **abhi kya hai** batata hai. Yeh table batata hai **kya-kya hua**:

```
draft → available        (donor)
available → claimed      (ngo)
claimed → pickup_scheduled (volunteer)
pickup_scheduled → picked_up (volunteer)
picked_up → delivered    (volunteer)
delivered → completed    (ngo)
```

**Append-only ka matlab:** isme sirf `INSERT` hota hai. Koi `UPDATE` policy nahi, koi `DELETE` policy nahi — dekho `0002_rls.sql`, sirf `events_select` hai. **History badli nahi ja sakti.**

> **Concept ka naam:** *Event Sourcing* (ka halka version). Fayda: `donations` row mein 6 baar `UPDATE` hua, par `donation_events` mein 6 permanent rows hain. Kisi bhi waqt poora itihaas reconstruct ho sakta hai.

**`actor_id` nullable kyun hai — yeh ek sundar detail hai:**

```sql
-- 0005_expiry.sql se:
-- actor_id / actor_role stay NULL on purpose: the system expired this, not a
-- person, and the audit trail should say so.
```

Jab cron job donation expire karta hai, koi insaan nahi hota. `actor_id = NULL` ka matlab hai **"system ne kiya"**. Yahan kisi admin ka ID likh dena **jhooth** hota — audit trail mein jhooth sabse buri cheez hai.

**`from_status` nullable:** pehli event pe pehle koi status tha hi nahi.

---

## 3.6 `deliveries` — proof of completion

```sql
create table public.deliveries (
  id                 uuid primary key default gen_random_uuid(),
  donation_id        uuid not null unique references public.donations(id) on delete cascade,
  volunteer_id       uuid references public.volunteers(id),
  ngo_id             uuid references public.ngos(id),
  servings_delivered int check (servings_delivered >= 0),
  proof_photo_url    text,
  recipient_note     text,
  delivered_at       timestamptz not null default now()
);
```

**`unique` — yeh ek shabd bada kaam kar raha hai:**

```sql
donation_id uuid not null unique references public.donations(id)
```

`unique` ka matlab: **ek donation ki ek hi delivery**. Iske bina ek volunteer same donation ke liye 5 delivery rows daal sakta tha — aur `public_impact()` `servings_delivered` ka `sum()` leta hai, matlab **impact numbers 5 guna** dikh jaate.

> Ek keyword se poora metric-inflation attack band. **Constraint > code.**

**`servings_delivered` alag kyun (donation ka `servings_estimate` hai na?):**
Estimate 120 tha, pahunche 38. **Yeh gap hi asli data hai** — platform kitna accurate hai woh isse pata chalta hai. Test mein yahi dikha: donation 120 ka, delivery 38, impact mein `meals_served: 38` — **jo actually pahuncha, wahi gina.**

---

## 3.7 Indexes — kya hai, aur hamare 6 kya karte hain

**Index hota kya hai:** kitaab ke peeche wala index. Uske bina "Haversine" dhoondhne ke liye poori kitaab padhni padegi (**full table scan**). Index ke saath seedha page number.

**Cost:** har `INSERT`/`UPDATE` pe index bhi update hota hai → likhna thoda slow. Isiliye index **sirf un columns pe** jo `WHERE`/`JOIN`/`ORDER BY` mein aate hain.

```sql
create index idx_donations_status    on public.donations (status);
create index idx_donations_geo       on public.donations (pickup_lat, pickup_lng);
create index idx_donations_ngo       on public.donations (claimed_by_ngo);
create index idx_donations_volunteer on public.donations (assigned_volunteer);
create index idx_donations_donor     on public.donations (donor_id);
create index idx_events_donation     on public.donation_events (donation_id);
```

| Index | Kaunsi query ke liye |
|---|---|
| `status` | `/donations` page: `where status = 'available'` — **sabse zyada chalne wali query** |
| `(lat, lng)` | Area ke hisaab se filter (deep dive neeche) |
| `claimed_by_ngo` | NGO dashboard: "maine kya claim kiya" |
| `assigned_volunteer` | Volunteer dashboard: "mujhe kya mila" |
| `donor_id` | Donor dashboard + **RLS policy khud** yeh column check karti hai |
| `donation_events.donation_id` | Trace page pe timeline |

**Ek important baat — RLS khud index use karti hai.** `donations_select` policy mein `donor_id = auth.uid()` hai. Yeh check **har row pe** chalta hai. Bina index ke RLS khud bottleneck ban jaati.

### `idx_donations_geo` pe honest note

```sql
create index idx_donations_geo on public.donations (pickup_lat, pickup_lng);
```

Yeh **composite B-tree** index hai. B-tree ki ek limitation hai: woh **left-to-right** kaam karta hai. Matlab:

- ✅ `where pickup_lat between 28.4 and 28.7` → index use hoga
- ⚠️ `where pickup_lng between 77.1 and 77.3` → **akela `lng` pe index kaam nahi karega** (kyunki woh second column hai)
- ⚠️ Dono ka range → index `lat` ko filter karega, phir baaki rows scan hongi

**Yeh 2D search ke liye perfect nahi hai.** Perfect solution PostGIS ka **GiST index** hai, jo actually 2 dimension samajhta hai.

> **Yeh jaanbujh ke accept kiya hai:** MVP mein ek shehar, sau-do-sau donations. Lakhs pe yeh todega. **Viva mein yeh bolna strong point hai** — "mujhe pata hai yeh kahan todega aur fix kya hai" — "maine best index lagaya hai" se kahin behtar jawab hai.

---
---

# PART 4 — State Machine: donation ka lifecycle

> File: `supabase/migrations/0003_state_machine.sql` (170 lines)

## 4.0 State machine hoti kya hai

Ek system jisme:
- **States** (kaunsi halat mein ho sakta hai)
- **Transitions** (kaun si halat se kaun si mein ja sakte ho)
- **Guards** (shart — kaun, kab)

Roz ka example: ATM. `idle → card_inserted → pin_entered → menu → dispensing → idle`. Aap `idle` se seedha `dispensing` nahi ja sakte. 😄

**Food4All ke 9 states:**

```
  draft ──────► available ──────► claimed ──────► pickup_scheduled
    │               │                │  ▲                │
    │               │                │  └──── (release)  │
    ▼               ▼                ▼                   ▼
cancelled       expired          expired            picked_up
                cancelled        cancelled              │
                                                        ▼
                                                    delivered
                                                        │
                                                        ▼
                                                    completed
```

## 4.1 Allowed edges — code mein

```sql
create or replace function public.is_valid_transition(p_from donation_status, p_to donation_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'draft'            then p_to in ('available', 'cancelled')
    when 'available'        then p_to in ('claimed', 'cancelled', 'expired')
    when 'claimed'          then p_to in ('pickup_scheduled', 'available', 'expired', 'cancelled')
    when 'pickup_scheduled' then p_to in ('picked_up', 'cancelled')
    when 'picked_up'        then p_to in ('delivered')
    when 'delivered'        then p_to in ('completed')
    else false
  end
$$;
```

**Teen cheezein dhyan se dekho:**

**(a) `claimed → available` wapas ja sakta hai.** Yeh **release** hai — NGO ne claim kiya par ab nahi le sakta. Real duniya mein aisa hota hai. Agar yeh edge na hoti, to NGO ko `cancel` karna padta aur achha khana barbaad ho jaata. Aur RPC mein iske saath side-effect hai:
```sql
d.claimed_by_ngo := null;
d.assigned_volunteer := null;   -- saaf karke wapas pool mein
```

**(b) `picked_up` ke baad `cancelled` nahi hai.** Jaanbujh ke. Khana gaadi mein hai — ab "cancel" ka matlab kya? Ya to `delivered` hoga ya phir woh ek real-world problem hai jiska record rehna chahiye. **State machine jhooth bolne se rok rahi hai.**

**(c) `else false`** — `completed`, `cancelled`, `expired` **terminal** hain. Wahan se kahin nahi ja sakte. Yeh `public_impact()` ki numbers ko permanent banata hai.

**`immutable` keyword:** iska matlab same input → hamesha same output. Postgres isko cache kar sakta hai aur index mein use kar sakta hai. (`stable` = ek query ke andar same; `volatile` = kuch bhi.)

## 4.2 Do layer protection — RPC *aur* trigger dono kyun

Yeh project ka **sabse important design decision** hai.

### Layer 1 — `transition_donation()` RPC (asli darwaza)

```sql
create or replace function public.transition_donation(
  p_id uuid, p_to donation_status, p_note text default null, p_volunteer uuid default null
) returns public.donations
language plpgsql security definer set search_path = public as $$
declare
  d      public.donations;
  v_uid  uuid      := auth.uid();
  v_role user_role := public.app_role(auth.uid());
  v_from donation_status;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into d from public.donations where id = p_id for update;   -- ← ROW LOCK
  ...
```

**`for update` — race condition ka ilaaj.** Socho do NGO ek hi second mein same donation claim karte hain:

```
Bina lock:                          for update ke saath:
NGO-A: status padha = 'available'   NGO-A: padha + ROW LOCK laga diya
NGO-B: status padha = 'available'   NGO-B: ⏳ rukna padega
NGO-A: 'claimed' kar diya           NGO-A: 'claimed' kiya, commit, lock chhoda
NGO-B: 'claimed' kar diya  ← BUG!   NGO-B: ab padha = 'claimed' → ERROR ✅
                                           "Illegal transition: claimed → claimed"
```

Donation ek hai, NGO do — bina lock ke **dono ko lagta hai unhe mil gaya**, aur volunteer confuse. `for update` isko DB level pe khatam karta hai.

**Phir role guards — har target state ke liye alag:**

```sql
if p_to = 'available' and v_from = 'draft' then                 -- publish
  if not (d.donor_id = v_uid or v_role = 'admin') then
    raise exception 'Only the donor can publish this donation';
  end if;
  if d.best_before <= now() then
    raise exception 'best_before must be in the future to publish';
  end if;

elsif p_to = 'claimed' then
  if not (v_role in ('ngo', 'admin')) then
    raise exception 'Only an NGO can claim a donation';
  end if;
  if d.best_before <= now() then
    raise exception 'Donation is past its freshness window';
  end if;
  d.claimed_by_ngo := v_uid;                                     -- side-effect

elsif p_to = 'pickup_scheduled' then
  if v_role = 'volunteer' then
    d.assigned_volunteer := v_uid;                               -- self-accept
  elsif v_role in ('ngo', 'admin') then
    if p_volunteer is null then
      raise exception 'p_volunteer is required when an NGO/admin assigns a pickup';
    end if;
    d.assigned_volunteer := p_volunteer;                         -- NGO assigns
  else
    raise exception 'Not allowed to schedule a pickup';
  end if;
  ...
```

Poora role-permission matrix:

| Transition | Kaun kar sakta | Extra shart |
|---|---|---|
| `draft → available` | donor (ya admin) | `best_before` future mein ho |
| `available → claimed` | **koi bhi NGO** | abhi tak fresh ho |
| `claimed → available` | **wahi** NGO | NGO + volunteer saaf |
| `→ pickup_scheduled` | volunteer (khud) **ya** NGO (kisi ko de ke) | NGO de raha ho to `p_volunteer` chahiye |
| `→ picked_up` | **assigned** volunteer | |
| `→ delivered` | **assigned** volunteer | |
| `→ completed` | **claiming** NGO | |
| `→ cancelled` | koi bhi party | |
| `→ expired` | **sirf admin/system** | |

> `completed` donor nahi, **NGO** mark karta hai. Yeh jaanbujh ke hai — **jisne receive kiya wahi confirm karega.** Donor khud bol de "ho gaya" to woh self-reported impact hai, verified nahi.

**Aur aakhir mein — update + audit ek saath:**

```sql
  update public.donations
     set status = p_to, claimed_by_ngo = d.claimed_by_ngo,
         assigned_volunteer = d.assigned_volunteer, updated_at = now()
   where id = p_id returning * into d;

  insert into public.donation_events(donation_id, from_status, to_status, actor_id, actor_role, note)
  values (p_id, v_from, p_to, v_uid, v_role, p_note);
  return d;
end; $$;

grant execute on function public.transition_donation(uuid, donation_status, text, uuid) to authenticated;
```

Function **ek transaction** hai. Status update aur audit insert — **dono honge ya dono nahi.** Status badal jaaye par audit na likhe — aisa ho hi nahi sakta.

### Layer 2 — BEFORE UPDATE trigger (safety net)

```sql
create or replace function public.enforce_donation_transition()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status
     and not public.is_valid_transition(old.status, new.status) then
    raise exception 'Illegal donation transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create trigger trg_donations_transition_guard
  before update on public.donations
  for each row execute function public.enforce_donation_transition();
```

**Sawal: RPC mein already check hai, to trigger kyun?**

Kyunki **RPC ek darwaza hai, trigger deewar hai.** RPC tabhi chalta hai jab koi usko *call* kare. Trigger **har UPDATE pe** chalta hai — chahe:

- App ne seedha `supabase.from('donations').update({status: 'completed'})` kar diya
- Maine SQL editor mein galat query chala di
- Koi future developer naya code likhe aur RPC call karna bhool jaaye
- Migration script mein bug ho

**Sabko trigger rokega.**

> `is distinct from` use kiya, `!=` nahi. Kyunki SQL mein `NULL != NULL` ka jawab `NULL` hota hai (`true` nahi). `is distinct from` NULL ko theek se handle karta hai. **Chhota detail, lekin yahi wo jagah hai jahan SQL bugs chhupte hain.**

**Test mein yeh proven hai** — `draft → delivered` try kiya:
```
✓ Illegal transition: draft -> delivered   (status unchanged)
```

---

# PART 5 — Security: Row-Level Security

> File: `supabase/migrations/0002_rls.sql` (132 lines)

## 5.0 RLS hai kya aur kyun chahiye

Normal app mein security **backend code** mein hoti hai:
```js
app.get('/donations', (req,res) => {
  if (!req.user) return res.status(401);
  db.query('select * from donations where donor_id = $1', [req.user.id]);
});
```
Yahan bharosa **aap pe** hai ki har endpoint pe yeh check likhoge. **Ek endpoint bhool gaye = hole.**

**RLS mein rule table se chipka hota hai.** Query kahin se bhi aaye, Postgres usme automatically condition jod deta hai.

```sql
alter table public.donations enable row level security;

create policy donations_select on public.donations
  for select using (
    donor_id = auth.uid()
    or status = 'available'
    or claimed_by_ngo = auth.uid()
    or assigned_volunteer = auth.uid()
    or public.is_admin()
  );
```

Ab agar browser `select * from donations` bheje, Postgres actually yeh chalata hai:

```sql
select * from donations
where (donor_id = auth.uid() or status = 'available' or ... );   -- ← khud joda
```

> **Isi wajah se Supabase ka model kaam karta hai.** Browser seedha DB se baat kar sakta hai, kyunki DB khud apni raksha kar raha hai. "Backend bhool gaya check lagana" wali poori category of bugs khatam.

**`USING` vs `WITH CHECK` — yeh fark Part 6 ke liye critical hai:**

| Clause | Kab chalta | Kya dekhta |
|---|---|---|
| `USING` | SELECT / UPDATE / DELETE | **OLD row** — "yeh row tumhe chhune ki ijazat hai?" |
| `WITH CHECK` | INSERT / UPDATE | **NEW row** — "yeh nayi value likhne ki ijazat hai?" |

Isko yaad rakho. Part 6 ka sabse important lesson isi pe khada hai.

## 5.1 SECURITY DEFINER helpers — aur infinite recursion ki problem

```sql
create or replace function public.app_role(uid uuid)
returns user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = uid $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
```

**`security definer` kyun — yahan ek asli trap hai:**

`profiles` table pe bhi RLS lagi hai. Ab socho agar `is_admin()` normal function hota:

```
donations ki policy chali
  → is_admin() call hua
    → profiles se padhne ki koshish
      → profiles ki policy chali
        → usme bhi is_admin() hai
          → profiles se padhna
            → ... ∞ INFINITE RECURSION
```

**`security definer` ka matlab:** yeh function **function banane wale** (owner) ke permissions se chalta hai, caller ke nahi. Owner RLS bypass karta hai → recursion toot gayi.

> ⚠️ **`security definer` khatarnak bhi hai** — woh RLS bypass kar raha hai. Isiliye do rule:
> 1. Function **bahut chhota** rakho (bas ek lookup)
> 2. **`set search_path = public` hamesha likho** — warna attacker apna `profiles` table bana ke search path mein daal sakta hai aur aapka function uske table se padhega. Yeh ek real, documented Postgres attack hai.

**Teesra helper — `can_see_exact`, ismein `security definer` nahi hai:**

```sql
create or replace function public.can_see_exact(d public.donations)
returns boolean language sql stable as $$
  select d.donor_id = auth.uid()
      or d.claimed_by_ngo = auth.uid()
      or d.assigned_volunteer = auth.uid()
      or public.is_admin()
$$;
```

Kyunki isko **row pass ki jaa rahi hai** (`d public.donations`) — yeh khud table se nahi padh raha, to recursion ka khatra nahi. **Jahan zaroorat nahi, wahan `security definer` nahi lagaya** — minimum privilege.

## 5.2 Privacy masking — `donations_public` view

Yeh design ka sabse sundar hissa hai.

**Problem:** donation list sabko dikhni chahiye (warna NGO claim kaise karega). Lekin **ghar ka exact address** sabko nahi dikhna chahiye — koi bhi signup karke saare donors ke ghar ka pata nikaal lega.

**Solution — view jo masking karta hai:**

```sql
create or replace view public.donations_public
with (security_invoker = on) as
select
  d.id, d.donor_id, d.title, ..., d.status,
  case when public.can_see_exact(d) then d.pickup_address  else null end as pickup_address,
  case when public.can_see_exact(d) then d.pickup_landmark else null end as pickup_landmark,
  case when public.can_see_exact(d) then d.pickup_lat else round(d.pickup_lat, 2) end as pickup_lat,
  case when public.can_see_exact(d) then d.pickup_lng else round(d.pickup_lng, 2) end as pickup_lng,
  public.can_see_exact(d) as address_revealed
from public.donations d;

grant select on public.donations_public to authenticated, anon;
```

**`round(lat, 2)` ka asli matlab:**

| Decimals | Precision | Dikhta kya hai |
|---|---|---|
| 6 (asli) | ~11 cm | **Exact darwaza** |
| **2 (masked)** | **~1.1 km** | **Mohalla** |

Matlab anonymous user ko dikhta hai *"Karol Bagh ke aaspaas 120 thali hain"* — par kis ghar mein, yeh nahi. Jaise hi NGO claim karta hai, `can_see_exact` `true` ho jaata hai aur exact address khul jaata hai.

> **Yeh "Privacy by Design" ka textbook example hai** — aur GDPR/DPDP mein "data minimisation" principle yahi kehta hai: **kaam chalane ke liye jitna minimum chahiye, utna hi do.**

`address_revealed` boolean isliye hai taaki UI honestly keh sake: *"Exact address claim karne par dikhega"* — user ko pata rahe ki kuch chhupa hai.

## 5.3 Bug B — `security_invoker` view vs `security definer` function

**Yeh bug mujhe khud mila tha aur yeh poore doc ka sabse achha "aha" moment hai.**

0003 mein yeh view banayi thi:

```sql
create or replace view public.impact_summary with (security_invoker = on) as
select count(*) filter (where d.status = 'completed') as donations_completed, ...
from public.donations d left join public.deliveries dl on dl.donation_id = d.id;
```

**`security_invoker = on`** ka matlab: view **caller ki RLS** ke hisaab se chalegi.

Landing page pe yeh numbers dikhane the. Lekin landing page pe visitor **anonymous** hai. Anonymous user ko `donations_select` policy se sirf `status = 'available'` rows dikhti hain.

**Natija:** `count(*) filter (where status = 'completed')` → **hamesha 0**.

> Yeh "bug" nahi tha jo kabhi-kabhi hota hai. Yeh **structurally hamesha zero** tha. Landing page pe "0 meals served" likha aata — ek rescue platform ke liye sabse buri cheez.

**Fix (0004) — aggregates ke liye alag function:**

```sql
create or replace function public.public_impact()
returns table (donations_completed bigint, meals_served bigint, active_volunteers bigint,
               partner_ngos bigint, missed_expired bigint)
language sql stable security definer set search_path = public
as $$
  select
    count(*) filter (where d.status = 'completed'),
    coalesce(sum(dl.servings_delivered), 0)::bigint,
    count(distinct d.assigned_volunteer) filter (where d.assigned_volunteer is not null),
    count(distinct d.claimed_by_ngo)     filter (where d.claimed_by_ngo is not null),
    count(*) filter (where d.status = 'expired')
  from public.donations d left join public.deliveries dl on dl.donation_id = d.id;
$$;

grant execute on function public.public_impact() to anon, authenticated;
```

**Yeh safe kyun hai, jabki `security definer` RLS bypass kar raha hai?**

Kyunki yeh **sirf aggregates** return karta hai. `count`, `sum` — bas. Koi address nahi, koi naam nahi, koi row nahi. Aap `public_impact()` se kabhi kisi ek donation ki detail nahi nikaal sakte.

> **Lesson jo yaad rakhna hai:**
> **RLS rows ke liye hai. Aggregates rows nahi hote.**
> Jab public ko "kitne" batana ho par "kaun se" nahi — **tight, aggregate-only SECURITY DEFINER function** sahi tool hai, RLS ko bend karna nahi.

Dono abhi bhi exist karte hain — `impact_summary` (logged-in users ka apna slice) aur `public_impact()` (public global numbers). Dono ka alag maqsad hai.

**Test se asli output:**
```json
{"donations_completed":1,"meals_served":38,"active_volunteers":1,"partner_ngos":1,"missed_expired":1}
```

`missed_expired: 1` pe gaur karo. **Hum apni failure bhi count karte hain aur public dikhate hain.** Seed file mein likha hai:

> *"a rescue platform that hides its misses cannot be audited."*

---
---

# PART 6 — Chaar security holes jo mile, aur unke fix

> Files: `0006_insert_guard.sql`, `0007_privilege_guards.sql`

**Yeh kaise mile:** e2e test likhte waqt. Test ka maqsad tha "happy path chalta hai ya nahi" — par usme ek sawal aaya: *"agar main galat cheez karoon to kya hoga?"* Us ek sawal se **chaar asli vulnerabilities** nikli.

> **Yeh poore project ka sabse valuable section hai.** Code likhna aasaan hai; **apne hi code ko todne ki koshish karna** — woh engineering hai.

---

## HOLE 1 — Donor kisi bhi status mein donation bana sakta tha

**Purani policy (0002):**
```sql
create policy donations_insert_donor on public.donations
  for insert with check (donor_id = auth.uid() and public.app_role(auth.uid()) = 'donor');
```

Yeh batata hai **kaun** insert kar sakta hai. Yeh nahi batata **kis state mein**.

**Attack:**
```js
await supabase.from('donations').insert({
  donor_id: myId,
  status: 'completed',        // ← seedha!
  servings_estimate: 10000,
  ...
});
```

**Kya hota:**
1. Poori state machine **skip** — koi NGO ne claim nahi kiya, koi volunteer nahi gaya
2. `public_impact()` `status='completed'` ginta hai → **public impact numbers jhoothe**
3. `donation_events` khaali — ek "completed" rescue jiska koi itihaas hi nahi

**`transition_donation()` ne isko kyun nahi roka?** Kyunki usko **call hi nahi kiya gaya**. Guard tabhi guard karta hai jab aap uske paas se guzro. Yeh attacker to deewar phaand ke andar aaya.

**Fix (0006):**
```sql
drop policy if exists donations_insert_donor on public.donations;

create policy donations_insert_donor on public.donations
  for insert with check (
    donor_id = auth.uid()
    and public.app_role(auth.uid()) = 'donor'
    and status = 'draft'                    -- ← sirf shuruaat se
    and claimed_by_ngo is null              -- ← belt
    and assigned_volunteer is null          -- ← and braces
  );
```

**Principle:** **state machine mein sirf uske start se ghusa ja sakta hai.** Baaki har state sirf `transition_donation()` se — jahan role check, freshness check aur audit trail rehte hain.

**Test output:**
```
✓ new row violates row-level security policy for table "donations"
```

---

## HOLE 2 — Koi bhi signup form se **admin** ban sakta tha

**Yeh chaaron mein sabse khatarnak tha.**

**Purana code:**
```sql
v_role user_role := coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'donor');
```

`raw_user_meta_data` = **jo client ne `signUp()` mein bheja**. Matlab:

```js
await supabase.auth.signUp({
  email, password,
  options: { data: { role: 'admin' } }      // ← bas itna
});
```

**Aur aap asli admin ban gaye.** `is_admin()` kya-kya kholta hai:

- `donations_select` → **har donor ka exact ghar ka pata**
- `profiles_select` → sabke naam, phone number
- `transition_donation()` ke saare ownership checks bypass
- Expiry sweep

> Ek anonymous signup form se **poora donor privacy breach**. Yeh exactly woh cheez hai jisse log news mein aate hain.

**Fix (0007) — client ki baat pe bharosa band:**
```sql
-- Client-supplied and therefore untrusted.
v_requested text     := new.raw_user_meta_data ->> 'role';
-- Only these three are self-serviceable. 'admin' is granted in SQL, never requested.
v_role      user_role := case
                           when v_requested in ('donor', 'ngo', 'volunteer')
                             then v_requested::user_role
                           else 'donor'           -- anything else → donor
                         end;
```

**Allowlist, blocklist nahi.** Agar likha hota `when v_requested = 'admin' then 'donor'`, to kal `superadmin` naam ka role add karte hi hole wapas aa jaata. **Allowlist mein jo nahi likha, woh allowed nahi** — by default.

---

## HOLE 3 — User baad mein khud ko promote kar sakta tha

Hole 2 fix karne ke baad bhi yeh raasta khula tha:

```sql
create policy profiles_update_self_or_admin on public.profiles
  for update using (id = auth.uid() or public.is_admin());
```

**Attack:**
```js
await supabase.from('profiles').update({ role: 'admin' }).eq('id', myId);
```

Policy kehti hai `id = auth.uid()` — **sach hai**. Role badalne ke baad bhi `id` wahi hai. **Policy isko kabhi pakad hi nahi sakti thi.**

## HOLE 4 — NGO khud ko verify kar sakta tha

```sql
create policy ngos_update_own_or_admin on public.ngos
  for update using (id = auth.uid() or public.is_admin());
```

```js
await supabase.from('ngos').update({ verification_status: 'verified' }).eq('id', myId);
```

Aur `ngos_select` policy har verified NGO ko sabko dikhati hai. Matlab **platform ka poora trust signal applicant khud ko de sakta tha.** "Verified NGO" ka matlab hi khatam.

---

## 💡 Hole 3 aur 4 ka asli lesson — yeh viva ke liye sabse strong point hai

**Sawal: policy mein hi `role` column protect kyun nahi kar diya?**

Kyunki **RLS policy mein yeh likha hi nahi ja sakta.** Yaad karo Part 5.0 ki table:

| Clause | Kya dekhta hai |
|---|---|
| `USING` | **OLD row** |
| `WITH CHECK` | **NEW row** |

**Kabhi dono ek saath nahi.**

Aur *"apni row edit kar sakte ho, par yeh column nahi"* ka matlab hai:

```
new.role == old.role ?
```

Yeh **OLD aur NEW ki comparison** hai. Policy ke paas ek waqt mein dono hote hi nahi. **Yeh policy ki limitation nahi, policy ka design hai.**

**Jahan policy nahi pahunchti, wahan trigger pahunchta hai** — kyunki trigger ko dono milte hain:

```sql
create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role            -- ← DONO available!
     and auth.uid() is not null                    -- null = service role / cron / SQL editor
     and not public.is_admin() then
    raise exception 'Only an admin can change a user role' using errcode = '42501';
  end if;
  return new;
end; $$;

create trigger profiles_no_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();
```

Aur NGO verification ke liye bilkul wahi pattern:

```sql
create or replace function public.prevent_self_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.verification_status is distinct from old.verification_status
      or new.verified_by is distinct from old.verified_by
      or new.verified_at is distinct from old.verified_at)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change NGO verification' using errcode = '42501';
  end if;
  return new;
end; $$;
```

> **Ek line mein yaad rakho:**
> **Policy = "kaunsi row chhoo sakte ho". Trigger = "us row mein kya badal sakte ho".**
> Column-level rules hamesha trigger ka kaam hain.

### `auth.uid() is not null` — yeh chhoti line badi soch hai

```sql
and auth.uid() is not null    -- null = service role / cron / SQL editor
```

Agar yeh na hoti, to **pehla admin banta hi nahi**. Chicken-and-egg: role badalne ke liye admin chahiye, admin banane ke liye role badalna hai.

`auth.uid()` `NULL` tab hota hai jab koi logged-in user nahi — matlab **service role, pg_cron, ya aapka apna SQL editor**. Yeh pehle se hi trusted hain (RLS bypass karte hain). To unko allow karna koi nayi chhoot nahi de raha.

Legit admin banane ka tareeka:
```sql
update public.profiles set role = 'admin'
 where id = (select id from auth.users where email = 'you@example.com');
```

> **Yeh ek real bug tha jo maine khud pakda tha** — 0007 likhne ke baad ehsaas hua ki seed file ka admin trigger se downgrade ho jaayega. Isiliye seed mein explicit promotion likhi aur trigger mein yeh exception. **Migration likhte waqt soch lena ki purana data kya hoga — yeh production thinking hai.**

**Test output (dono blocked):**
```
✓ Only an admin can change a user role
✓ Only an admin can change NGO verification
```

### Chaaron holes ek nazar mein

| # | Hole | Jo galti thi | Fix ka tool |
|---|---|---|---|
| 1 | Koi bhi status insert | Policy ne **state** nahi dekha | RLS policy mein `status='draft'` |
| 2 | Signup se admin | **Client data pe bharosa** | Server-side allowlist |
| 3 | Self-promote | Policy **column** nahi dekh sakti | BEFORE UPDATE trigger |
| 4 | Self-verify | Wahi | BEFORE UPDATE trigger |

**Common thread:** chaaron mein galti yeh thi ki **"input pe bharosa"** kiya gaya. Security ka ek hi mool mantra hai: *jo bhi client se aaya, woh jhooth ho sakta hai.*

---

# PART 7 — Auto-expiry: khana jo waqt nikalne par khud hat jaaye

> File: `supabase/migrations/0005_expiry.sql`

**Problem:** `best_before` column tha, `expired` status tha — par **koi usko trigger nahi karta tha**. Donation `available` padi rehti hamesha ke liye.

Teen nuksaan:
1. Board pe aisa khana dikhta jo **ab safe nahi** — yeh safety issue hai
2. "missed" counter hamesha 0 — platform khud ko perfect dikhata
3. NGO us khane ko claim kar leta jo already kharab ho chuka

```sql
create or replace function public.expire_stale_donations()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer := 0;
begin
  with stale as (
    select id, status from public.donations
    where best_before <= now() and status in ('available', 'claimed')
    for update skip locked          -- never block a live claim/assign
  ),
  bumped as (
    update public.donations d set status = 'expired', updated_at = now()
      from stale s where d.id = s.id
    returning d.id, s.status as prev_status
  )
  insert into public.donation_events (donation_id, from_status, to_status, note)
  select b.id, b.prev_status, 'expired',
         'Auto-expired: best_before passed with no completed handoff.'
  from bumped b;

  get diagnostics v_count = row_count;
  return v_count;
end; $$;
```

### Teen design decisions jo sochne layak hain

**(1) Sirf `available` aur `claimed` sweep hote hain**

```sql
where status in ('available', 'claimed')
```

Comment mein poori wajah likhi hai:
- `pickup_scheduled` / `picked_up` — **volunteer raaste mein hai.** Usko automatically "expired" kar dena galat hai; yeh insaan ka faisla hai (cancel kare ya complete), cron ka nahi.
- `draft` — kabhi publish hi nahi hui, kisi ko offer hi nahi ki gayi. **Jo kabhi offer nahi hui, woh "miss" nahi hui.** Donor edit karke publish kar sakta hai.

> **Yeh "soch ke scope rakhna" hai.** Sabse aasaan hota `where best_before <= now()` likh dena — aur woh galat hota.

**(2) `for update skip locked`**

`for update` = row lock lo. `skip locked` = **jo row kisi aur ne lock ki hui hai, usko chhod do**.

Socho cron 2:00:00 pe chala, aur usi second ek NGO koi donation claim kar raha hai. Bina `skip locked` ke cron **wait karta** — aur poora sweep ruk jaata ek user ke peeche.

`skip locked` kehta hai: *"yeh row busy hai? koi baat nahi, chhodo, agle 10 minute mein pakad lenge."*

> **Yeh background jobs ka standard pattern hai** — queue workers isi se bante hain. Sweep kabhi bhi live user ko block nahi karegi.

**(3) `actor_id` NULL — system ne kiya**

```sql
-- actor_id / actor_role stay NULL on purpose: the system expired this, not a
-- person, and the audit trail should say so.
insert into public.donation_events (donation_id, from_status, to_status, note)
select b.id, b.prev_status, 'expired', 'Auto-expired: ...'
```

Yahan kisi admin ki ID daal dena technically aasaan hota, par woh **audit trail mein jhooth** hota. Audit trail ki poori value yeh hai ki woh sach bolta hai.

**Test ne yeh verify kiya:** expiry ke baad audit row padhi aur assert kiya ki `actor_id is null`.

### Admin wrapper — demo ke liye

```sql
create or replace function public.admin_expire_stale_donations()
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  return public.expire_stale_donations();
end; $$;

grant execute on function public.admin_expire_stale_donations() to authenticated;
revoke all on function public.expire_stale_donations() from anon, authenticated;
```

**Do alag functions kyun:** asli sweeper kisi app user ko mila hi nahi hua (`revoke all`). Wrapper admin ko mila hai. **Viva mein 10 minute intezaar nahi karna padega** — admin button dabao, sweep chal gayi.

### pg_cron — aur migration ko "fail-safe" banana

```sql
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron is not enabled. Enable it under Database -> Extensions, then re-run this DO block. Until then, sweep with: select public.admin_expire_stale_donations();';
    return;
  end if;

  perform cron.unschedule('food4all-expire-stale')
  where exists (select 1 from cron.job where jobname = 'food4all-expire-stale');

  perform cron.schedule('food4all-expire-stale', '*/10 * * * *',
    $cron$select public.expire_stale_donations();$cron$);
  raise notice 'Scheduled food4all-expire-stale every 10 minutes.';
end $$;
```

**Do cheezein yahan seekhne layak hain:**

**(a) Migration kabhi fail nahi hoti.** `create extension pg_cron` likh dete to jis DB pe pg_cron nahi hai, wahan **poori migration fail** ho jaati — aur uske pehle wala kaam bhi aadha reh jaata. Yahan woh sirf ek `notice` chhap ke aage badh jaati hai.

**(b) Migration dobara chalayi ja sakti hai (idempotent).** Pehle `unschedule`, phir `schedule`. Agar aap yeh file do baar chala do, do cron job nahi banenge.

> **Migrations ka sunehri niyam: har migration dobara chalaane par bhi safe honi chahiye.** Production mein yeh baar-baar bachata hai.

---

# PART 8 — Food Safety aur FSSAI alignment

Yeh sirf "compliance" wala boring section nahi hai — **isne schema badla hai**, isliye yeh engineering ka hissa hai.

## 8.1 Platform ki legal position

FSSAI ki *"Save Food, Share Food"* guidelines food donation ko encourage karti hain. India mein **Food Donor ko protection** bhi hai (FSS Act ke tahat, agar khana surakshit tareeke se diya gaya ho).

**Food4All khud khana nahi chhoota.** Hum **coordinator** hain, **guarantor** nahi. Yeh distinction har design decision mein dikhta hai:

| Hum karte hain | Hum nahi karte |
|---|---|
| Timing track karna | Khana inspect karna |
| Freshness window enforce karna | "Yeh khana safe hai" certify karna |
| Chain of custody record karna | Food handling ki zimmedari leni |
| Allergens display karna | Allergen testing |

**Yeh UI mein bhi honestly likha hai** (`TrustSafetyCard` component) — chhupaya nahi gaya.

## 8.2 Guideline → schema mapping

Yeh table dikhati hai ki **rule ne code kaise badla**:

| Safety requirement | Schema mein kya bana |
|---|---|
| Veg/non-veg batana zaroori | `food_type` **`not null`** + `jain` alag value |
| Khana kab bana | `prepared_at` |
| Kab tak safe | `best_before` **`not null`** — expiry isi se chalti |
| Temperature kaise rakha | `storage_condition` enum (`hot_held` = 60°C+) |
| Allergens disclose | `allergens text` |
| Traceability | `donation_events` **append-only** |
| Kitna actually pahuncha | `deliveries.servings_delivered` |
| Purana khana circulate na ho | `expire_stale_donations()` + RPC ke freshness guards |

**Do jagah freshness guard code mein hai:**
```sql
-- publish pe:
if d.best_before <= now() then
  raise exception 'best_before must be in the future to publish';
end if;

-- claim pe (dobara check!):
if d.best_before <= now() then
  raise exception 'Donation is past its freshness window';
end if;
```

Dono jagah kyun? Kyunki publish aur claim ke beech **ghanton ka gap** ho sakta hai. Publish ke waqt fresh thi, claim ke waqt nahi. **Har decision point pe dobara check** — yeh food safety ka basic principle hai, aur yahan literally code mein hai.

## 8.3 `FreshnessMeter` — safety ko dikhane wala UI

```tsx
// har 30 second pe khud update hota hai
// prepared_at → best_before ke beech kitna bacha, percentage bar
// khatam hone par: "EXPIRED — do not distribute"
```

Yeh **client component** hai (`'use client'`) kyunki ise live chalna hai. Server se aaya hua HTML freeze ho jaata.

> **Safety information ko kabhi chhupa ke mat rakho.** Agar khana 20 minute mein kharab hone wala hai, to woh screen pe sabse bada element hona chahiye — ek chhoti grey text nahi.

---
---

# PART 9 — Frontend Architecture

## 9.1 Teen jagah Supabase client — teeno alag kyun

Yeh confuse karta hai, isliye dhyan se:

| File | Kahan chalta | Kyun alag |
|---|---|---|
| `src/lib/supabase/client.ts` | **Browser** | Cookies browser khud deta hai |
| `src/lib/supabase/server.ts` | **Server** | Cookies `next/headers` se padhni padti |
| `middleware.ts` | **Har request pe** | Session refresh karna padta hai |

**Server wala — ek interesting detail:**

```ts
// src/lib/supabase/server.ts
setAll(cookiesToSet) {
  try {
    cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
  } catch {
    // Server Component se cookie set nahi ho sakti — middleware refresh karega
  }
}
```

Yeh `try/catch` khaali nahi hai, **deliberate** hai. Next.js Server Component mein cookies **set nahi** kar sakte (response already ja chuka hota hai). To Supabase jab token refresh karne ki koshish karega, woh error dega. Isko swallow karna sahi hai — **kyunki middleware pehle hi refresh kar chuka hai.**

**Service client — security ke liye:**
```ts
export function createServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;   // ← null, crash nahi
  ...
}
```
Key set nahi hai to `null` return. App chalti rehti hai. **Aur yahi default hai** — `.env.local` mein woh key jaanbujh ke khaali hai.

## 9.2 Middleware — session refresh

```ts
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(url, anonKey, { cookies: { getAll, setAll } });
  await supabase.auth.getUser();     // ← yeh ek line pura kaam karti hai
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

**`getUser()` ka return value use hi nahi ho raha. Phir kyun?**

**Side-effect ke liye.** Supabase ke access tokens ~1 hour mein expire hote hain. `getUser()` check karta hai aur zaroorat pade to refresh token se naya le aata hai, aur cookie update kar deta hai.

Yeh na ho to: user 1 hour kaam karta hai, phir achanak random pages pe logout dikhne lagta hai. **Classic bug.**

**Matcher regex** static files ko skip karta hai — har image pe auth check karna waste hai.

## 9.3 Server Actions — "API route kahan gaya?"

```ts
'use server';   // ← yeh line poori file ko server-only banati hai

export async function transitionDonation(id: string, to: string, opts?) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_donation', {
    p_id: id, p_to: to, p_note: opts?.note ?? null, p_volunteer: opts?.volunteerId ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/donations/${id}`);
  revalidatePath('/donations');
  revalidatePath('/dashboard');
  revalidatePath('/impact');
  return { ok: true };
}
```

Client component isko **seedha import karke call** karta hai, jaise normal function ho. Next.js background mein HTTP request bana deta hai. **Koi `/api/...` route likhna hi nahi pada.**

**`revalidatePath` kya karta hai:** Next.js server-rendered pages cache karta hai. Status badla to purana cache galat ho gaya. Yeh 4 lines kehti hain "in pages ka cache phenk do".

> **Dhyan do ki 4 paths kyun:** ek donation ka status badalne se **4 alag pages** affect hote hain. Agar `/impact` bhool jaate, to impact page purane numbers dikhata rehta. **Yeh soch ke likhna padta hai.**

## 9.4 Sabse important frontend decision — ek hi raasta

```ts
// src/lib/actions.ts mein status badalne ka SIRF yeh ek function hai:
await supabase.rpc('transition_donation', {...});
```

Poore codebase mein kahin bhi `.update({ status: ... })` **nahi** hai.

Teen layer ab ek doosre ko support karti hain:

```
1. App layer    → sirf transitionDonation() export hai
2. RLS layer    → donations_update_owner_draft sirf draft edit karne deti hai
3. Trigger layer→ trg_donations_transition_guard har illegal edge rokta hai
```

> **Agar koi future developer layer 1 todega, layer 2 rokegi. Layer 2 bypass kiya, layer 3 rokegi.** Yahi **defence in depth** hai, poora implement kiya hua.

**`createDonation` mein bhi yahi:**
```ts
status: 'draft' as const,     // hamesha, hardcoded
```
App kabhi kuch aur bhejti hi nahi — **aur RLS policy (0006) isko enforce bhi karti hai.** App ka vaada + DB ka enforcement, dono.

## 9.5 Trace page — bina login ke transparency

`/trace/[id]` kisi ko bhi khula hai. Design clever hai:

```ts
// pehle masked view try karo
let { data } = await supabase.from('donations_public').select('*').eq('id', id).single();
// nahi mila to base table (jahan RLS khud decide karegi)
if (!data) { ... from('donations') ... }
```

Anonymous user ko dikhta hai: title, status, timeline, kitne meals pahunche — **par address nahi** (masked view ne `null` kar diya).

`QRShareCard` isi link ka QR banata hai (external free QR API se — koi npm package nahi, bundle chhota). Donor QR dikhata hai, koi bhi scan karke live status dekh sakta hai.

> **Yeh is project ka asli "product" insight hai:** push notifications nahi bana sakte the (paid), to **share-able proof** banaya — jo WhatsApp pe ghoomta hai, jahan India waise bhi hai.

---

# PART 10 — Testing: 27 assertions kya prove karti hain

> File: `scripts/e2e-test.mjs` (352 lines)

## 10.1 E2E test hota kya hai

| Type | Kya test karta | Example |
|---|---|---|
| **Unit** | Ek function | `haversineKm()` sahi number deta hai? |
| **Integration** | Do hisse saath | Action DB mein likhta hai? |
| **E2E** | **Poora flow, asli user jaisa** | Donor post kare → NGO claim → volunteer deliver |

Humne E2E chuna, kyunki is project ka risk **ek function mein nahi** — risk **permissions aur state machine** mein hai. Woh sirf poora flow chala ke hi test hota hai.

## 10.2 Sabse important design decision — **anon key**

```js
const supabase = createClient(URL, ANON_KEY);   // service key NAHI
```

**Agar service role key use karte to test bekaar ho jaata** — woh RLS bypass karti hai, matlab test ko saari security dikhti hi nahi. Sab pass ho jaata, aur kuch prove nahi hota.

> **Test wahi path chalta hai jo browser chalta hai.** Isiliye jab test kehta hai "yeh blocked hai", woh **sach mein** blocked hai.

## 10.3 14 steps — aur har ek kya prove karta hai

| # | Step | Kya prove hota |
|---|---|---|
| 1 | Chaaron roles login | Auth + seeded users chal rahe |
| 2 | Role sub-rows exist | 0004 ka trigger fix kaam kar raha |
| 3 | Donor draft banata | Insert policy allow karti hai |
| 4 | `draft → delivered` try | **State machine illegal edge rokti hai** |
| 5 | Galat role publish kare | **Role guard kaam karta hai** |
| 6 | Poora happy path (6 hops) | **Asli lifecycle end-to-end chalta hai** |
| 7 | Audit trail padho | 6 events, sahi actor ke saath |
| 8 | `public_impact()` | Anonymous ko asli numbers dikhte (Bug B fixed) |
| 9 | Anon ko masked data | **Privacy masking live hai** |
| 10 | `status:'completed'` insert | **Hole 1 band** |
| 11 | `role:'admin'` update | **Hole 3 band** |
| 12 | Self-verify try | **Hole 4 band** |
| 13 | Signup with `role:'admin'` | **Hole 2 band** — request donor pe clamp hui |
| 14 | Expiry sweep | Cron logic + NULL actor |

**Final result:**
```
27 passed · 0 failed · 0 skipped
```

**Asli outputs:**
```
✓ Illegal transition: draft -> delivered   (status unchanged)
✓ Only the donor can publish this donation
✓ 6 events: draft→available(donor) available→claimed(ngo)
            claimed→pickup_scheduled(volunteer) pickup_scheduled→picked_up(volunteer)
            picked_up→delivered(volunteer) delivered→completed(ngo)
✓ {"donations_completed":1,"meals_served":38,"active_volunteers":1,
   "partner_ngos":1,"missed_expired":1}
✓ new row violates row-level security policy for table "donations"
✓ Only an admin can change a user role
✓ Only an admin can change NGO verification
✓ Signup with role:'admin' → profile mein role = 'donor' (clamp hua)
✓ Expiry sweep: 1 donation expired, audit row with actor_id = null
```

## 10.4 Step 13 pehle skip hota tha — aur woh kahani poori likhi hai

Bahut samay tak output aisa aata tha:

```
⏭  SKIPPED: email rate limit exceeded
```

**Wajah:** Supabase free tier ~2 emails/hour deta hai. Step 13 ko ek naya user signup karna padta hai. Dashboard mein **"Confirm email" ON** tha, to har signup email bhejne ki koshish karta → rate limit → test chal hi nahi paata.

**Us waqt humne do cheezein ki:**

1. Report mein `26/26 pass` **nahi likha**. Likha `26 passed · 1 skipped`.
2. Fix ka alag rasta bhi document kiya — function ka source seedha padh lo:

```sql
select prosrc from pg_proc where proname = 'handle_new_user';
-- allowlist CASE dikh jaayega
```

**Phir asli fix hua.** Dashboard mein Authentication → Sign In / Providers → **User Signups** → "Confirm email" **OFF**. (Setting ka internal naam `mailer_autoconfirm` hai, aur uska naam ulta hai — `true` ka matlab "confirmation chahiye hi nahi".)

Ab step 13 sach mein chalta hai:

```
✓ admin request clamped to donor
```

> **Lesson jo yahan chhupa hai:** `26/26 pass` likh dena aasaan tha — ek line badalni thi. Lekin **skipped test ko pass bolna** engineering ki sabse buri aadat hai, kyunki tab aap khud ko hi dhokha dete ho: Hole 2 ka fix sirf *maana* ja raha tha, *prove* nahi hua tha.
>
> Imaandari se "skipped" likhne ka inaam yeh mila ki woh gap list mein zinda raha, aur ek din band ho gaya. Agar chhupa diya hota, to aaj bhi khula hota — aur viva mein examiner ke poochne par pata chalta.

**Viva mein yeh poocha jaayega:** *"Kya koi cheez verify nahi hui?"* — ab jawab hai **"ab sab verified hai, aur pehle jo nahi tha woh bhi likha hua hai."** Woh `100% pass` se zyada strong jawab hai.

## 10.5 Test mein ek sundar detail — clean-up

Step 11 aur 12 mein, agar attack **galti se succeed** ho jaata, to test usko **wapas revert** karta hai:

```js
// agar role actually badal gaya, wapas theek karo
// taaki demo data poison na ho
```

> **Test ko apna kachra khud saaf karna chahiye.** Warna ek fail hua test baaki sab ko fail kar deta hai (flaky tests).

## 10.6 Seed file — ek chhoti engineering story

`supabase/seed/demo_seed.sql` seedha `auth.users` mein 4 users daalti hai, taaki email ki zaroorat hi na pade.

```sql
insert into auth.users (id, email, encrypted_password, email_confirmed_at,
                        confirmation_token, recovery_token, email_change, email_change_token_new, ...)
values ('1111...', 'demo.donor@food4all.dev',
        extensions.crypt('Food4All!demo123', extensions.gen_salt('bf')),
        now(),              -- ← pehle se confirmed
        '', '', '', '',     -- ← khaali string, NULL nahi!
        ...);
```

**Woh `''` wali line sabse interesting hai.** Supabase ka auth server (GoTrue) **Go** mein likha hai. Go in columns ko `string` mein padhta hai, aur Go ka `string` **`NULL` nahi ho sakta**. Agar yahan `NULL` chhod do, to login karte waqt GoTrue crash ho jaata hai — aur error message bilkul unrelated aata hai.

> **Yeh woh cheez hai jo kisi documentation mein nahi milti** — sirf debug karke pata chalti hai. Isi liye isko comment mein likh ke rakha hai.

Aur `auth.identities` ka insert `where not exists` se guard kiya (constraint ka naam use nahi kiya) — **kyunki constraint naam Supabase version ke saath badal sakta hai.**

---

# PART 11 — Cost Sheet: sab kuch ₹0 mein

| Cheez | Service | Free limit | Bill |
|---|---|---|---|
| Hosting | Vercel Hobby | 100GB bandwidth | **₹0** |
| Database | Supabase Free | 500MB, 2 projects | **₹0** |
| Auth | Supabase | 50,000 MAU | **₹0** |
| Storage | Supabase | 1GB | **₹0** |
| Maps | Leaflet + OSM | unlimited* | **₹0** |
| Geocoding | Nominatim | 1 req/sec | **₹0** |
| Cron | pg_cron | unlimited | **₹0** |
| QR codes | External API | unlimited | **₹0** |
| SSL | Vercel | auto | **₹0** |
| | | **TOTAL** | **₹0/month** |

**Scale pe kya todega (honest numbers):**

| Users | Kya todega | Fix |
|---|---|---|
| ~100 | Kuch nahi | — |
| ~1,000 | Supabase 500MB | Pro $25/mo |
| ~5,000 | Nominatim rate limit | Apna Nominatim host karo |
| ~10,000 | Geo query slow | **PostGIS + GiST index** |
| ~50,000 | Notifications zaroori | WhatsApp API |

> **Lekin asli baat:** ek final year project ko 50,000 users nahi chahiye. Usko chahiye — **ek campus pe sach mein kaam karna**. Uske liye yeh stack bilkul kaafi hai, aur poore saal ₹0 lagega.

---

# PART 12 — Abhi bhi kya missing hai (imaandari se)

> **Yeh section jaanbujh ke likha hai.** Viva mein examiner gaps dhoondhega. Agar aapne pehle hi list bana rakhi hai, to aap defensive nahi, **aware** dikhte ho.

## 12.1 Jo gaps band ho gaye ✅

Yeh list isliye rakhi hai ki progress dikhe — aur isliye bhi ki jo likha tha woh sach mein hua, bhula nahi diya gaya.

| Purana gap | Kya kiya | Proof |
|---|---|---|
| **Map picker nahi tha** — form mein lat/lng manually type karna padta | `MapPicker.tsx` (Leaflet + OSM, search + "use my location" + drag pin) aur `LocationMap.tsx` (detail page). Geocoding ke liye apna `/api/geocode` proxy | Landing page ka "no paid map APIs" claim ab sach mein demo hota hai |
| **Confirm email ON tha** — test step 13 skip | Dashboard mein OFF (`mailer_autoconfirm: true`) | `27 passed · 0 skipped` |
| **Git mein zero commits** | Commit + push → `github.com/SparrowO7/FOOD4ALL` (public) | Commit `0e5d32e`, 60 files |

> Map banate waqt ek **chhupa hua bug** bhi mila: `Number(null) === 0` aur `Number('') === 0`, aur `isFinite(0)` bhi `true` hai. Matlab **missing coordinate `0,0` ban ke save ho jaata tha** — jo Atlantic Ocean mein ek asli jagah hai, Ghana ke neeche. HTML ka `required` ise chhupa raha tha. Fix: `parseCoord()` absence ko explicitly reject karta hai. Yeh ab Hole 7 hai.

## 12.2 Jo abhi bhi khule hain

| # | Gap | Impact | Effort |
|---|---|---|---|
| 1 | **Map browser mein visually verify nahi hua** — build, types, API sab pass, par tiles sach mein paint ho rahe hain yeh kisi ne aankh se dekha nahi | 🔴 Zyada — demo se pehle 2 minute ka kaam, par abhi "assumed working" hai | 2 minute |
| 2 | **Photo upload nahi** — sirf URL field, Supabase Storage bucket banana baaki | 🟡 Medium — proof photo safety ke liye matter karta hai | 1 din |
| 3 | **Notifications nahi** — NGO ko khud app kholna padta hai | 🟡 Medium — asli deployment mein yeh sabse bada operational gap | Phase 3 |
| 4 | **5 Phase-2 open decisions settle nahi** | 🟡 Medium | Discussion |
| 5 | **Geocode rate-limit state per-instance memory mein** — N serverless instances = N req/sec, Nominatim policy 1/sec kehti hai | 🟡 Medium — chhote scale pe theek, badhne pe Upstash ya paid geocoder | Half din |
| 6 | **CI nahi, unit test nahi** — sirf ek e2e script, woh bhi manually chalani padti hai | 🟡 Medium — GitHub Actions pe 1 workflow file | 2 ghante |
| 7 | **`total_pickups` self-writable** | 🟢 Kam — cosmetic, impact numbers `donations`/`deliveries` se aate hain | 30 minute |
| 8 | **Geo index 2D nahi** — Haversine + B-tree, PostGIS/GiST nahi | 🟢 Kam — kuch hazaar rows tak theek | Phase 3 |
| 9 | **Realtime use nahi kiya** — Supabase free mein deta hai, lagaya nahi | 🟢 Kam — live status demo mein achha dikhta | 1 din |

**Priority order agar kal se kaam shuru karo:**
1. Map browser mein kholke dekho (2 min — ya to kaam kar raha hai, ya turant pata chal jaayega)
2. Photo upload (1 din — Storage bucket + RLS policy)
3. CI workflow (2 ghante — har push pe test apne aap chale)
4. Notifications (Phase 3 — asli deployment ka blocker)

---

# PART 13 — Viva / Interview Q&A

Yeh woh sawal hain jo is project pe sach mein poochhe jaayenge. Jawab chhote rakhe hain.

**Q1. Business logic frontend mein kyun nahi rakhi?**
Kyunki frontend badla ja sakta hai. User DevTools khol ke request bhej sakta hai. Jo rule DB mein nahi hai, woh rule nahi hai. Isiliye state machine, role checks aur freshness guards — sab Postgres ke andar hain.

**Q2. RLS kya hai aur yeh normal auth se kaise alag hai?**
Normal auth mein har API endpoint pe aap khud check likhte ho — ek bhoole to hole. RLS mein rule table se chipka hai; Postgres har query mein woh condition **khud** jod deta hai. Query kahin se bhi aaye, rule lagta hai.

**Q3. Agar `transition_donation()` RPC already check karta hai, to trigger kyun?**
RPC darwaza hai, trigger deewar. RPC tabhi chalta hai jab usko call karo. Trigger har `UPDATE` pe chalta hai — SQL editor se, migration se, kisi future code se. Defence in depth.

**Q4. Ek column ko protect karne ke liye RLS policy kyun nahi likhi?**
Kyunki policy likh hi nahi sakti. `USING` ko OLD row dikhta hai, `WITH CHECK` ko NEW — **kabhi dono nahi**. "Apni row edit karo par yeh column nahi" ek OLD-vs-NEW comparison hai, isliye BEFORE UPDATE trigger hi sahi tool hai.

**Q5. `SECURITY DEFINER` khatarnak nahi hai? Aapne 6 jagah use kiya hai.**
Haan khatarnak hai, isliye do niyam follow kiye: (a) function bahut chhota, (b) `set search_path = public` hamesha. Aur `public_impact()` mein woh safe hai kyunki woh **sirf aggregates** deta hai — koi row, naam ya address bahar nahi aa sakta.

**Q6. UUID primary key kyun?**
`/trace/<id>` link public share hota hai. Sequential ID hoti to koi bhi 1,2,3 ghuma ke sabke donations dekh leta — **IDOR vulnerability**. Saath hi sequential ID business volume leak karti hai.

**Q7. Alag `ngos` aur `volunteers` table kyun, `profiles` mein nullable columns kyun nahi?**
Taaki foreign key lag sake. `assigned_volunteer references volunteers(id)` — DB khud guarantee deta hai ki sirf volunteer assign ho sakta hai. Sab `profiles` mein hota to "koi bhi user" assign ho jaata, aur rokne ke liye code pe bharosa karna padta.

**Q8. Race condition kaise handle ki — do NGO ek saath claim karein to?**
`transition_donation()` mein `select ... for update` se row lock lagta hai. Dusra NGO wait karta hai, phir use updated status (`claimed`) dikhta hai aur transition illegal ho jaati hai. DB level pe solve, application level pe nahi.

**Q9. Apne system ki sabse badi weakness kya hai?**
Geo query. `(lat, lng)` pe composite B-tree hai, jo 2D search ke liye optimal nahi — B-tree left-to-right chalta hai. Lakhs rows pe yeh todega. Fix PostGIS ka GiST index hai, Phase 3 mein.

**Q10. Impact numbers fake kaise nahi ho sakte?**
Teen tarah se: (a) RLS policy donation ko sirf `draft` mein create karne deti hai, (b) `completed` tak pahunchne ke liye 6 transitions chahiye jisme NGO aur volunteer dono involved hain, (c) `deliveries.donation_id` pe `unique` hai, to ek donation 5 baar count nahi ho sakti. Aur `missed_expired` bhi public dikhate hain.

**Q11. Testing mein service role key kyun nahi use ki?**
Woh RLS bypass kar deti, to test ko security dikhti hi nahi — sab pass hota aur kuch prove na hota. Anon key = wahi raasta jo browser leta hai.

**Q12. Agar aaj dobara shuru karte to kya alag karte?**
Din 1 se PostGIS. Aur RLS policies likhte waqt hi "attacker ki tarah soch" wala pass karte — chaaron holes isliye mile kyunki test baad mein likha. **Test pehle likhta.**

---

# PART 14 — Research Paper

## 14.1 Research paper hota kya hai (2 line)

Research paper ek chhota formal document hota hai (6–12 page) jisme aap ek **specific sawal** uthate ho, batate ho ki **ab tak logon ne kya kiya** (literature review), phir apna **tareeka, result aur uska matlab** dikhate ho.
Normal project report **"maine kya banaya"** batati hai — paper **"maine kya naya seekha jo kisi aur ke kaam aaye"** batata hai.

## 14.2 Hum kis pe likh sakte hain (4-5 line)

**Sabse strong angle — jo already hamare paas hai:**

> **"Database-Enforced Trust in Volunteer Food-Rescue Platforms: A Zero-Cost Architecture for Low-Resource NGOs"**

Claim yeh hoga: **jab platform ke users hi uske stakeholders ho (donor, NGO, volunteer), tab business rules application layer ki jagah database layer mein rakhne se verifiable trust milta hai** — aur iske saath hum chaar asli privilege-escalation vulnerabilities dikha sakte hain jo application-layer design mein paida hoti hain aur RLS + trigger se poori tarah band hoti hain. Saath hi yeh bhi dikha sakte hain ki poora system ₹0/month pe chalta hai, jo Indian NGOs ke liye adoption ki sabse badi rukavat hai.

**Iske teen contribution hain jo paper-worthy hain:**
1. **4 documented vulnerabilities + fixes** — khaas kar "RLS policy column-level rules express nahi kar sakti (USING=OLD, WITH CHECK=NEW)" wala finding, jo practically har Supabase app pe lागू hota hai
2. **Zero-cost reference architecture** — reproducible, migrations ke saath
3. **FSSAI guideline → database schema mapping** — compliance ko enforceable constraint banana

**Kahan bhej sakte hain:** IEEE student conferences, ICT4D (ICT for Development) workshops, ya Springer ke "Smart Cities / Sustainable Computing" tracks — SDG 2 (Zero Hunger) aur SDG 12.3 (food waste halve by 2030) se seedha connect hota hai.

---

## Appendix — Files ki list

```
Food4all/
├── supabase/
│   ├── migrations/
│   │   ├── 0001_schema.sql          enums, 6 tables, indexes, signup trigger
│   │   ├── 0002_rls.sql             RLS policies + masked view
│   │   ├── 0003_state_machine.sql   transitions + RPC + safety trigger
│   │   ├── 0004_fixes.sql           role sub-rows + public_impact()
│   │   ├── 0005_expiry.sql          auto-expiry + pg_cron
│   │   ├── 0006_insert_guard.sql    Hole 1 fix
│   │   └── 0007_privilege_guards.sql Holes 2,3,4 fix
│   ├── seed/demo_seed.sql           4 pre-confirmed demo users + 2 donations
│   └── README.md                    apply order + manual steps
├── scripts/e2e-test.mjs             14 steps, 27 assertions
├── src/
│   ├── app/
│   │   ├── (11 page routes)
│   │   └── api/geocode/route.ts     Nominatim proxy (throttle + cache)
│   ├── components/   (15 components — MapPicker, LocationMap naye)
│   ├── lib/          actions.ts, haversine.ts, supabase/{client,server}.ts
│   └── types/database.ts
├── middleware.ts                    session refresh
├── README.md                        public-facing (GitHub landing page)
├── HANDOFF.md                       naye AI model ko dene ke liye context dump
├── Food4All_Phase1_Research.pdf
├── Food4All_Phase2_Architecture.md
└── Food4All_Build_Notes.md          ← yeh file
```

**Demo logins** (password: `Food4All!demo123`)

| Role | Email |
|---|---|
| Donor | `demo.donor@food4all.dev` |
| NGO | `demo.ngo@food4all.dev` |
| Volunteer | `demo.volunteer@food4all.dev` |
| Admin | `demo.admin@food4all.dev` |

---

### Aakhri baat

Is project ka ek hi central idea hai, aur agar aapko sirf ek cheez yaad rahe to yeh rahe:

> **Trust ko code mein likh ke "bharosa karo" nahi bola jaata — use enforce kiya jaata hai, us layer pe jahan se koi bypass na kar sake.**

Baaki sab — Next.js, Tailwind, Leaflet, Haversine — tools hain. **Asli project Postgres ke andar hai.**

