/* Ugo's Pizza — site behaviour + HermosIA chat/voice UI. Vanilla, no build. */
(function () {
  "use strict";
  const U = window.UGOS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = U.money;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = U.catalog();
  const store = {
    get(k, d, s = localStorage) { try { const v = s.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v, s = localStorage) { try { s.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const ss = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
  const sget = (k, d) => (ss ? store.get(k, d, ss) : d);
  const sset = (k, v) => { if (ss) store.set(k, v, ss); };
  const icon = (id, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const yapaOn = U.yapaActive();
  const fmtPhone = (d) => String(d).replace(/^591/, "").replace(/(\d{3})(\d{2})(\d{3})/, "$1 $2 $3");

  /* ---------------- nav ---------------- */
  const NAV = [["#promos", "Promos"], ["#combos", "Combos"], ["#menu", "Pizzas"], ["#pedido", "Pedí"], ["#sucursales", "Sucursales"], ["#historia", "Historia"]];
  const navHtml = NAV.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join("") + `<li><button type="button" class="ai js-help">HermosIA ✨</button></li>`;
  $$(".js-navlist").forEach((ul) => (ul.innerHTML = navHtml));
  $(".js-mnavlist").innerHTML = navHtml;

  /* ---------------- WhatsApp links ---------------- */
  const greet = "¡Hola Ugo's! Quiero hacer un pedido 🍕";
  $$(".js-wa-cc").forEach((a) => (a.href = U.waLink(U.config.callCenter, greet)));
  $$(".js-scoob-wa").forEach((a) => (a.href = U.waLink(U.delivery.whatsapp, "¡Hola Scoobyneta! Quiero pedir delivery de Ugo's 🍕")));
  const cc = $(".js-cc-tel"); cc.href = "https://wa.me/" + U.config.callCenter; cc.target = "_blank"; cc.rel = "noopener";
  cc.textContent = "Bolivia · Call center WhatsApp " + fmtPhone(U.config.callCenter);

  /* ---------------- ticker ---------------- */
  (function ticker() {
    const minCombo = U.combos.reduce((a, c) => (c.price < a.price ? c : a), U.combos[0]);
    const tp = U.todayPromo();
    const star = U.menu[0].items.find((i) => i.star);
    const items = [
      `Combos pizza + gaseosa <b>desde ${money(minCombo.price)}</b>`,
      yapaOn ? `Promo del mes: <b>Jamoneitor a ${money(U.yapa.price)}</b> por La Scoobyneta` : `La de la casa: <b>Ugo's</b> con volcán de cheddar`,
      tp ? `Hoy: <b>${esc(tp.title)}</b>` : `La más vendida: <b>${esc(star.name)}</b> a ${money(star.price)}`,
      `Pedí por WhatsApp al <b>${fmtPhone(U.config.callCenter)}</b> o con HermosIA ✨`,
    ];
    const one = items.map((t) => `<span class="ticker__item">${icon("slice")}<span>${t}</span></span>`).join("");
    $("#ticker").innerHTML = one + one.replace(/<span class="ticker__item">/g, '<span class="ticker__item" aria-hidden="true">');
  })();

  /* ---------------- live open status ---------------- */
  function openInfo() {
    const st = U.branches.map((b) => ({ b, s: U.branchStatus(b) }));
    return { st, open: st.filter((x) => x.s.open).length };
  }
  function statusPill(s) {
    if (s.open && s.closingSoon) return `<span class="status status--soon"><span class="dot dot--amber"></span>Cierra pronto · ${esc(s.closesAt)}</span>`;
    if (s.open) return `<span class="status"><span class="dot"></span>Abierto · hasta ${esc(s.closesAt)}</span>`;
    if (s.opensAt && s.when === "today") return `<span class="status status--opens"><span class="dot dot--amber"></span>Abre ${esc(s.opensAt)}</span>`;
    return `<span class="status status--closed"><span class="dot dot--off"></span>Cerrado${s.opensAt ? " · mañana " + esc(s.opensAt) : ""}</span>`;
  }
  function refreshStatus() {
    const { st, open } = openInfo(); const n = U.branches.length;
    $$(".js-opencount").forEach((e) => (e.textContent = `${open} de ${n} abiertas`));
    $$(".js-opendot").forEach((e) => e.classList.toggle("dot--off", !open));
    const L = U.localParts();
    $(".js-clock").innerHTML = `${esc(L.hhmm)} en Santa Cruz · <b>${open} de ${n}</b> abiertas`;
    $(".js-clockdot").classList.toggle("dot--off", !open);
    // order box
    obStatus();
    // branches
    $(".js-branches").innerHTML = st.map(({ b, s }) => {
      const h = U.hoursFor(b, L.dow);
      return `<article class="bcard"><h3>${esc(b.name)}</h3>${statusPill(s)}
        <p><b>Hoy:</b> ${h ? esc(h[0]) + " – " + esc(h[1]) : "—"} <small>(martes desde las 17:00)</small></p>
        ${b.address ? `<p>${esc(b.address)}</p>` : ""}
        <div class="bcard__links"><a href="${esc(b.maps)}" target="_blank" rel="noopener">Cómo llegar ↗</a><a href="${esc(U.waLink(b.whatsapp, greet))}" target="_blank" rel="noopener">WhatsApp ${esc(fmtPhone(b.whatsapp))}</a></div></article>`;
    }).join("");
    // selects with live status
    const opts = st.map(({ b, s }) => `<option value="${esc(b.id)}">${esc(b.name)} · ${s.open ? "Abierto" : esc(s.label)}</option>`).join("");
    const obSel = $(".js-ob-branch"); const v1 = obSel.value; obSel.innerHTML = opts; if (v1) obSel.value = v1;
    const fSel = $(".js-f-branch"); const v2 = fSel.value; fSel.innerHTML = opts + `<option value="cc">Call center · consultas generales</option>`; if (v2) fSel.value = v2;
  }

  /* ---------------- order box ---------------- */
  let obSvc = "delivery";
  const scoobBranch = U.branches.find((b) => b.whatsapp === U.delivery.whatsapp);
  function obStatus() {
    const dot = $(".js-ob-dot"), out = $(".js-ob-status");
    let s;
    if (obSvc === "delivery") s = U.branchStatus(scoobBranch);
    else s = U.branchStatus(U.branches.find((b) => b.id === $(".js-ob-branch").value) || U.branches[0]);
    const { open } = openInfo();
    dot.className = "dot js-ob-dot" + (s.open ? "" : " dot--off");
    if (obSvc === "delivery") out.innerHTML = s.open ? `La Scoobyneta está repartiendo · <b>${open} de ${U.branches.length}</b> sucursales abiertas` : (s.when === "today" ? `Abre hoy a las ${esc(s.opensAt)}` : `Volvemos mañana desde las ${esc(s.opensAt)}`);
    else out.innerHTML = s.open ? `<b>${open} de ${U.branches.length}</b> sucursales abiertas ahora` : (s.when === "today" ? `Abre hoy a las ${esc(s.opensAt)}` : `Volvemos mañana desde las ${esc(s.opensAt)}`);
  }
  $$("#orderbox .seg button").forEach((b) => b.addEventListener("click", () => {
    obSvc = b.dataset.svc;
    $$("#orderbox .seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $(".js-ob-dest").hidden = obSvc !== "delivery"; $(".js-ob-branch").hidden = obSvc === "delivery";
    obStatus();
  }));
  $(".js-ob-branch").addEventListener("change", obStatus);
  $("#orderbox").addEventListener("submit", (e) => {
    e.preventDefault();
    funnelStart(obSvc, obSvc === "pickup" ? $(".js-ob-branch").value : null);
  });

  /* ---------------- hero carousel ---------------- */
  (function hero() {
    const hero = $("#hero"); const slides = $$(".slide", hero); const dots = $(".dots", hero);
    const hdr = $("#hdr"); const vid = $(".js-hero-video");
    let i = 0, timer = null, paused = false, visible = true;
    // monthly special banner (or the house pizza once the promo has ended)
    if (!yapaOn) {
      const h = U.menu[0].items.find((x) => x.house);
      $(".js-y-kicker").textContent = "La de la casa";
      $(".js-y-title").innerHTML = `${esc(h.name)} <em>con volcán de cheddar</em>`;
      $(".js-y-price").textContent = h.price;
      $(".js-y-desc").textContent = "Borde de salchichas, jamón y un volcán de crema de queso cheddar al centro.";
      $(".js-y-add").dataset.add = h.id;
      $(".js-y-wa").textContent = "Ver el menú"; $(".js-y-wa").href = "#menu"; $(".js-y-wa").removeAttribute("target");
      $(".js-y-img").src = "assets/img/pizza-ugos.webp"; $(".js-y-img").alt = "Pizza Ugo's";
      $(".js-terms").textContent = "Precios publicados por Ugo's · en sucursal o por WhatsApp";
    } else {
      $(".js-y-wa").href = U.waLink(U.yapa.channel, "¡Hola Scoobyneta! Quiero la Jamoneitor a Bs 35 🍕");
      $(".js-y-price").textContent = U.yapa.price;
    }
    $$("[data-price-of]").forEach((el) => { const it = C[el.dataset.priceOf]; if (it) el.textContent = it.price; });
    dots.innerHTML = slides.map((s, k) => `<button type="button" role="tab" aria-label="Promoción ${k + 1}" aria-selected="${k === 0}"></button>`).join("");
    const dotBtns = $$("button", dots);
    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => { const on = k === i; s.classList.toggle("is-active", on); s.inert = !on; s.setAttribute("aria-hidden", String(!on)); });
      dotBtns.forEach((d, k) => { d.setAttribute("aria-selected", String(k === i)); d.tabIndex = k === i ? 0 : -1; });
      const light = slides[i].dataset.theme === "light";
      hero.classList.toggle("is-light", light); hdr.classList.toggle("on-light", light);
      syncVideo();
    }
    function syncVideo() {
      if (!vid) return;
      const on = slides[i].contains(vid) && visible && !reduced;
      if (on) { vid.preload = "auto"; const p = vid.play(); if (p && p.catch) p.catch(() => {}); } else vid.pause();
    }
    function start() { stop(); if (reduced || paused) return; timer = setInterval(() => show(i + 1), 6500); }
    function stop() { clearInterval(timer); timer = null; }
    dotBtns.forEach((d, k) => {
      d.addEventListener("click", () => { show(k); start(); });
      d.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); show(i + (e.key === "ArrowRight" ? 1 : -1)); dotBtns[i].focus(); } });
    });
    hero.addEventListener("mouseenter", () => { paused = true; stop(); });
    hero.addEventListener("mouseleave", () => { paused = false; start(); });
    hero.addEventListener("focusin", () => { paused = true; stop(); });
    hero.addEventListener("focusout", () => { paused = false; start(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { stop(); if (vid) vid.pause(); } else { start(); syncVideo(); } });
    let x0 = null;
    hero.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { show(i + (dx < 0 ? 1 : -1)); start(); } x0 = null; });
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; syncVideo(); }, { threshold: 0.25 }).observe(hero);
    show(0); start();
    // WhatsApp QR card (desktop), hidden for the session once closed
    const qr = $(".js-qr");
    if (!sget("ugos_qr_x", false)) qr.hidden = false;
    $(".js-qr-x").addEventListener("click", () => { qr.hidden = true; sset("ugos_qr_x", true); });
  })();

  /* ---------------- offers rail ---------------- */
  function rail(track, prev, next) {
    const upd = () => { if (!prev || !next) return; prev.hidden = track.scrollLeft < 10; next.hidden = track.scrollLeft + track.clientWidth >= track.scrollWidth - 10; };
    const step = () => Math.max(260, track.clientWidth * 0.8);
    if (prev) prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: reduced ? "auto" : "smooth" }));
    if (next) next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: reduced ? "auto" : "smooth" }));
    track.addEventListener("scroll", upd, { passive: true }); window.addEventListener("resize", upd); setTimeout(upd, 300);
  }
  $(".js-offers").innerHTML = U.offers.map((o) => `<a class="offer" href="${esc(o.href)}" target="_blank" rel="noopener"><img src="${esc(o.img)}" alt="${esc(o.alt)}" width="900" height="889" loading="lazy"></a>`).join("");
  rail($(".js-offers"), $(".rail__btn--prev"), $(".rail__btn--next"));

  /* ---------------- weekly (only if published) ---------------- */
  if (U.weekly && U.weekly.length) {
    $(".js-weekly-sec").hidden = false;
    const L = U.localParts(); const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    $(".js-weekly").innerHTML = U.weekly.map((w) => `<article class="wcard${w.day === L.dow ? " is-today" : ""}"><p class="eyebrow">${days[w.day]}</p><h3>${esc(w.title)}</h3><p>${esc(w.desc)}</p><b>${money(w.price)}</b></article>`).join("");
  }

  /* ---------------- monthly special section ---------------- */
  (function yapa() {
    const media = $(".js-y2-media");
    if (yapaOn) {
      media.innerHTML = `<video class="js-autoplay" muted playsinline loop preload="none" poster="${esc(U.yapa.video)}.webp" width="540" height="960"><source src="${esc(U.yapa.video)}.mp4" type="video/mp4"></video>`;
      $(".js-y2-fine").textContent = U.yapa.conditions;
      $(".js-y2-wa").href = U.waLink(U.yapa.channel, "¡Hola Scoobyneta! Quiero la Jamoneitor a Bs 35 🍕");
      $(".js-y2-price").textContent = U.yapa.price;
    } else {
      const h = U.menu[0].items.find((x) => x.house);
      $(".js-y2-eyebrow").textContent = "La de la casa";
      $(".js-y2-title").innerHTML = `La pizza <span class="hl">${esc(h.name)}</span>`;
      $(".js-y2-lede").textContent = h.desc;
      $(".js-y2-price").textContent = h.price;
      $(".js-y2-add").dataset.add = h.id;
      $(".js-y2-wa").href = U.waLink(U.config.callCenter, greet);
      $(".js-y2-wa").lastChild.textContent = "WhatsApp";
      media.innerHTML = `<img src="${esc(h.img)}" alt="${esc(h.name)}" width="640" height="426" loading="lazy" style="object-fit:contain;background:var(--cream)">`;
    }
  })();

  /* ---------------- menu ---------------- */
  (function menu() {
    $(".js-coins").innerHTML = [["20+", "Sabores", "para elegir"], ["8", "Porciones", "en los combos familiares"], ["100%", "Boliviana", "masa madre y salsa a la leña"]]
      .map(([n, a, b]) => `<div class="coin"><b>${n}</b><span>${a}<small>${b}</small></span></div>`).join("");
    const items = U.menu[0].items;
    // Every pizza starts "Masa madre, salsa de tomate a la leña, …" (said once in the section intro)
    const short = (d) => { const t = d.replace(/^Masa madre, salsa de tomate a la leña,\s*/i, ""); return t.charAt(0).toUpperCase() + t.slice(1); };
    const tabs = [["all", "Todas", () => true], ["veg", "Sin carne", (x) => x.veg], ["cheap", "Hasta Bs 50", (x) => x.price <= 50], ["top", "Las favoritas", (x) => x.star || x.house]];
    const tabEl = $(".tabs"); const list = $(".js-mlist"); const more = $(".js-mmore");
    tabEl.innerHTML = tabs.map(([id, t], k) => `<button class="tab" type="button" role="tab" data-tab="${id}" aria-selected="${k === 0}">${t}</button>`).join("");
    function render(id) {
      const f = tabs.find((t) => t[0] === id)[2]; const rows = items.filter(f);
      list.innerHTML = rows.map((it) => `<li class="mitem"><img class="mitem__img" src="${esc(it.img)}" alt="" width="76" height="76" loading="lazy">
        <div><h3 class="mitem__name">${esc(it.name)}${it.star ? '<span class="tag">La más vendida</span>' : ""}${it.house ? '<span class="tag tag--house">De la casa</span>' : ""}${it.veg ? '<span class="tag tag--veg">Sin carne</span>' : ""}${yapaOn && U.yapa.ref === it.id ? '<span class="tag">Bs 35 x Scoobyneta</span>' : ""}</h3><p class="mitem__desc">${esc(short(it.desc))}</p></div>
        <div class="mitem__side"><span class="mitem__price">${money(it.price)}</span><button class="plus" type="button" data-add="${esc(it.id)}" aria-label="Agregar ${esc(it.name)}">${icon("plus")}</button></div></li>`).join("");
      list.classList.add("is-collapsed");
      more.hidden = rows.length <= 6; more.textContent = `Ver las ${rows.length} ↓`;
    }
    tabEl.addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (!b) return; $$(".tab", tabEl).forEach((t) => t.setAttribute("aria-selected", String(t === b))); render(b.dataset.tab); });
    more.addEventListener("click", () => { list.classList.remove("is-collapsed"); more.hidden = true; });
    render("all");
  })();

  /* ---------------- combos + featured ---------------- */
  (function combos() {
    const card = (c) => `<article class="combo${c.star ? " combo--star" : ""} reveal"><div class="combo__media"><img src="${esc(c.img)}" alt="${esc(c.name)}" width="720" height="540" loading="lazy">
      <div class="combo__badges">${c.tag ? `<span class="tag">${esc(c.tag)}</span>` : ""}</div></div>
      <div class="combo__body"><h3 class="combo__name">${esc(c.name)}</h3><p class="combo__note">${esc(c.note)}</p>
      <div class="combo__foot"><span class="combo__price"><small>Bs</small>${c.price}</span><button class="plus plus--cream" type="button" data-add="${esc(c.id)}" aria-label="Agregar combo ${esc(c.name)}">${icon("plus")}</button></div></div></article>`;
    const grid = $(".js-combos"); grid.innerHTML = U.combos.slice(0, 4).map(card).join("");
    const btn = $(".js-combos-more"); btn.textContent = `Ver los ${U.combos.length} combos`;
    btn.addEventListener("click", () => { grid.insertAdjacentHTML("beforeend", U.combos.slice(4).map(card).join("")); btn.parentElement.remove(); observeReveal(grid); });
    $(".js-featured").innerHTML = U.featured.map((f) => {
      const it = C[f.ref];
      const media = f.video ? `<video class="js-autoplay" muted playsinline loop preload="none" poster="${esc(f.video)}.webp" width="540" height="960"><source src="${esc(f.video)}.mp4" type="video/mp4"></video>` : `<img src="${esc(f.img)}" alt="${esc(f.name)}" width="640" height="426" loading="lazy">`;
      return `<article class="feat reveal"><div class="feat__media">${media}</div><div class="feat__body"><span class="tag" style="width:max-content">${esc(f.tag)}</span><h3>${esc(f.name)}</h3><p>${esc(f.desc)}</p>
        <div class="feat__foot"><span class="feat__price">${money(it.price)}</span><button class="plus" type="button" data-add="${esc(it.id)}" aria-label="Agregar ${esc(f.name)}">${icon("plus")}</button></div></div></article>`;
    }).join("");
  })();

  /* ---------------- reels ---------------- */
  (function reels() {
    const t = $(".js-reels");
    t.innerHTML = U.reels.map((r) => `<div class="reel"><video muted playsinline loop preload="none" poster="${esc(r.src)}.webp" width="540" height="960"><source src="${esc(r.src)}.mp4" type="video/mp4"></video><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.caption)} ↗</a></div>`).join("");
    rail(t, null, null);
    const step = () => Math.max(240, t.clientWidth * 0.7);
    $(".js-reel-prev").addEventListener("click", () => t.scrollBy({ left: -step(), behavior: reduced ? "auto" : "smooth" }));
    $(".js-reel-next").addEventListener("click", () => t.scrollBy({ left: step(), behavior: reduced ? "auto" : "smooth" }));
    const io = new IntersectionObserver((en) => en.forEach((e) => { const v = e.target; if (e.intersectionRatio >= 0.35 && !reduced) { v.preload = "auto"; const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause(); }), { threshold: [0, 0.35, 0.6] });
    $$("video", t).forEach((v) => io.observe(v));
  })();

  /* ---------------- story / feed / footer ---------------- */
  $(".js-story-p1").textContent = U.story.p1;
  $(".js-story-p2").textContent = U.story.p2;
  $(".js-timeline").innerHTML = U.story.timeline.map((t, k) => `<li><b>${k + 1}</b><div><strong>${esc(t.k)}</strong><span>${esc(t.v)}</span></div></li>`).join("");
  $(".js-feed").innerHTML = U.feed.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener"><img src="${esc(f.img)}" alt="${esc(f.alt)}" width="600" height="750" loading="lazy"></a>`).join("");
  (function footer() {
    const g = (title, items) => `<details class="fgroup"><summary>${title}${icon("chev")}</summary><ul>${items.join("")}</ul></details>`;
    const li = (t, h, ext) => `<li><a href="${esc(h)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(t)}</a></li>`;
    $(".js-fgroups").innerHTML = [
      g("Productos", [li("Todas las pizzas", "#menu"), li("Combos", "#combos"), li("La más vendida: Cheeseburguer", "#menu"), li("La de la casa: Ugo's", "#menu")]),
      g("Promos", [...(yapaOn ? [li("Jamoneitor a Bs 35 (noviembre)", "#yapa")] : []), ...U.combos.slice(0, 4).map((c) => li(`${c.name} · ${money(c.price)}`, "#combos"))]),
      g("Pedidos", [li("Pedí en 4 pasos", "#pedido"), li("WhatsApp call center", U.waLink(U.config.callCenter, greet), true), li("Delivery La Scoobyneta", U.waLink(U.delivery.whatsapp, greet), true), li("HermosIA ✨", "#chat")]),
      g("Sucursales", [...U.branches.map((b) => li(b.name, b.maps, true)), "<li><small>Lun a dom 12:00–01:00 · martes 17:00–01:00</small></li>"]),
      g("Ugo's", [li("Historia", "#historia"), li("Franquicias", U.config.franchise, true), li("Trabajá con nosotros", U.config.franchise, true), li("Instagram", U.config.instagram, true), li("Facebook", U.config.facebook, true), li("TikTok", U.config.tiktok, true)]),
    ].join("");
    const groups = $$(".fgroup");
    groups.forEach((d) => d.addEventListener("toggle", () => { if (d.open && window.innerWidth > 760) groups.forEach((o) => { if (o !== d) o.open = false; }); }));
    document.addEventListener("click", (e) => { if (window.innerWidth > 760 && !e.target.closest(".fgroup")) groups.forEach((d) => (d.open = false)); });
    $(".js-fgroups").addEventListener("click", (e) => { const a = e.target.closest('a[href="#chat"]'); if (a) { e.preventDefault(); openChat(); } });
    $(".js-fmeta").textContent = `Lunes a domingo 12:00–01:00 · martes 17:00–01:00 · Santa Cruz de la Sierra, Bolivia · © ${new Date().getFullYear()} Ugo's Pizza`;
  })();

  /* ---------------- reveal + autoplay ---------------- */
  const rio = "IntersectionObserver" in window ? new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); rio.unobserve(e.target); } }), { threshold: 0.12 }) : null;
  function observeReveal(root = document) { $$(".reveal:not(.is-in)", root).forEach((el) => (rio ? rio.observe(el) : el.classList.add("is-in"))); }
  observeReveal();
  const aio = new IntersectionObserver((en) => en.forEach((e) => { const v = e.target; if (e.isIntersecting && !reduced) { v.preload = "auto"; const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause(); }), { threshold: 0.35 });
  $$(".js-autoplay").forEach((v) => aio.observe(v));

  /* ---------------- toast ---------------- */
  const toastEl = $(".toast"); let toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("is-on"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("is-on"), 2600); }

  /* ---------------- cart (shared with HermosIA) ---------------- */
  let cart = sanitizeCart(store.get("ugos_cart", {}));
  function sanitizeCart(c) { const o = {}; if (c && typeof c === "object") for (const [k, v] of Object.entries(c)) { const n = Math.min(50, Math.max(0, parseInt(v, 10) || 0)); if (C[k] && n) o[k] = n; } return o; }
  const cartLines = () => Object.entries(cart).map(([id, qty]) => ({ id, qty, name: C[id].name, unit: C[id].price, subtotal: C[id].price * qty, img: C[id].img }));
  const cartTotal = () => cartLines().reduce((s, l) => s + l.subtotal, 0);
  const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
  function setCart(next, opts = {}) {
    const before = cartCount(); cart = sanitizeCart(next); store.set("ugos_cart", cart);
    renderCart(); if (cartCount() > before && !opts.silent) bump();
  }
  function bump() { $$(".js-count").forEach((b) => { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }); }
  function addToCart(id, qty = 1) {
    if (!C[id]) return;
    const n = { ...cart }; n[id] = Math.min(50, (n[id] || 0) + qty); setCart(n);
    toast(`${C[id].name} agregado 🍕`);
    if (C[id].kind === "promo") toast("Jamoneitor a Bs 35: va por delivery La Scoobyneta 🚌");
  }
  function renderCart() {
    const n = cartCount(); const lines = cartLines();
    $$(".js-count").forEach((b) => { b.hidden = !n; b.textContent = n; });
    const mc = $(".mbar__cart"); mc.hidden = !n; $(".js-mbar-cart").textContent = `${n} · ${money(cartTotal())}`;
    $(".js-dtotal").textContent = money(cartTotal());
    $(".js-dbody").innerHTML = lines.length ? lines.map((l) => `<div class="dline"><img src="${esc(l.img)}" alt="" width="56" height="56" loading="lazy"><div><b>${esc(l.name)}</b><small>${money(l.unit)} c/u</small>
      <div class="qty"><button type="button" data-dec="${esc(l.id)}" aria-label="Quitar uno de ${esc(l.name)}">−</button><span>${l.qty}</span><button type="button" data-inc="${esc(l.id)}" aria-label="Agregar uno de ${esc(l.name)}">+</button></div></div><span class="dline__p">${money(l.subtotal)}</span></div>`).join("")
      : `<div class="empty"><img src="assets/img/gafas.webp" alt="" width="160" height="56" loading="lazy"><p><b>Tu pedido está vacío.</b><br>Elegí una pizza del menú o pedile a HermosIA.</p><a class="btn btn--red" href="#menu">Ver el menú</a></div>`;
    $(".js-dcontinue").hidden = !lines.length;
    renderFunnelCart();
  }
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]"); if (add) { e.preventDefault(); addToCart(add.dataset.add); return; }
    const inc = e.target.closest("[data-inc]"); if (inc) { const n = { ...cart }; n[inc.dataset.inc] = (n[inc.dataset.inc] || 0) + 1; setCart(n, { silent: true }); return; }
    const dec = e.target.closest("[data-dec]"); if (dec) { const n = { ...cart }; n[dec.dataset.dec] -= 1; if (n[dec.dataset.dec] <= 0) delete n[dec.dataset.dec]; setCart(n); return; }
    if (e.target.closest(".js-help")) { e.preventDefault(); openChat(); return; }
    if (e.target.closest(".js-cart")) { e.preventDefault(); openDrawer(); }
  });

  /* ---------------- drawer ---------------- */
  const drawer = $("#drawer"), scrim = $(".js-scrim"); let lastFocus = null;
  drawer.hidden = false; drawer.inert = true;
  function openDrawer() { lastFocus = document.activeElement; drawer.inert = false; drawer.classList.add("is-open"); scrim.classList.add("is-on"); document.body.classList.add("drawer-open"); setTimeout(() => $(".js-drawer-x").focus(), 50); syncFloating(); }
  function closeDrawer() { drawer.classList.remove("is-open"); scrim.classList.remove("is-on"); drawer.inert = true; document.body.classList.remove("drawer-open"); if (lastFocus) lastFocus.focus(); syncFloating(); }
  $(".js-drawer-x").addEventListener("click", closeDrawer);
  scrim.addEventListener("click", () => { closeDrawer(); closeMnav(); });
  $(".js-dcontinue").addEventListener("click", (e) => { e.preventDefault(); closeDrawer(); funnelStart(null, null, true); });

  /* ---------------- mobile nav ---------------- */
  const mnav = $("#mnav"); const burger = $(".js-burger");
  mnav.hidden = false; mnav.inert = true;
  function openMnav() { mnav.inert = false; mnav.classList.add("is-open"); burger.setAttribute("aria-expanded", "true"); setTimeout(() => $(".js-mnav-close").focus(), 50); }
  function closeMnav() { if (!mnav.classList.contains("is-open")) return; mnav.classList.remove("is-open"); mnav.inert = true; burger.setAttribute("aria-expanded", "false"); burger.focus(); }
  burger.addEventListener("click", openMnav);
  $(".js-mnav-close").addEventListener("click", closeMnav);
  mnav.addEventListener("click", (e) => { if (e.target.closest("a, .js-help")) { mnav.classList.remove("is-open"); mnav.inert = true; burger.setAttribute("aria-expanded", "false"); } });

  /* ---------------- header scroll + floating UI ---------------- */
  const hdr = $("#hdr"), mbar = $("#mbar"), fab = $(".aifab");
  let overHero = true, overFunnel = false, overFooter = false;
  function onScroll() {
    const tick = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--tick"), 10) || 48;
    hdr.classList.toggle("is-solid", window.scrollY > tick);
  }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const watch = (el, cb, th = 0) => new IntersectionObserver((en) => { cb(en[0].isIntersecting); syncFloating(); }, { threshold: th }).observe(el);
  watch($("#hero"), (v) => (overHero = v), 0.15);
  watch($("#pedido"), (v) => (overFunnel = v), 0.2);
  watch($("footer"), (v) => (overFooter = v));
  function syncFloating() {
    const chatOpen = chat.classList.contains("is-open"); const drawerOpen = drawer.classList.contains("is-open");
    mbar.classList.toggle("is-hidden", overHero || overFunnel || overFooter || chatOpen || drawerOpen);
    fab.classList.toggle("is-hidden", overFooter || chatOpen);
  }
  document.addEventListener("keydown", (e) => { if (e.key !== "Escape") return; if (chat.classList.contains("is-open")) closeChat(); else if (drawer.classList.contains("is-open")) closeDrawer(); else closeMnav(); });

  /* ---------------- WhatsApp funnel ---------------- */
  const F = { step: 1, intent: null, when: "asap" };
  const fform = $(".js-funnel"); const fmsg = $(".fmsg", fform);
  function funnelStart(intent, branch, fromCart) {
    if (intent) setIntent(intent);
    else if (!F.intent) setIntent(cart[U.yapa && U.yapa.id] ? "delivery" : "pickup");
    if (branch) $(".js-f-branch").value = branch;
    goStep(2); document.getElementById("pedido").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    void fromCart;
  }
  function setIntent(v) {
    F.intent = v;
    $$(".intent", fform).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.intent === v)));
    $(".js-f2-title").textContent = { delivery: "Tu pedido para delivery", pickup: "Tu pedido para recoger", mesa: "Tu mesa o evento", question: "Tu consulta" }[v];
    $(".js-f2-order").hidden = !(v === "delivery" || v === "pickup");
    $(".js-f2-event").hidden = v !== "mesa"; $(".js-f2-q").hidden = v !== "question";
    $(".js-f-addr").hidden = v !== "delivery"; $(".js-f-scoob").hidden = v !== "delivery";
    $(".js-f-branchwrap").hidden = v === "delivery";
    $(".js-f-whenwrap").hidden = v === "question";
    updateBubble();
  }
  function goStep(n) {
    F.step = n; fmsg.textContent = "";
    $$(".fstep", fform).forEach((s) => s.classList.toggle("is-on", +s.dataset.step === n));
    $$(".steps li").forEach((li, k) => { li.classList.toggle("is-done", k < n - 1); li.classList.toggle("is-on", k === n - 1); });
    $(".js-back").hidden = n === 1; $(".js-next").hidden = n === 4;
    if (n === 4) buildReview();
    updateBubble();
  }
  $$(".intent", fform).forEach((b) => b.addEventListener("click", () => { setIntent(b.dataset.intent); goStep(2); }));
  $(".js-back").addEventListener("click", () => goStep(Math.max(1, F.step - 1)));
  $(".js-next").addEventListener("click", () => { const err = validate(F.step); if (err) { fmsg.textContent = err; return; } goStep(F.step + 1); });
  $$(".chip[data-when]", fform).forEach((c) => c.addEventListener("click", () => { F.when = c.dataset.when; $$(".chip[data-when]", fform).forEach((x) => x.setAttribute("aria-pressed", String(x === c))); $(".js-f-time").hidden = F.when !== "later"; updateBubble(); }));
  fform.addEventListener("input", updateBubble); fform.addEventListener("change", updateBubble);
  function renderFunnelCart() {
    const lines = cartLines();
    const html = lines.length ? `<ul>${lines.map((l) => `<li><span>${l.qty}× ${esc(l.name)}</span><span>${money(l.subtotal)}</span></li>`).join("")}</ul><div class="fcart__total"><span>Total</span><span>${money(cartTotal())}</span></div>` : `<p style="margin:0;opacity:.8">Todavía no agregaste nada. Elegí abajo 👇</p>`;
    $(".js-fcart").innerHTML = html; $(".js-fcart2").innerHTML = lines.length ? html : "";
    updateBubble();
  }
  $(".js-picker").innerHTML = Object.values(C).filter((it) => it.kind !== "promo" || yapaOn).map((it) => `<button type="button" class="pick" data-add="${esc(it.id)}"><span>${esc(it.name)}</span><b>${money(it.price)}</b></button>`).join("");
  function fdata() {
    const v = (id) => ($("#" + id).value || "").trim();
    const branchId = $(".js-f-branch").value; const b = U.branches.find((x) => x.id === branchId);
    let dest;
    if (F.intent === "delivery" || (cart[U.yapa && U.yapa.id] && F.intent !== "question")) dest = { name: "La Scoobyneta (delivery)", wa: U.delivery.whatsapp, branch: scoobBranch };
    else if (b) dest = { name: "Sucursal " + b.name, wa: b.whatsapp, branch: b };
    else dest = { name: "Call center Ugo's", wa: U.config.callCenter, branch: null };
    const when = F.when === "later" ? $(".js-f-time").value : "asap";
    return { name: v("f-name"), addr: v("f-addr"), ref: v("f-ref"), note: v("f-note"), date: v("f-date"), people: v("f-people"), occ: v("f-occ"), topic: v("f-topic"), q: v("f-q"), when, dest };
  }
  function message() {
    if (!F.intent) return "¡Hola Ugo's! 🍕";
    const d = fdata(); const lines = cartLines(); const total = cartTotal();
    if (F.intent === "question") return `¡Hola Ugo's! Tengo una consulta sobre ${d.topic}:\n${d.q || "…"}${d.name ? "\n\nNombre: " + d.name : ""}`;
    if (F.intent === "mesa") {
      const out = ["¡Hola Ugo's! Quiero consultar por una mesa o evento 🍕"];
      if (d.date) out.push("Fecha: " + d.date); if (d.people) out.push("Personas: " + d.people); if (d.occ) out.push("Ocasión: " + d.occ);
      if (lines.length) { out.push(""); lines.forEach((l) => out.push(`• ${l.qty}× ${l.name} — ${money(l.subtotal)}`)); out.push(`*Total: ${money(total)}*`); }
      out.push(""); out.push("Sucursal: " + d.dest.name); if (d.when) out.push("Hora: " + (d.when === "asap" ? "Lo antes posible" : d.when)); if (d.name) out.push("Nombre: " + d.name); if (d.note) out.push("Nota: " + d.note);
      return out.join("\n");
    }
    return U.orderText({ lines, total, service: F.intent === "delivery" || d.dest.wa === U.delivery.whatsapp && F.intent !== "pickup" ? "delivery" : F.intent, place: d.dest.name, address: d.addr, reference: d.ref, when: d.when || null, name: d.name, notes: d.note });
  }
  function validate(step) {
    const d = fdata();
    if (step === 1 && !F.intent) return "Elegí una opción para seguir.";
    if (step === 2) {
      if ((F.intent === "delivery" || F.intent === "pickup") && !cartCount()) return "Agregá al menos una pizza o combo.";
      if (F.intent === "question" && !d.q) return "Escribí tu consulta.";
      if (F.intent === "pickup" && cart[U.yapa && U.yapa.id]) return "La Jamoneitor a Bs 35 es solo por delivery La Scoobyneta. Cambiá a Delivery o quitala.";
    }
    if (step === 3) {
      if (!d.name) return "Decinos tu nombre.";
      if (F.intent === "delivery" && !d.addr) return "Falta la dirección para el delivery.";
      if (F.when === "later" && !d.when) return "Elegí la hora.";
      if (d.dest.branch && F.intent !== "question") {
        const s = U.branchStatus(d.dest.branch);
        if (d.when === "asap" && !s.open) return `${d.dest.name} está cerrada ahora: abre ${s.when === "today" ? "hoy" : "mañana"} a las ${s.opensAt}. Programá una hora.`;
        if (d.when !== "asap" && !U.openAt(d.dest.branch, d.when)) return `A las ${d.when} ${d.dest.name} está cerrada.`;
      }
    }
    return "";
  }
  function buildReview() {
    const d = fdata(); const txt = message();
    $(".js-review").textContent = txt;
    $(".js-f-dest").innerHTML = `${icon("wa")}<span>Se envía a <b>${esc(d.dest.name)}</b> · WhatsApp ${esc(fmtPhone(d.dest.wa))}</span>`;
    $(".js-send").href = U.waLink(d.dest.wa, txt);
  }
  function updateBubble() { $(".js-bubble").textContent = message(); $(".js-ph-name").textContent = F.intent ? fdata().dest.name.replace(" (delivery)", "") : "Ugo's Pizza"; if (F.step === 4) buildReview(); }
  $(".js-send").addEventListener("click", () => { const id = "web-" + Date.now(); saveMiPedido({ id, at: Date.now(), branch: fdata().dest.branch ? fdata().dest.branch.id : null, service: F.intent, cart: { ...cart }, web: true }); toast("¡Abriendo WhatsApp! 😎"); });

  /* ---------------- Mi Pedido (device history) ---------------- */
  function miPedido() { return (store.get("ugos_mipedido", []) || []).filter((h) => h && /^UG-[A-Z0-9]{5}$/.test(h.id)).slice(0, 3); }
  function saveMiPedido(entry) { if (!/^UG-[A-Z0-9]{5}$/.test(entry.id)) return; const list = [entry, ...miPedido().filter((h) => h.id !== entry.id)].slice(0, 3); store.set("ugos_mipedido", list); }

  /* ================= HermosIA chat ================= */
  const chat = $("#chat"); const log = $(".chat__log", chat); const input = $("#chat-in"); const form = $(".chat__form", chat);
  const micBtn = $(".mic", chat); const vbar = $(".vbar", chat); const vst = $(".vbar__st", chat); const handsfree = $(".js-handsfree", chat);
  chat.hidden = false; chat.inert = true;
  let history = sget("ugos_chat", []); let aiState = sget("ugos_ai_state", {}); let busy = false; let chatOpener = null; let rendered = false;
  const API = "/api/hermosia";

  function openChat() {
    chatOpener = document.activeElement; chat.inert = false; chat.classList.add("is-open"); document.body.classList.add("chat-open");
    closeMnav(); syncFloating();
    if (!rendered) { renderHistory(); rendered = true; }
    setTimeout(() => input.focus(), 60);
  }
  function closeChat() { chat.classList.remove("is-open"); chat.inert = true; document.body.classList.remove("chat-open"); stopVoice(); syncFloating(); if (chatOpener && chatOpener.focus) chatOpener.focus(); }
  $(".js-chat-x").addEventListener("click", closeChat);

  function starters() {
    const s = ["¿Qué promo hay hoy?", "Quiero una pizza", "¿Qué sucursales están abiertas?", "Opciones sin carne"];
    if (miPedido().length) s.unshift("🍕 Lo de siempre");
    return s.slice(0, 5);
  }
  function renderHistory() {
    log.innerHTML = "";
    addBot("¡Hola! Soy **HermosIA**, la asistente de pedidos de Ugo's 😎 Decime qué se te antoja y te armo el pedido.");
    history.forEach((m) => (m.role === "user" ? addUser(m.content) : addBot(m.content)));
    if (!history.length) addChips(starters());
  }
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  function md(t) {
    let h = esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|\s)\*(?!\s)(.+?)\*(?=\s|$|[.,!?])/g, "$1<b>$2</b>");
    const blocks = h.split(/\n{2,}/).map((p) => {
      const lines = p.split("\n");
      if (lines.every((l) => /^\s*([-•*]|\d+\.)\s+/.test(l))) return "<ul>" + lines.map((l) => "<li>" + l.replace(/^\s*([-•*]|\d+\.)\s+/, "") + "</li>").join("") + "</ul>";
      return "<p>" + lines.join("<br>") + "</p>";
    });
    return blocks.join("");
  }
  function addBot(text) { const d = document.createElement("div"); d.className = "msg msg--bot"; d.innerHTML = md(text); log.appendChild(d); scroll(); return d; }
  function addUser(text) { const d = document.createElement("div"); d.className = "msg msg--user"; d.textContent = text; log.appendChild(d); scroll(); return d; }
  function addChips(opts) {
    $$(".qr", log).forEach((q) => q.remove());
    const d = document.createElement("div"); d.className = "qr";
    d.innerHTML = opts.map((o) => `<button type="button">${esc(o)}</button>`).join("");
    d.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { d.remove(); send(b.textContent, "text"); } });
    log.appendChild(d); scroll();
  }
  function cartCard(c, existing) {
    const el = existing || document.createElement("div"); el.className = "ccard";
    const lines = Object.entries(c).filter(([id]) => C[id]);
    const tot = lines.reduce((s, [id, q]) => s + C[id].price * q, 0);
    el.innerHTML = `<h4>🛒 Tu carrito</h4>${lines.length ? `<ul>${lines.map(([id, q]) => `<li><span>${q}× ${esc(C[id].name)}</span><span>${money(C[id].price * q)}</span></li>`).join("")}</ul><div class="ccard__tot"><span>Total</span><span>${money(tot)}</span></div>` : "<p style='margin:0'>Vacío</p>"}<button type="button">Ver pedido</button>`;
    $("button", el).onclick = openDrawer;
    if (!existing) log.appendChild(el);
    scroll(); return el;
  }
  function receipt(s) {
    const d = document.createElement("div"); d.className = "receipt";
    const svc = { delivery: "Delivery", pickup: "Recojo", mesa: "Comer en sucursal" }[s.service] || s.service;
    d.innerHTML = `<h4>Tu pedido</h4><ul>${s.lines.map((l) => `<li><span>${l.qty}× ${esc(l.name)}</span><span>${money(l.subtotal)}</span></li>`).join("")}</ul>
      <div class="receipt__tot"><span>TOTAL</span><span>${money(s.total)}</span></div>
      <dl><dt>Entrega</dt><dd>${esc(svc)}</dd><dt>Lugar</dt><dd>${esc(s.place || "—")}</dd>${s.address ? `<dt>Dirección</dt><dd>${esc(s.address)}</dd>` : ""}${s.reference ? `<dt>Ref.</dt><dd>${esc(s.reference)}</dd>` : ""}${s.pin ? "<dt>Pin</dt><dd>📍 compartido</dd>" : ""}<dt>Hora</dt><dd>${esc(s.when || "—")}</dd><dt>Nombre</dt><dd>${esc(s.name || "—")}</dd>${s.payment ? `<dt>Pago</dt><dd>${esc(s.payment)}</dd>` : ""}${s.notes ? `<dt>Nota</dt><dd>${esc(s.notes)}</dd>` : ""}</dl>`;
    log.appendChild(d); scroll();
  }
  const safeWa = (u) => typeof u === "string" && u.startsWith("https://wa.me/");
  function waButton(url, label, cls = "btn--whatsapp") {
    if (!safeWa(url)) return;
    const a = document.createElement("a"); a.className = `btn ${cls} chat__btn`; a.href = url; a.target = "_blank"; a.rel = "noopener"; a.innerHTML = icon("wa") + esc(label);
    log.appendChild(a); scroll(); return a;
  }
  function orderCard(ev) {
    if (!safeWa(ev.url)) return;
    const d = document.createElement("div"); d.className = "ordercard";
    d.innerHTML = `<b>Pedido ${esc(ev.id)} listo · ${money(ev.total)}</b>`;
    const a = document.createElement("a"); a.className = "btn btn--whatsapp btn--block"; a.href = ev.url; a.target = "_blank"; a.rel = "noopener"; a.innerHTML = icon("wa") + "Enviar pedido por WhatsApp a " + esc(ev.branch);
    d.appendChild(a); log.appendChild(d); scroll();
  }
  function locationButton() {
    const b = document.createElement("button"); b.type = "button"; b.className = "btn btn--dark chat__btn"; b.innerHTML = icon("pin") + "Compartir mi ubicación";
    b.addEventListener("click", () => {
      if (!navigator.geolocation) { addBot("Tu navegador no comparte ubicación. Escribime la dirección y una referencia, porfa."); return; }
      b.disabled = true; b.textContent = "Buscando tu ubicación…";
      navigator.geolocation.getCurrentPosition((p) => {
        aiState = aiState || {}; aiState.order = aiState.order || {};
        aiState.order.location = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) };
        sset("ugos_ai_state", aiState); b.remove(); send("📍 Ubicación compartida", "text");
      }, () => { b.disabled = false; b.innerHTML = icon("pin") + "Compartir mi ubicación"; addBot("No pude obtener tu ubicación. Escribime la dirección con una referencia y listo."); }, { enableHighAccuracy: true, timeout: 12000 });
    });
    log.appendChild(b); scroll();
  }
  function errorMsg(kind) {
    const tail = ` <a href="#menu">Ver el menú</a> · <a href="#pedido">Pedir por WhatsApp</a>`;
    const t = { setup: "HermosIA se está preparando 🛠️ Muy pronto vas a poder pedir conmigo.", rate: "Muchas preguntas seguidas 😅 Esperá un minuto y seguimos.", net: "Se cortó la conexión. Probá de nuevo en un ratito.", other: "Uy, algo falló de mi lado. Probá otra vez." }[kind];
    const d = document.createElement("div"); d.className = "msg msg--bot msg--err"; d.innerHTML = `<p>${esc(t)}${tail}</p>`;
    d.addEventListener("click", (e) => { const a = e.target.closest("a"); if (a) closeChat(); });
    log.appendChild(d); scroll();
  }

  async function send(text, channel) {
    text = String(text || "").trim(); if (!text || busy) return;
    busy = true; addUser(text); input.value = "";
    history.push({ role: "user", content: text.slice(0, 1200) }); history = history.slice(-20);
    const typing = document.createElement("div"); typing.className = "msg msg--bot"; typing.innerHTML = '<span class="typing" aria-label="HermosIA está escribiendo"><i></i><i></i><i></i></span>'; log.appendChild(typing); scroll();
    setVoice(channel === "voice" ? "thinking" : voiceState);
    const state = { ...(aiState || {}), cart: { ...cart }, history: miPedido() };
    let bubble = null, full = "", lastCartCard = null, ok = false, errKind = null;
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" }, body: JSON.stringify({ messages: history.slice(-16), state, channel }) });
      if (!res.ok) { errKind = [503, 404, 501, 405].includes(res.status) ? "setup" : res.status === 429 ? "rate" : "other"; throw new Error("http"); }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (!line) continue;
          let ev; try { ev = JSON.parse(line); } catch (e) { continue; }
          if (typing.parentNode) typing.remove();
          switch (ev.type) {
            case "text": if (!bubble) { bubble = document.createElement("div"); bubble.className = "msg msg--bot"; log.appendChild(bubble); } full += ev.text; bubble.innerHTML = md(full); scroll(); break;
            case "cart": setCart(ev.cart); lastCartCard = cartCard(ev.cart, lastCartCard); bubble = null; full && (full += "\n\n"); break;
            case "options": addChips((ev.options || []).slice(0, 4)); break;
            case "readback": receipt(ev.summary || {}); break;
            case "location": locationButton(); break;
            case "order": orderCard(ev); if (ev.entry) saveMiPedido(ev.entry); setCart({}, { silent: true }); break;
            case "handoff": waButton(ev.url, "Hablar con una persona · " + (ev.to || "Ugo's")); break;
            case "state": aiState = ev.state || {}; sset("ugos_ai_state", aiState); ok = true; break;
            case "error": errKind = ev.kind === "rate_limited" ? "rate" : ev.kind === "not_configured" ? "setup" : "other"; break;
          }
        }
      }
      if (!ok && !errKind) errKind = "net";
    } catch (e) { if (!errKind) errKind = "net"; }
    if (typing.parentNode) typing.remove();
    $$(".qr", log).forEach((q) => log.appendChild(q)); // quick replies always sit under the reply
    scroll();
    if (errKind && !full) { history.pop(); errorMsg(errKind); }
    else if (full) history.push({ role: "assistant", content: full.trim().slice(0, 1200) });
    history = history.slice(-20); sset("ugos_chat", history);
    busy = false;
    if (channel === "voice" && full) speak(full); else setVoice("idle");
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value, "text"); });

  /* ---------------- voice (Web Speech API) ---------------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, voiceState = "idle", wake = null, idleT = null, finalText = "";
  const label = { idle: "Tocá el micrófono y hablá", listening: "Escuchando…", thinking: "Pensando…", speaking: "Hablando… tocá para interrumpir" };
  function setVoice(s) { voiceState = s; micBtn.dataset.state = s; vst.textContent = label[s] || label.idle; micBtn.setAttribute("aria-label", s === "listening" ? "Dejar de escuchar" : s === "speaking" ? "Interrumpir" : "Hablar con HermosIA"); if (s !== "idle") keepAwake(); else releaseLater(); }
  async function keepAwake() { clearTimeout(idleT); try { if ("wakeLock" in navigator && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => (wake = null)); } } catch (e) { wake = null; } }
  function releaseLater() { clearTimeout(idleT); idleT = setTimeout(() => { if (wake) { wake.release().catch(() => {}); wake = null; } }, 60000); }
  if (SR) {
    micBtn.hidden = false; vbar.hidden = false;
    micBtn.addEventListener("click", () => {
      if (voiceState === "speaking") { speechSynthesis.cancel(); listen(); return; }
      if (voiceState === "listening") { try { rec.stop(); } catch (e) { /* noop */ } return; }
      if (voiceState === "thinking") return;
      listen();
    });
  }
  function listen() {
    if (!SR || busy) return;
    if (window.speechSynthesis) speechSynthesis.cancel(); // barge-in
    rec = new SR(); rec.lang = U.config.locale || "es-BO"; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    finalText = "";
    rec.onresult = (e) => { let interim = ""; for (let k = e.resultIndex; k < e.results.length; k++) { const r = e.results[k]; if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; } input.value = (finalText + interim).trim(); };
    rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { addBot("No tengo permiso para usar el micrófono. Podés escribirme igual 😉"); handsfree.checked = false; } else if (e.error === "language-not-supported" && rec.lang !== "es-419") { rec.lang = "es-419"; } setVoice("idle"); };
    rec.onend = () => { const t = (finalText || input.value).trim(); if (voiceState === "listening") { if (t) send(t, "voice"); else setVoice("idle"); } };
    try { rec.start(); setVoice("listening"); } catch (e) { setVoice("idle"); }
  }
  function stopVoice() { try { if (rec) rec.abort(); } catch (e) { /* noop */ } if (window.speechSynthesis) speechSynthesis.cancel(); setVoice("idle"); }
  function pickVoice() {
    const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    return ["es-BO", "es-419", "es-US", "es-MX", "es-AR", "es"].reduce((f, l) => f || vs.find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(l.toLowerCase())), null);
  }
  function cleanSpeech(t) {
    return t.replace(/https?:\/\/\S+/g, "").replace(/\*\*|__|[*_`#>]/g, "").replace(/Bs\.?\s?(\d+)/g, "$1 bolivianos").replace(/(\d+)\s?×/g, "$1 ")
      .replace(/\b(\d{1,2}):00\b/g, "$1 en punto").replace(/\p{Extended_Pictographic}|️/gu, "").replace(/\s{2,}/g, " ").trim();
  }
  function speak(text) {
    if (!window.speechSynthesis) { setVoice("idle"); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleanSpeech(text)); const v = pickVoice(); if (v) u.voice = v; u.lang = v ? v.lang : "es-419"; u.rate = 1.05;
    u.onend = () => { setVoice("idle"); if (handsfree.checked && chat.classList.contains("is-open")) setTimeout(listen, 250); };
    u.onerror = () => setVoice("idle");
    setVoice("speaking"); speechSynthesis.speak(u);
  }
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};

  /* ---------------- boot ---------------- */
  renderCart(); refreshStatus(); setIntent("pickup"); F.intent = null; $$(".intent", fform).forEach((b) => b.setAttribute("aria-pressed", "false")); updateBubble();
  setInterval(refreshStatus, 60000);
  if (location.hash === "#chat") openChat();
})();
