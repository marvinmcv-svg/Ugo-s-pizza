/* HermosIA's deterministic tools.
 * The model proposes tool calls; this file validates and executes them.
 * Every price, total, deal, opening hour and order comes from js/data.js + catalog().
 */
"use strict";
const crypto = require("crypto");
const U = require("../js/data.js");

const MAX_QTY = 50;
const MAX_LINES = 30;
const STAGES = ["browsing", "awaiting_confirmation", "placed"];
const SERVICES = ["delivery", "pickup", "mesa"];
const ALLERGEN_NOTE = "No tenemos información de alérgenos publicada: consultá directamente a la sucursal antes de pedir.";

/* ---------------- text helpers ---------------- */
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]+/g, " ").trim();
const words = (s) => norm(s).split(" ").filter(Boolean);
const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Single-word synonyms: replaced by the menu word(s).
const SYN = {
  ham: "jamon", jamón: "jamon", bacon: "tocino", panceta: "tocino", sausage: "salchicha", salchichas: "salchicha",
  corn: "choclo", maiz: "choclo", pineapple: "pina", piña: "pina", pina: "pina", mushroom: "champinones", mushrooms: "champinones",
  hongos: "champinones", champis: "champinones", chicken: "pollo", beef: "carne", meat: "carne", cheese: "queso", quesos: "queso",
  tomato: "tomate", basil: "albahaca", hawaiian: "hawaiana", mexican: "mexicana", cheeseburger: "cheeseburguer", hamburguesa: "cheeseburguer",
  burger: "cheeseburguer", estrogonof: "strogonoff", strogonof: "strogonoff", stroganoff: "strogonoff", estrogonoff: "strogonoff",
  broccoli: "brocoli", picante: "jalapenos", jalapeno: "jalapenos", spicy: "jalapenos", salami: "salame", catupiri: "catupiry",
  requeson: "catupiry", jamonetor: "jamoneitor", jamoneitora: "jamoneitor", salchichonas: "salchichona", margherita: "margarita",
  napolitano: "napolitana", vegetariana: "#veg", vegetariano: "#veg", veggie: "#veg", vegetarian: "#veg",
  gaseosa: "#drink", gaseosas: "#drink", soda: "#drink", sodas: "#drink", refresco: "#drink", refrescos: "#drink", bebida: "#drink",
  bebidas: "#drink", coca: "#drink", cola: "#drink", pepsi: "pepsi", guarana: "guarana", drink: "#drink", drinks: "#drink",
  combo: "#combo", combos: "#combo", promo: "#promo", promos: "#promo", oferta: "#promo", ofertas: "#promo", scoobyneta: "#promo",
  chica: "#small", pequena: "#small", personal: "#small", jr: "#small", small: "#small", mediana: "#small",
  vendida: "#star", popular: "#star", favorita: "#star", casa: "#house",
};
// Multi-word synonyms (consume their words).
const SYN2 = [
  [["sin", "carne"], "#veg"], [["meat", "free"], "#veg"], [["no", "meat"], "#veg"], [["sin", "jamon"], "#veg"],
  [["four", "cheese"], "4 quesos"], [["cuatro", "quesos"], "4 quesos"], [["4", "cheese"], "4 quesos"],
  [["mas", "vendida"], "#star"], [["mas", "pedida"], "#star"], [["best", "seller"], "#star"], [["de", "la", "casa"], "#house"],
  [["2", "litros"], "2 l"], [["dos", "litros"], "2 l"], [["1", "litro"], "1 l"], [["un", "litro"], "1 l"], [["2", "lt"], "2 l"], [["1", "lt"], "1 l"],
];
const STOP = new Set(["quiero", "quisiera", "una", "un", "unas", "unos", "pizza", "pizzas", "de", "del", "la", "el", "las", "los", "con", "y", "algo", "tienen",
  "hay", "que", "me", "dame", "por", "favor", "the", "a", "an", "with", "want", "i", "some", "any", "do", "you", "have", "tenes", "tienes",
  "mandame", "traeme", "porfa", "pls", "please", "para", "mi", "en", "o", "q"]);

function parseQuery(q) {
  let ws = words(q);
  const flags = new Set(); const terms = []; const excl = [];
  for (let i = 0; i < ws.length; i++) {
    let matched = false;
    for (const [seq, rep] of SYN2) {
      if (seq.every((w, k) => ws[i + k] === w)) {
        if (rep.startsWith("#")) flags.add(rep); else terms.push(...rep.split(" "));
        i += seq.length - 1; matched = true; break;
      }
    }
    if (matched) continue;
    const w = ws[i];
    if (w === "sin" && ws[i + 1]) { const x = SYN[ws[i + 1]] || ws[i + 1]; if (!x.startsWith("#")) excl.push(x); i++; continue; }
    if (STOP.has(w)) continue;
    const rep = SYN[w];
    if (rep) { if (rep.startsWith("#")) flags.add(rep); else terms.push(...rep.split(" ")); }
    else terms.push(w);
  }
  return { terms, flags, excl };
}

const KIND_RANK = { pizza: 0, promo: 1, combo: 2 };

function itemWords(it) { return { name: words(it.name), desc: words(it.desc || "") }; }
const prefixHit = (list, t) => list.some((w) => w === t || (t.length >= 3 && w.startsWith(t)));

/* ---------------- context ---------------- */
function cat(ctx) { return U.catalog(ctx.now); }
function lineList(cart, C) {
  return Object.entries(cart).filter(([id]) => C[id]).map(([id, qty]) => ({ id, name: C[id].name, qty, unit: C[id].price, subtotal: C[id].price * qty }));
}
function cartTotal(cart, C) { return lineList(cart, C).reduce((s, l) => s + l.subtotal, 0); }
function cartSummary(ctx) {
  const C = cat(ctx); const lines = lineList(ctx.state.cart, C);
  return { lines: lines.map((l) => ({ id: l.id, nombre: l.name, cantidad: l.qty, precio_unitario: l.unit, subtotal: l.subtotal })), total: cartTotal(ctx.state.cart, C), moneda: U.config.currency, vacio: lines.length === 0 };
}
function emitCart(ctx) { ctx.events.push({ type: "cart", cart: { ...ctx.state.cart } }); }
function touch(ctx) { if (ctx.state.stage !== "placed" || true) { if (ctx.state.stage === "awaiting_confirmation") ctx.state.stage = "browsing"; ctx.state.token = null; } }
function saveUndo(ctx) { ctx.state.prevCart = { ...ctx.state.cart }; }

