# Ugo's Pizza · website + HermosIA

Marketing and ordering site for **Ugo's Pizza** (Santa Cruz de la Sierra, Bolivia — "sólo para hermosos"), with **HermosIA**, a tool-using AI ordering assistant (text + voice) that fills the same cart as the page and sends orders to the right WhatsApp.

Static site, no build step, plus **one** Vercel serverless function. Node ≥ 20.

## Run it

```bash
npm install
npm test          # golden tests for the assistant's tools
npx vercel dev    # site + /api/hermosia on http://localhost:3000
```

## Turn on HermosIA

The key never goes in the code. In **Vercel → Project → Settings → Environment Variables** add one of these, then **redeploy**:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude key (Anthropic) |
| `HERMOSIA_MODEL` / `HERMOSIA_VOICE_MODEL` | optional Claude model overrides (defaults `claude-sonnet-5-5` / `claude-haiku-5-5`) |
| `NVIDIA_API_KEY` | NVIDIA NIM key |
| `HERMOSIA_NVIDIA_MODEL` | optional NIM model (must support tool calling; default `nvidia/nemotron-3-ultra-550b-a55b`) |
| `HERMOSIA_PROVIDER` | optional, forces `anthropic` or `nvidia` |

With no key, the chat says "HermosIA se está preparando 🛠️" and links to the menu and the WhatsApp funnel. API clients get `503 not_configured`; the site's own chat receives the same condition as an NDJSON event so the browser console stays clean.

## Files

```
index.html          page structure + SEO (Open Graph, schema.org Restaurant)
css/styles.css      design system (brand tokens at the top, with where each colour was sampled)
js/data.js          ALL content + catalog() — shared by the site AND the assistant's tools
js/app.js           rendering, carousel, cart, WhatsApp funnel, live open/closed status, chat + voice
api/hermosia.js     assistant endpoint: tool-calling agent loop, streams NDJSON events
api/_tools.js       deterministic tools (menu, cart, deals, order, handoff) + JSON schemas
api/_prompt.js      system prompt + live context (time, open branches, promo, customer state)
api/_persona.js     HermosIA's original lines + easter eggs
tests/tools.test.js golden tests (node:test, fixed clock)
js/ar.js            AR / 3D menu: tap a pizza photo → 3D viewer → "Ver en tu mesa" (real size, phone camera)
assets/ar/*.glb|usdz  one real-size 3D model per pizza (GLB for Android/viewer, USDZ for iPhone)
tools/build-ar-models.py   regenerates assets/ar/ (python3, pillow, numpy, usd-core)
tools/ar-src/       full-size menu photos from ugospizzas.com/menu (model source)
assets/img|video|hero|brand   the shop's own photos and reels, processed (webp / H.264)
```

**Edit content only in `js/data.js`.** Every fact has its source (website page or Instagram post) in a comment next to it. The website and HermosIA read the same `catalog()`, so they can never disagree on a price.

## How HermosIA works

- The model only *proposes* tool calls. `api/_tools.js` computes every price, total, deal, opening hour and order.
- Cart, order details, Mi Pedido (last 3 orders on this device) travel as `state` with each request and are re-validated by `sanitizeState()` on the server.
- **Confirmation is enforced by the server:** `prepare_order` shows a read-back with "Sí, confirmar / Cambiar algo" and a token. Only when the *next* message is a clear yes does the server place the order (before the model speaks). A repeated yes returns the same order; any change after the read-back invalidates the token.
- Combo hints carry `total_si_acepta` (the whole cart total after the swap) and only ever suggest adding the drink — never another pizza.
- Links (WhatsApp order, status, handoff) travel as events and render as buttons; the chat only accepts `https://wa.me/` URLs.
- Delivery orders go to **La Scoobyneta** (76066200); pick-up and table orders go to the chosen branch's WhatsApp.
- Voice: Web Speech API (`es-BO`), push-to-talk, hands-free, barge-in, wake lock. Hidden where the browser has no speech recognition; text always works.

### NDJSON events

`text` · `cart` · `options` · `readback` · `location` · `order` · `handoff` · `state` · `error`

## AR menu ("Ver en tu mesa")

Tap any pizza photo in the menu (it has a **3D** badge) to open it in 3D. On a phone, **📱 Ver en tu mesa** opens the camera and puts the pizza on the table at real size, with no app: Android uses Scene Viewer/WebXR and iPhone uses Quick Look. On a computer the viewer shows a QR code that opens the same pizza on the phone.

- Deep link per pizza: `https://ugospizzas.com/?ver=<id>` (e.g. `?ver=cheeseburguer`; `#ver-<id>` also works). Print it as a QR sticker for the tables.
- Models are built from the full-size menu photos in `tools/ar-src/`: crust rim with a rounded lip, cheese sunk inside, toppings raised, plus a normal map. After changing a photo or the size, run `pip install pillow numpy usd-core` then `python3 tools/build-ar-models.py` (or pass ids: `… ugos mexicana`). Each USDZ is checked with USD's validators.
- `vercel.json` serves `.usdz` as `model/vnd.usdz+zip` (without it, iPhone downloads the file instead of opening AR).
- WhatsApp/Instagram/Facebook/TikTok in-app browsers can't open AR. The button stays visible there and explains how to open the page in Chrome or Safari.
- Size: the diameter is **assumed to be 36 cm** (`UGOS.ar.diameterCm` in `js/data.js`), because no size is published. Confirm it with the owner.
- The viewer library ([model-viewer](https://modelviewer.dev), from jsDelivr) loads only when someone opens a pizza.
- These are photo-based models, not photogrammetry scans. The shape is reconstructed from one photo, so the underside and the far side of tall toppings are inferred. For scan-quality models, replace `assets/ar/<id>.glb` with a scanned `.glb` of the same name.

## Updating promos

| Promo | Ends | Where |
|---|---|---|
| Jamoneitor a Bs 35 por La Scoobyneta (primeras 100 del día) | **30 Nov 2026** | `UGOS.yapa` in `js/data.js` |
| 9 combos pizza + gaseosa (from ugospizzas.com "Nuestras promos") | no date published | `UGOS.combos` |

After `yapa.until` the promo disappears on its own (catalog, banner, ticker, assistant); banner 2 falls back to the house pizza "Ugo's".

## Not built yet (needs a backend)

Accounts and cross-device Mi Perfil, POS/KDS order placement, WhatsApp Business bot, payments in chat, live order tracking and driver map, rewards, phone voice agent, push notifications, custom TTS voice, half-and-half pizzas. See the final report for the recommended next step.