function branchById(id) { return U.branches.find((b) => b.id === id) || null; }
function findBranch(q) {
  if (!q) return null;
  const n = norm(q);
  const b = U.branches.find((x) => x.id === q || norm(x.name) === n);
  if (b) return b;
  if (n.length >= 2) { const inc = U.branches.filter((x) => norm(x.name).includes(n) || norm(x.address).includes(n)); if (inc.length === 1) return inc[0]; }
  const hits = U.branches.filter((x) => { const nw = words(x.name + " " + x.id.replace(/-/g, " ")); return words(q).some((t) => t.length >= 3 && nw.some((w) => w.startsWith(t) || t.startsWith(w) && w.length >= 4)); });
  return hits.length === 1 ? hits[0] : null;
}
const deliveryBranch = () => U.branches.find((b) => b.whatsapp === U.delivery.whatsapp) || null;
function destination(state) {
  // Delivery goes to La Scoobyneta; pick-up / mesa to the chosen branch.
  if (state.order.service === "delivery") return { name: U.delivery.name, whatsapp: U.delivery.whatsapp, branch: deliveryBranch() };
  const b = branchById(state.order.branch);
  return b ? { name: "Sucursal " + b.name, whatsapp: b.whatsapp, branch: b } : null;
}

/* ---------------- search ---------------- */
function search(query, ctx, limit = 6) {
  const C = cat(ctx);
  const { terms, flags, excl } = parseQuery(query);
  const items = Object.values(C);
  let res = [];
  for (const it of items) {
    const w = itemWords(it);
    if (excl.some((x) => prefixHit(w.name, x) || prefixHit(w.desc, x))) continue;
    if (flags.has("#veg") && !it.veg) continue;
    let score = 0;
    for (const t of terms) {
      if (prefixHit(w.name, t)) score += 3;
      else if (prefixHit(w.desc, t)) score += 1;
    }
    if (flags.has("#drink") && it.kind === "combo") score += 2;
    if (flags.has("#combo") && it.kind === "combo") score += 2;
    if (flags.has("#promo") && (it.kind === "promo" || it.kind === "combo")) score += it.kind === "promo" ? 3 : 1;
    if (flags.has("#star") && it.star) score += 3;
    if (flags.has("#house") && it.house) score += 3;
    if (flags.has("#veg") && terms.length === 0) score += 1;
    if (terms.length && terms.every((t) => !prefixHit(w.name, t) && !prefixHit(w.desc, t)) && !flags.size) continue;
    if (score > 0) res.push({ it, score });
  }
  res.sort((a, b) => b.score - a.score || KIND_RANK[a.it.kind] - KIND_RANK[b.it.kind] || a.it.price - b.it.price);
  return { results: res.slice(0, limit).map((r) => r.it), all: res, flags, terms };
}
const brief = (it) => ({ id: it.id, nombre: it.name, precio: it.price, tipo: it.kind, sin_carne: it.veg || undefined, ingredientes: it.kind === "pizza" ? it.desc : undefined, incluye: it.kind === "combo" ? it.desc : undefined, condiciones: it.kind === "promo" ? it.desc : undefined, precio_normal: it.regular });

/* ---------------- resolution ---------------- */
function resolveItem(text, ctx) {
  const C = cat(ctx);
  if (C[text]) return { item: C[text] };
  const n = norm(text);
  const byName = Object.values(C).find((it) => norm(it.name) === n || norm(it.name.replace(/^Combo /, "")) === n);
  if (byName) return { item: byName };
  const { terms, flags } = parseQuery(text);
  // drink mentioned → only combos can carry drinks
  const hasDrink = flags.has("#drink") || terms.includes("pepsi") || terms.includes("guarana");
  if (hasDrink) {
    const pizzaTerms = terms.filter((t) => !["pepsi", "guarana", "2", "1", "l"].includes(t));
    const size = terms.includes("2") ? "2 l" : terms.includes("1") ? "1 l" : null;
    let combos = Object.values(C).filter((it) => it.kind === "combo");
    if (pizzaTerms.length) combos = combos.filter((c) => pizzaTerms.every((t) => prefixHit(words(c.name), t)));
    if (size) combos = combos.filter((c) => norm(c.drink).includes(size));
    if (terms.includes("pepsi")) combos = combos.filter((c) => /pepsi/i.test(c.drink));
    if (terms.includes("guarana")) combos = combos.filter((c) => /guaran/i.test(c.drink));
    // prefer the single-pizza combo when one pizza is named
    if (combos.length > 1 && pizzaTerms.length) { const singles = combos.filter((c) => c.parts.length === 1); if (singles.length === 1) combos = singles; }
    if (combos.length === 1) return { item: combos[0], viaDrink: true };
    if (!pizzaTerms.length) return { drinkOnly: true, options: combos.slice(0, 4) };
    return { ambiguous: combos.slice(0, 4), drinkOnly: !combos.length };
  }
  const { all } = search(text, ctx, 10);
  if (!all.length) return { notFound: true };
  if (all.length === 1 || all[0].score > all[1].score) return { item: all[0].it };
  // tie: prefer plain pizza over promo/combo if exactly one pizza at the top score
  const top = all.filter((r) => r.score === all[0].score);
  const pizzas = top.filter((r) => r.it.kind === "pizza");
  if (pizzas.length === 1) return { item: pizzas[0].it };
  return { ambiguous: top.slice(0, 4).map((r) => r.it) };
}

/* ---------------- deals ---------------- */
function multisetFits(cart, parts) {
  const need = {}; for (const p of parts) need[p] = (need[p] || 0) + 1;
  return Object.entries(need).every(([id, q]) => (cart[id] || 0) >= q);
}
function comboHints(ctx) {
  const C = cat(ctx); const cart = ctx.state.cart; const total = cartTotal(cart, C);
  const hints = [];
  for (const c of U.combos) {
    if (!multisetFits(cart, c.parts)) continue;
    const sep = c.parts.reduce((s, p) => s + C[p].price, 0);
    const extra = c.price - sep;
    // Drinks are only sold inside combos, so every match here is "almost a combo":
    // the pizza part is in the cart and only the drink is missing.
    hints.push({ tipo: "casi_combo", combo_id: c.id, combo: "Combo " + c.name, precio_combo: c.price, pizzas_en_tu_carrito: sep,
      te_falta: c.drink, pagas_de_mas: extra, total_si_acepta: total - sep + c.price,
      frase: `Por ${U.money(extra)} más te llevás también la ${c.drink} (combo ${c.name} a ${U.money(c.price)}).` });
  }
  hints.sort((a, b) => (a.pagas_de_mas / 1) - (b.pagas_de_mas / 1) || b.precio_combo - a.precio_combo);
  return hints.slice(0, 2);
}
function yapaHint(ctx) {
  const C = cat(ctx); const y = U.yapa; if (!y || !C[y.id]) return null;
  const q = ctx.state.cart[y.ref] || 0; if (!q) return null;
  const total = cartTotal(ctx.state.cart, C);
  return { tipo: "promo_del_mes", combo_id: y.id, aplica_a: C[y.ref].name, cantidad: q, ahorro: (y.regular - y.price) * q,
    total_si_acepta: total - C[y.ref].price * q + y.price * q, condiciones: y.conditions };
}

/* ---------------- order helpers ---------------- */
function currentToken(state) {
  const cart = Object.keys(state.cart).sort().map((k) => [k, state.cart[k]]);
  const o = state.order; const pick = ["service", "branch", "address", "reference", "when", "name", "payment", "notes"].map((k) => o[k] || "");
  const loc = o.location ? [o.location.lat.toFixed(5), o.location.lng.toFixed(5)] : [];
  return "T" + sha(JSON.stringify([cart, pick, loc])).slice(0, 16);
}
function orderIdFor(token) {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const h = sha("order:" + token);
  let s = ""; for (let i = 0; i < 5; i++) s += A[parseInt(h.slice(i * 2, i * 2 + 2), 16) % A.length];
  return "UG-" + s;
}
function parseWhen(when, ctx, b) {
  if (!when) return { ok: true, value: null };
  const w = norm(when);
  if (["asap", "ya", "ahora", "lo antes posible", "cuanto antes", "now"].includes(w)) return { ok: true, value: "asap" };
  const m = String(when).trim().match(/^(\d{1,2})(?::|h|\.)?(\d{2})?\s*(am|pm)?$/i);
  if (!m) return { ok: false, error: "Hora inválida: usá 'asap' o HH:MM (24 h)." };
  let h = +m[1]; const mi = m[2] ? +m[2] : 0; const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
  if (h > 23 || mi > 59) return { ok: false, error: "Hora inválida." };
  const hhmm = String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0");
  return { ok: true, value: hhmm };
}
function checkTime(hhmm, ctx, b) {
  // returns null if ok, otherwise an error string
  const L = U.localParts(ctx.now);
  const t = U.toMin(hhmm);
  let abs = t;
  if (t < L.min && t < 6 * 60) abs = t + 1440; // "a la 00:30" tonight
  if (abs < L.min - 5) return `Las ${hhmm} ya pasaron (son las ${L.hhmm}).`;
  if (!b) return null;
  const today = U.hoursFor(b, L.dow), yest = U.hoursFor(b, (L.dow + 6) % 7);
  let open = false;
  if (yest && abs < 1440) { const o = U.toMin(yest[0]), c = U.toMin(yest[1]); if (c <= o && abs < c) open = true; }
  if (today) { const o = U.toMin(today[0]), c = U.toMin(today[1]); const end = c <= o ? 1440 + c : c; if (abs >= o && abs < end) open = true; }
  return open ? null : `A las ${hhmm} ${b.name} está cerrada. Hoy atiende de ${(today || ["—", "—"])[0]} a ${(today || ["—", "—"])[1]}.`;
}
function missingDetails(state) {
  const o = state.order; const miss = [];
  if (!Object.keys(state.cart).length) miss.push("productos");
  if (!o.service) miss.push("tipo de entrega (delivery, recojo o comer en sucursal)");
  if (o.service && o.service !== "delivery" && !o.branch) miss.push("sucursal");
  if (o.service === "delivery" && !o.address && !o.location) miss.push("dirección o ubicación (pin)");
  if (!o.when) miss.push("hora (lo antes posible u HH:MM)");
  if (!o.name) miss.push("nombre");
  return miss;
}
function hasPromo(state) { return !!(U.yapa && state.cart[U.yapa.id]); }

function readback(ctx) {
  const C = cat(ctx); const s = ctx.state; const d = destination(s);
  const lines = lineList(s.cart, C);
  return {
    lines: lines.map((l) => ({ name: l.name, qty: l.qty, subtotal: l.subtotal })),
    total: cartTotal(s.cart, C), currency: U.config.currency,
    service: s.order.service, place: d ? d.name : null,
    address: s.order.address || null, reference: s.order.reference || null, pin: !!s.order.location,
    when: s.order.when === "asap" ? "Lo antes posible" : s.order.when, name: s.order.name,
    payment: s.order.payment || null, notes: s.order.notes || null,
  };
}

/* ---------------- tool implementations ---------------- */
const impl = {
  search_menu({ query }, ctx) {
    const r = search(query || "", ctx);
    if (!r.results.length) {
      ctx.log({ evt: "hermosia_miss", text: clip(query, 120), reason: "search_empty" });
      return { resultados: [], nota: "No encontré eso en el menú. Ofrecé alternativas reales con search_menu o get_deals." };
    }
    const out = { resultados: r.results.map(brief) };
    if (r.flags.has("#drink")) out.nota = "Las gaseosas solo vienen dentro de los combos (no hay precio suelto publicado).";
    if (r.flags.has("#small")) out.nota_tamano = "Solo publicamos un precio por pizza; no hay tamaño chico/Jr. publicado.";
    if (r.flags.has("#veg")) out.nota_sin_carne = "Estas no llevan carne según los ingredientes publicados.";
    return out;
  },

  get_item_details({ item }, ctx) {
    const r = resolveItem(item || "", ctx);
    if (!r.item) return { error: "No encontré ese producto.", opciones: (r.ambiguous || []).map(brief) };
    const it = r.item; const C = cat(ctx);
    const out = { id: it.id, nombre: it.name, precio: it.price, tipo: it.kind, moneda: U.config.currency };
    if (it.kind === "pizza") {
      out.ingredientes = it.desc; out.base_de_todas = U.base; out.sin_carne = it.veg;
      out.combos = U.combos.filter((c) => c.parts.includes(it.id)).map((c) => ({ id: c.id, nombre: "Combo " + c.name, precio: c.price }));
      if (U.yapa && C[U.yapa.id] && U.yapa.ref === it.id) out.promo_del_mes = { id: U.yapa.id, precio: U.yapa.price, condiciones: U.yapa.conditions };
      if (it.star) out.dato = "Es la pizza más vendida de Ugo's.";
      if (it.house) out.dato = "Es la pizza de la casa.";
    } else if (it.kind === "combo") { out.incluye = it.desc; out.tamano = it.size; }
    else if (it.kind === "promo") { out.condiciones = it.desc; out.precio_normal = it.regular; out.valida_hasta = it.until; }
    out.alergenos = ALLERGEN_NOTE;
    out.tamano_publicado = it.kind === "pizza" ? "Un solo precio publicado (sin tamaños)." : out.tamano;
    return out;
  },

  get_whats_new(_, ctx) {
    const C = cat(ctx); const res = {};
    const y = U.yapa && C[U.yapa.id] ? { id: U.yapa.id, nombre: U.yapa.name, precio: U.yapa.price, precio_normal: U.yapa.regular, condiciones: U.yapa.conditions, hasta: U.yapa.until } : null;
    if (y) res.promo_del_mes = y;
    res.mas_vendida = brief(C.cheeseburguer);
    res.combos = U.combos.slice(0, 4).map((c) => ({ id: c.id, nombre: "Combo " + c.name, precio: c.price }));
    const tp = U.todayPromo(ctx.now); if (tp) res.promo_de_hoy = tp;
    res.proximamente = "Una nueva pizza 'combinación carnívora' (todavía no se puede pedir).";
    ctx.state.newsShown = true;
    return res;
  },

  get_branches({ name }, ctx) {
    const L = U.localParts(ctx.now);
    const list = name ? [findBranch(name)].filter(Boolean) : U.branches;
    if (name && !list.length) return { error: "No conozco esa sucursal.", sucursales: U.branches.map((b) => b.name) };
    const rows = list.map((b) => { const st = U.branchStatus(b, ctx.now); const h = U.hoursFor(b, L.dow);
      return { id: b.id, nombre: b.name, direccion: b.address, abierta: st.open, cierra_pronto: st.closingSoon, estado: st.open ? (st.closingSoon ? "Cierra pronto (" + st.closesAt + ")" : "Abierta hasta " + st.closesAt) : st.label, horario_hoy: h ? h[0] + "–" + h[1] : null, whatsapp: "+" + b.whatsapp }; });
    return { hora_local: L.hhmm, abiertas: rows.filter((r) => r.abierta).length, total: U.branches.length, horario_general: "Lunes a domingo 12:00–01:00; martes 17:00–01:00", delivery: U.delivery.name + " (WhatsApp 76066200)", sucursales: rows };
  },

  get_deals(_, ctx) {
    const C = cat(ctx); const out = { moneda: U.config.currency };
    const tp = U.todayPromo(ctx.now); out.promo_de_hoy = tp || null;
    if (U.yapa && C[U.yapa.id]) out.promo_del_mes = { id: U.yapa.id, nombre: U.yapa.name, precio: U.yapa.price, precio_normal: U.yapa.regular, condiciones: U.yapa.conditions, hasta: U.yapa.until };
    out.combos = U.combos.map((c) => ({ id: c.id, nombre: "Combo " + c.name, precio: c.price, incluye: c.note, pizzas_sueltas_valen: c.parts.reduce((s, p) => s + C[p].price, 0) }));
    out.nota_combos = "Las gaseosas no tienen precio suelto publicado: el combo es la única forma de llevarlas.";
    const hints = comboHints(ctx); const yh = yapaHint(ctx);
    out.para_tu_carrito = [...(yh ? [yh] : []), ...hints];
    out.instruccion = "Si ofrecés un cambio, citá total_si_acepta tal cual. No sumes vos.";
    return out;
  },

  cart_add({ items }, ctx) {
    if (!Array.isArray(items) || !items.length) return { error: "Faltan productos." };
    const C = cat(ctx); const added = []; const problems = [];
    let changed = false; saveUndo(ctx);
    for (const raw of items.slice(0, 10)) {
      const text = String(raw.item || "").trim(); if (!text) continue;
      let qty = Math.max(1, Math.min(MAX_QTY, parseInt(raw.qty, 10) || 1));
      const sizeTxt = norm(raw.size || "") + " " + norm(text);
      const r = resolveItem(text, ctx);
      if (r.drinkOnly && !r.item) { problems.push({ item: text, error: "Las gaseosas solo vienen en combo con una pizza.", opciones: (r.options || []).map(brief) }); continue; }
      if (!r.item) { if (r.notFound) ctx.log({ evt: "hermosia_miss", text: clip(text, 120), reason: "cart_add_not_found" }); problems.push({ item: text, error: r.notFound ? "No está en el menú." : "Hay varias opciones, preguntá cuál.", opciones: (r.ambiguous || []).map(brief) }); continue; }
      if (/\b(jr|chica|pequena|personal|small|mediana)\b/.test(sizeTxt)) { problems.push({ item: text, error: `La ${r.item.name} solo tiene un precio publicado (${U.money(r.item.price)}); no hay tamaño chico/Jr.`, opciones: [brief(r.item)] }); continue; }
      const id = r.item.id;
      if (!ctx.state.cart[id] && Object.keys(ctx.state.cart).length >= MAX_LINES) { problems.push({ item: text, error: "El carrito está lleno." }); continue; }
      ctx.state.cart[id] = Math.min(MAX_QTY, (ctx.state.cart[id] || 0) + qty);
      added.push({ id, nombre: C[id].name, cantidad: qty, precio_unitario: C[id].price, via_combo: r.viaDrink || undefined });
      changed = true;
      if (C[id].kind === "promo" && ctx.state.order.service !== "delivery") { ctx.state.order.service = "delivery"; ctx.state.order.branch = null; }
    }
    if (changed) { touch(ctx); emitCart(ctx); } else ctx.state.prevCart = ctx.state.prevCart;
    const out = { agregado: added, carrito: cartSummary(ctx) };
    if (problems.length) out.problemas = problems;
    if (hasPromo(ctx.state)) out.nota_promo = "La promo Jamoneitor a Bs 35 es solo por delivery La Scoobyneta: el pedido va como delivery.";
    return out;
  },

  cart_remove({ item }, ctx) {
    const id = resolveInCart(item, ctx); if (!id) return { error: "Eso no está en el carrito.", carrito: cartSummary(ctx) };
    saveUndo(ctx); delete ctx.state.cart[id]; touch(ctx); emitCart(ctx);
    return { quitado: id, carrito: cartSummary(ctx) };
  },
  cart_set_qty({ item, qty }, ctx) {
    const id = resolveInCart(item, ctx); if (!id) return { error: "Eso no está en el carrito.", carrito: cartSummary(ctx) };
    const q = parseInt(qty, 10); saveUndo(ctx);
    if (!q || q < 1) delete ctx.state.cart[id]; else ctx.state.cart[id] = Math.min(MAX_QTY, q);
    touch(ctx); emitCart(ctx); return { carrito: cartSummary(ctx) };
  },
  cart_clear(_, ctx) { saveUndo(ctx); ctx.state.cart = {}; touch(ctx); emitCart(ctx); return { carrito: cartSummary(ctx) }; },
  cart_view(_, ctx) { return { carrito: cartSummary(ctx), detalles: { ...ctx.state.order, location: ctx.state.order.location ? "pin compartido" : null }, faltan: missingDetails(ctx.state) }; },
  cart_undo(_, ctx) {
    if (!ctx.state.prevCart) return { error: "No hay nada para deshacer.", carrito: cartSummary(ctx) };
    const cur = ctx.state.cart; ctx.state.cart = ctx.state.prevCart; ctx.state.prevCart = null; void cur;
    touch(ctx); emitCart(ctx); return { deshecho: true, carrito: cartSummary(ctx) };
  },

  cart_swap_to_combo({ combo_id }, ctx) {
    const C = cat(ctx);
    if (U.yapa && combo_id === U.yapa.id) {
      if (!C[U.yapa.id]) return { error: "La promo del mes no está vigente." };
      const q = ctx.state.cart[U.yapa.ref] || 0; if (!q) return { error: "No hay Jamoneitor en el carrito." };
      saveUndo(ctx); delete ctx.state.cart[U.yapa.ref]; ctx.state.cart[U.yapa.id] = (ctx.state.cart[U.yapa.id] || 0) + q;
      ctx.state.order.service = "delivery"; ctx.state.order.branch = null;
      touch(ctx); emitCart(ctx);
      return { cambiado: true, nota: "Va por delivery La Scoobyneta.", carrito: cartSummary(ctx) };
    }
    const combo = U.combos.find((c) => c.id === combo_id);
    if (!combo) return { error: "Ese combo no existe.", combos: U.combos.map((c) => c.id) };
    if (!multisetFits(ctx.state.cart, combo.parts)) return { error: "Las pizzas de ese combo no están en el carrito.", necesita: combo.parts };
    saveUndo(ctx);
    for (const p of combo.parts) { ctx.state.cart[p] -= 1; if (ctx.state.cart[p] <= 0) delete ctx.state.cart[p]; }
    ctx.state.cart[combo.id] = (ctx.state.cart[combo.id] || 0) + 1;
    touch(ctx); emitCart(ctx);
    return { cambiado: true, incluye: combo.note, carrito: cartSummary(ctx) };
  },

  suggest_upsell(_, ctx) {
    if (ctx.state.upsold) return { sugerencia: null, nota: "Ya sugeriste algo en esta conversación. No insistas." };
    const h = comboHints(ctx)[0];
    ctx.state.upsold = true;
    if (h) return { sugerencia: h };
    return { sugerencia: null, nota: "No hay bebidas ni extras sueltos publicados: no sugieras nada más." };
  },

  get_my_orders(_, ctx) {
    const C = cat(ctx);
    return { pedidos: ctx.state.history.map((h, i) => ({ index: i, id: h.id, fecha: new Date(h.at).toISOString(), lugar: h.branch ? (branchById(h.branch) || {}).name : null, servicio: h.service,
      productos: Object.entries(h.cart).map(([id, q]) => (C[id] ? q + "× " + C[id].name : null)).filter(Boolean) })) };
  },
  reorder({ index }, ctx) {
    const h = ctx.state.history[index | 0]; if (!h) return { error: "No hay pedidos guardados en este dispositivo." };
    const C = cat(ctx); saveUndo(ctx); const cart = {}; const dropped = [];
    for (const [id, q] of Object.entries(h.cart)) { if (C[id]) cart[id] = q; else dropped.push(id); }
    ctx.state.cart = cart; ctx.state.order.service = h.service || ctx.state.order.service;
    if (h.service !== "delivery" && h.branch) ctx.state.order.branch = h.branch;
    touch(ctx); emitCart(ctx);
    return { cargado: true, carrito: cartSummary(ctx), servicio: h.service, sucursal: h.branch ? (branchById(h.branch) || {}).name : null, no_disponible_ahora: dropped.length ? dropped : undefined };
  },

  set_order_details(args, ctx) {
    const o = ctx.state.order; const errors = [];
    if (args.service != null) { const s = norm(args.service); const map = { delivery: "delivery", domicilio: "delivery", envio: "delivery", pickup: "pickup", recojo: "pickup", recoger: "pickup", retiro: "pickup", llevar: "pickup", mesa: "mesa", comer: "mesa", local: "mesa" };
      const v = map[s] || Object.entries(map).find(([k]) => s.includes(k))?.[1];
      if (!v) errors.push("Servicio inválido: delivery, pickup o mesa."); else o.service = v; }
    if (hasPromo(ctx.state) && o.service && o.service !== "delivery") { o.service = "delivery"; errors.push("La promo Jamoneitor a Bs 35 es solo por delivery La Scoobyneta: dejé el pedido como delivery."); }
    if (args.branch != null && args.branch !== "") { const b = findBranch(args.branch); if (!b) errors.push(`No conozco la sucursal "${clip(args.branch, 40)}". Opciones: ${U.branches.map((x) => x.name).join(", ")}.`); else o.branch = b.id; }
    if (args.address != null) o.address = clip(args.address, 200) || null;
    if (args.reference != null) o.reference = clip(args.reference, 200) || null;
    if (args.name != null) o.name = clip(args.name, 60) || null;
    if (args.payment != null) o.payment = clip(args.payment, 60) || null;
    if (args.notes != null) o.notes = clip(args.notes, 200) || null;
    if (args.when != null && args.when !== "") {
      const w = parseWhen(args.when, ctx);
      if (!w.ok) errors.push(w.error);
      else {
        const d = destination(ctx.state); const b = d ? d.branch : null;
        if (w.value === "asap") { if (b) { const st = U.branchStatus(b, ctx.now); if (!st.open) errors.push(`${d.name} está cerrada ahora. Abre ${st.when === "tomorrow" ? "mañana" : "hoy"} a las ${st.opensAt}. Podés programar una hora.`); else o.when = "asap"; } else o.when = "asap"; }
        else { const e = checkTime(w.value, ctx, b); if (e) errors.push(e); else o.when = w.value; }
      }
    }
    touch(ctx);
    const d = destination(ctx.state);
    return { ok: errors.length === 0, errores: errors.length ? errors : undefined, detalles: { servicio: o.service, sucursal: o.branch ? branchById(o.branch).name : null, destino: d ? d.name : null, direccion: o.address, referencia: o.reference, hora: o.when, nombre: o.name, pago: o.payment, nota: o.notes, pin: !!o.location }, faltan: missingDetails(ctx.state) };
  },

  request_location(_, ctx) { ctx.events.push({ type: "location" }); return { ok: true, nota: "Se mostró el botón 'Compartir mi ubicación'. Esperá a que la comparta." }; },

  prepare_order(_, ctx) {
    const s = ctx.state; const miss = missingDetails(s);
    if (miss.length) return { listo: false, faltan: miss };
    const d = destination(s); if (!d) return { listo: false, faltan: ["sucursal"] };
    if (s.order.when === "asap" && d.branch) { const st = U.branchStatus(d.branch, ctx.now); if (!st.open) return { listo: false, error: `${d.name} está cerrada ahora (abre ${st.opensAt}). Pedí una hora.` }; }
    else if (s.order.when && s.order.when !== "asap") { const e = checkTime(s.order.when, ctx, d.branch); if (e) return { listo: false, error: e }; }
    const rb = readback(ctx);
    s.stage = "awaiting_confirmation"; s.token = currentToken(s);
    ctx.events.push({ type: "readback", summary: rb });
    ctx.events.push({ type: "options", options: ["Sí, confirmar", "Cambiar algo"] });
    return { listo: true, resumen: rb, instruccion: "Mostré el resumen con los botones. Pedí confirmación y TERMINÁ el turno. No digas que está confirmado." };
  },

  place_order({ token }, ctx) {
    const s = ctx.state;
    if (!ctx.serverPlacing) {
      const ok = ctx.tokenAtStart && ctx.lastIsYes && ctx.tokenAtStart === currentToken(s) && s.stage === "awaiting_confirmation";
      if (!ok && !(s.placed && s.placed.token === token)) return { error: "No se puede enviar todavía: primero prepare_order, mostrar el resumen y esperar un 'sí' explícito del cliente en su próximo mensaje." };
    }
    if (s.placed && (s.placed.token === token || s.placed.token === ctx.tokenAtStart)) {
      return { ya_enviado: true, id: s.placed.id, nota: "El pedido ya estaba listo; el botón verde ya está en el chat." };
    }
    if (!token || token !== currentToken(s)) return { error: "El pedido cambió después del resumen. Volvé a llamar prepare_order." };
    const C = cat(ctx); const d = destination(s); const lines = lineList(s.cart, C); const total = cartTotal(s.cart, C);
    const id = orderIdFor(token);
    const text = U.orderText({ id, lines, total, service: s.order.service, place: d.name, address: s.order.address, reference: s.order.reference,
      pin: s.order.location, when: s.order.when, name: s.order.name, payment: s.order.payment, notes: s.order.notes });
    const url = U.waLink(d.whatsapp, text);
    const entry = { id, at: ctx.now.getTime(), branch: d.branch ? d.branch.id : null, service: s.order.service, cart: { ...s.cart } };
    s.history = [entry, ...s.history.filter((h) => h.id !== id)].slice(0, 3);
    s.placed = { token, id, url, branch: d.name, total };
    s.stage = "placed";
    if (!ctx.orderEmitted) { ctx.events.push({ type: "order", id, url, branch: d.name, total, entry }); ctx.orderEmitted = true; }
    return { enviado: true, id, destino: d.name, total, instruccion: "Decile que toque el botón verde para mandar el pedido por WhatsApp. No pegues el link." };
  },

  get_order_status(_, ctx) {
    const h = ctx.state.history[0];
    if (!h) return { pedido: null, nota: "No hay pedidos de este dispositivo. Ofrecé hablar con el call center." };
    const b = h.service === "delivery" ? { name: U.delivery.name, whatsapp: U.delivery.whatsapp } : (branchById(h.branch) || { name: "Call center", whatsapp: U.config.callCenter });
    const url = U.waLink(b.whatsapp, `¡Hola! Quería saber el estado de mi pedido ${h.id} 🍕`);
    ctx.events.push({ type: "handoff", url, to: b.name });
    return { pedido: { id: h.id, hora: new Date(h.at).toISOString(), lugar: b.name }, nota: "No tengo seguimiento en vivo. Mostré un botón de WhatsApp para preguntar a " + b.name + ". No inventes estados ni tiempos." };
  },

  handoff_to_human({ reason, summary }, ctx) {
    const d = destination(ctx.state) || { name: "Call center Ugo's", whatsapp: U.config.callCenter };
    const text = `¡Hola Ugo's! ${clip(reason, 120)}${summary ? "\n" + clip(summary, 400) : ""}`;
    const url = U.waLink(d.whatsapp, text);
    ctx.events.push({ type: "handoff", url, to: d.name });
    return { ok: true, a: d.name, nota: "Se mostró el botón para hablar con una persona. No pegues el link." };
  },

  show_options({ options }, ctx) {
    const opts = (Array.isArray(options) ? options : []).map((o) => clip(o, 40)).filter(Boolean).slice(0, 4);
    if (opts.length < 2) return { error: "Mandá entre 2 y 4 opciones." };
    ctx.events.push({ type: "options", options: opts }); return { ok: true };
  },

  log_miss({ text, reason }, ctx) { ctx.log({ evt: "hermosia_miss", text: clip(text, 200), reason: clip(reason, 80) }); return { ok: true }; },
};

function resolveInCart(item, ctx) {
  const ids = Object.keys(ctx.state.cart); if (!item) return null;
  if (ids.includes(item)) return item;
  const r = resolveItem(item, ctx); if (r.item && ids.includes(r.item.id)) return r.item.id;
  const n = words(item); const C = cat(ctx);
  const hits = ids.filter((id) => C[id] && n.some((t) => t.length >= 3 && prefixHit(words(C[id].name), t)));
  return hits.length === 1 ? hits[0] : null;
}

/* ---------------- schemas ---------------- */
const S = (props, req = []) => ({ type: "object", properties: props, required: req, additionalProperties: false });
const str = (d) => ({ type: "string", description: d });
const TOOL_DEFS = [
  { name: "search_menu", description: "Busca en el menú por nombre, ingrediente o tipo (ej. 'sin carne', 'tocino', 'combo con pepsi'). Devuelve ids y precios reales.", input_schema: S({ query: str("Lo que pidió el cliente, en sus palabras.") }, ["query"]) },
  { name: "get_item_details", description: "Precio, ingredientes, combos y promo de un producto. Siempre incluye la nota de alérgenos.", input_schema: S({ item: str("id o nombre del producto") }, ["item"]) },
  { name: "get_whats_new", description: "Novedades: promo del mes, la más vendida, combos destacados, promo de hoy.", input_schema: S({}) },
  { name: "get_branches", description: "Sucursales: horario, si están abiertas ahora, dirección y WhatsApp. Sin nombre devuelve todas.", input_schema: S({ name: str("Nombre de sucursal (opcional)") }) },
  { name: "get_deals", description: "Promo de hoy, promo del mes, combos y sugerencias según el carrito con total_si_acepta exacto.", input_schema: S({}) },
  { name: "cart_add", description: "Agrega productos al carrito del sitio (se actualiza en vivo). Usá ids cuando los tengas.", input_schema: S({ items: { type: "array", minItems: 1, maxItems: 10, items: S({ item: str("id o nombre"), qty: { type: "integer", minimum: 1, maximum: 50 }, size: str("tamaño si el cliente lo dijo") }, ["item"]) } }, ["items"]) },
  { name: "cart_remove", description: "Quita un producto del carrito.", input_schema: S({ item: str("id o nombre") }, ["item"]) },
  { name: "cart_set_qty", description: "Cambia la cantidad de un producto (0 lo quita).", input_schema: S({ item: str("id o nombre"), qty: { type: "integer", minimum: 0, maximum: 50 } }, ["item", "qty"]) },
  { name: "cart_clear", description: "Vacía el carrito.", input_schema: S({}) },
  { name: "cart_view", description: "Muestra el carrito, el total y los datos del pedido que faltan.", input_schema: S({}) },
  { name: "cart_undo", description: "Deshace el último cambio del carrito ('no, mejor dejala').", input_schema: S({}) },
  { name: "cart_swap_to_combo", description: "Cambia las pizzas del carrito por un combo (agrega la gaseosa) o por la promo del mes.", input_schema: S({ combo_id: str("id del combo o de la promo") }, ["combo_id"]) },
  { name: "suggest_upsell", description: "Una sola sugerencia por conversación (completar combo con la gaseosa).", input_schema: S({}) },
  { name: "get_my_orders", description: "Mi Pedido: últimos pedidos hechos desde este dispositivo.", input_schema: S({}) },
  { name: "reorder", description: "Carga en el carrito un pedido anterior de Mi Pedido ('lo de siempre').", input_schema: S({ index: { type: "integer", minimum: 0, maximum: 2 } }, ["index"]) },
  { name: "set_order_details", description: "Guarda datos del pedido y devuelve lo que falta. service: delivery | pickup | mesa. when: 'asap' o HH:MM.", input_schema: S({ service: str("delivery | pickup | mesa"), branch: str("sucursal para recojo o mesa"), address: str("dirección para delivery"), reference: str("referencia"), when: str("'asap' o HH:MM"), name: str("nombre del cliente"), payment: str("solo si el cliente lo dijo"), notes: str("nota") }) },
  { name: "request_location", description: "Entrega con Pin: muestra el botón para compartir la ubicación.", input_schema: S({}) },
  { name: "prepare_order", description: "Verifica y muestra el resumen del pedido con botones de confirmación. Después TERMINÁ el turno.", input_schema: S({}) },
  { name: "place_order", description: "Envía el pedido. SOLO después de un 'sí' explícito del cliente a un resumen mostrado en un turno anterior.", input_schema: S({ token: str("token del resumen") }, ["token"]) },
  { name: "get_order_status", description: "Sigue tu Pizza: último pedido y botón de WhatsApp para preguntar el estado.", input_schema: S({}) },
  { name: "handoff_to_human", description: "Pasa la conversación a una persona por WhatsApp (quejas, reembolsos, eventos grandes, alergias severas, o tras 2 intentos fallidos).", input_schema: S({ reason: str("motivo"), summary: str("resumen corto") }, ["reason"]) },
  { name: "show_options", description: "Muestra 2 a 4 botones de respuesta rápida.", input_schema: S({ options: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } } }, ["options"]) },
  { name: "log_miss", description: "Registra algo que el cliente pidió y no tenemos.", input_schema: S({ text: str("lo que pidió"), reason: str("por qué no se pudo") }, ["text", "reason"]) },
];
const anthropicTools = () => TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema, eager_input_streaming: true }));
const openaiTools = () => TOOL_DEFS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));

// Light schema validation (eager input streaming can deliver truncated input).
function validate(name, input) {
  const def = TOOL_DEFS.find((t) => t.name === name); if (!def) return "Herramienta desconocida.";
  if (!input || typeof input !== "object" || Array.isArray(input)) return "Entrada inválida.";
  const sc = def.input_schema;
  for (const r of sc.required) if (input[r] == null) return `Falta '${r}'.`;
  for (const [k, v] of Object.entries(input)) {
    const p = sc.properties[k]; if (!p) return `Campo desconocido '${k}'.`;
    if (v == null) continue;
    if (p.type === "string" && typeof v !== "string") return `'${k}' debe ser texto.`;
    if (p.type === "integer" && !Number.isInteger(typeof v === "string" ? Number(v) : v)) return `'${k}' debe ser entero.`;
    if (p.type === "array" && !Array.isArray(v)) return `'${k}' debe ser lista.`;
  }
  return null;
}

function runTool(name, input, ctx) {
  const err = validate(name, input || {});
  if (err) return { error: err };
  try { return impl[name](input || {}, ctx); }
  catch (e) { ctx.log({ evt: "hermosia_tool_error", tool: name, msg: String(e && e.message).slice(0, 200) }); return { error: "Error interno de la herramienta." }; }
}

/* ---------------- state ---------------- */
function emptyState() { return { cart: {}, prevCart: null, order: { service: null, branch: null, address: null, reference: null, location: null, when: null, payment: null, name: null, notes: null }, stage: "browsing", token: null, upsold: false, newsShown: false, history: [], placed: null, lines: [] }; }
function sanitizeCart(raw, C) {
  const out = {}; if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, q] of Object.entries(raw)) {
    if (!Object.prototype.hasOwnProperty.call(C, id)) continue;
    const n = Math.max(0, Math.min(MAX_QTY, parseInt(q, 10) || 0)); if (n > 0) out[id] = n;
    if (Object.keys(out).length >= MAX_LINES) break;
  }
  return out;
}
function sanitizeState(raw, now) {
  const C = U.catalog(now); const s = emptyState(); if (!raw || typeof raw !== "object") return s;
  s.cart = sanitizeCart(raw.cart, C);
  s.prevCart = raw.prevCart ? sanitizeCart(raw.prevCart, C) : null;
  const o = raw.order || {};
  if (SERVICES.includes(o.service)) s.order.service = o.service;
  if (o.branch && branchById(o.branch)) s.order.branch = o.branch;
  for (const k of ["address", "reference", "notes"]) if (typeof o[k] === "string") s.order[k] = clip(o[k], 200) || null;
  for (const k of ["name", "payment"]) if (typeof o[k] === "string") s.order[k] = clip(o[k], 60) || null;
  if (o.location && Number.isFinite(+o.location.lat) && Number.isFinite(+o.location.lng) && Math.abs(o.location.lat) <= 90 && Math.abs(o.location.lng) <= 180) s.order.location = { lat: +o.location.lat, lng: +o.location.lng };
  if (o.when === "asap" || (typeof o.when === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.when))) s.order.when = o.when;
  if (hasPromo(s)) { s.order.service = "delivery"; }
  if (STAGES.includes(raw.stage)) s.stage = raw.stage;
  if (typeof raw.token === "string" && /^T[0-9a-f]{16}$/.test(raw.token)) s.token = raw.token;
  if (s.stage === "awaiting_confirmation" && (!s.token || s.token !== currentToken(s))) { s.stage = "browsing"; s.token = null; }
  s.upsold = raw.upsold === true; s.newsShown = raw.newsShown === true;
  if (Array.isArray(raw.history)) {
    s.history = raw.history.slice(0, 3).filter((h) => h && typeof h.id === "string" && /^UG-[A-Z0-9]{5}$/.test(h.id)).map((h) => ({
      id: h.id, at: Number.isFinite(+h.at) ? +h.at : 0, branch: branchById(h.branch) ? h.branch : null, service: SERVICES.includes(h.service) ? h.service : null,
      cart: sanitizeCart(h.cart, U.catalog(now)) }));
  }
  const p = raw.placed;
  if (p && typeof p.id === "string" && /^UG-[A-Z0-9]{5}$/.test(p.id) && typeof p.url === "string" && p.url.startsWith("https://wa.me/") && typeof p.token === "string" && /^T[0-9a-f]{16}$/.test(p.token))
    s.placed = { token: p.token, id: p.id, url: p.url.slice(0, 4000), branch: clip(p.branch, 60), total: +p.total || 0 };
  if (Array.isArray(raw.lines)) s.lines = raw.lines.filter((x) => typeof x === "string" && x.length < 40).slice(-30);
  return s;
}

/* ---------------- confirmation ---------------- */
function isYes(text) {
  const t = norm(text);
  if (!t || String(text).length > 60) return false;
  if (/\b(no|nop|nel|pero|cambia|cambiar|cambiame|quita|quitale|saca|agrega|agregale|suma|espera|mejor|cancela|cancelar|todavia|aun)\b/.test(t)) return false;
  return /^(si|sii+|sip|sep|claro|dale|de una|confirmo|confirmar|confirmado|ok|okey|okay|listo|perfecto|bueno|va|vamos|mandalo|mandale|manda|hacelo|correcto|exacto|eso|asi esta bien|esta bien|yes|yep|sure)\b/.test(t);
}

module.exports = { TOOL_DEFS, anthropicTools, openaiTools, runTool, sanitizeState, emptyState, isYes, currentToken, cartSummary, comboHints, parseQuery, search, resolveItem, missingDetails, validate, orderIdFor, ALLERGEN_NOTE };
