/* Ugo's Pizza — AR / 3D menu ("Ver en tu mesa").
 * Tap a pizza photo in the menu → 3D viewer. On a phone, "Ver en tu mesa" opens the camera and puts
 * the pizza on the table at real size (Android: Scene Viewer / WebXR, iPhone: Quick Look; no app).
 * On a computer it shows a QR code that opens the same pizza on the phone.
 * Deep link: /?ver=<id> or /#ver-<id> (e.g. a QR sticker on the restaurant table).
 * Models: assets/ar/<id>.glb (Android / viewer) and <id>.usdz (iPhone Quick Look), built by
 * tools/build-ar-models.py. The viewer library loads only on first open.
 * In-app browsers (WhatsApp, Instagram, Facebook, TikTok…) can't open AR: we explain how to open the
 * page in Chrome/Safari instead of hiding the button.
 */
(function () {
  "use strict";
  const U = window.UGOS;
  const dlg = document.getElementById("arv");
  if (!U || !U.ar || !dlg || typeof dlg.showModal !== "function") return;

  const MV_SRC = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js";
  const QR_SRC = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  const items = U.menu[0].items.filter((it) => it.img);
  const $ = (s) => dlg.querySelector(s);
  const short = (d) => { const t = d.replace(/^Masa madre, salsa de tomate a la leña,\s*/i, ""); return t.charAt(0).toUpperCase() + t.slice(1); };
  const loaded = {};
  function load(src, module) {
    if (!loaded[src]) loaded[src] = new Promise((ok, ko) => { const s = document.createElement("script"); if (module) s.type = "module"; s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
    return loaded[src];
  }

  let mv = null; let cur = -1; let opener = null;
  const arBtn = $(".js-arv-ar"); const addBtn = $(".js-arv-add"); const qrBox = $(".js-arv-qr");
  const hint = $(".js-arv-hint");
  // Phones/tablets only: never offer AR on desktop even if WebXR emulation says yes.
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const mobile = ios || android;
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|TikTok|musical_ly|BytedanceWebview|Snapchat|; wv\)/i.test(ua);
  const help = $(".js-arv-help");

  function build() {
    mv = document.createElement("model-viewer");
    const attrs = {
      "camera-controls": "", "touch-action": "pan-y", "auto-rotate": "", "auto-rotate-delay": "800", "rotation-per-second": "18deg",
      "camera-orbit": "0deg 58deg 112%", "min-camera-orbit": "auto 0deg auto", "max-camera-orbit": "auto 88deg auto",
      "shadow-intensity": "1", "shadow-softness": "0.8", exposure: "1.05", "environment-image": "neutral", "interaction-prompt": "none",
      ar: "", "ar-modes": "scene-viewer webxr quick-look", "ar-scale": "fixed", "ar-placement": "floor", loading: "eager",
    };
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    // We render our own button (below), so hide model-viewer's default one.
    const none = document.createElement("span"); none.slot = "ar-button"; none.hidden = true; mv.appendChild(none);
    mv.addEventListener("load", syncAR);
    mv.addEventListener("error", () => { hint.textContent = "No pudimos cargar el 3D. Probá de nuevo."; });
    mv.addEventListener("ar-status", (e) => { if (e.detail.status === "failed") showHelp("failed"); });
    $(".js-arv-mv").appendChild(mv);
  }

  // On phones the button is always there; if AR can't start here, tapping it explains why.
  function syncAR() {
    arBtn.hidden = !mobile;
    qrBox.hidden = mobile;
    if (!mobile) drawQR();
  }

  function deepLink(id) { return location.origin + location.pathname + "?ver=" + encodeURIComponent(id); }

  function showHelp(kind) {
    const it = items[cur]; const link = deepLink(it.id);
    let html;
    if (inApp && android) {
      const chrome = "intent://" + link.replace(/^https?:\/\//, "") + "#Intent;scheme=https;package=com.android.chrome;end";
      html = `<p><b>Esta app no deja abrir la cámara 3D.</b> Abrí la página en Chrome para ver la pizza en tu mesa.</p><a class="btn btn--mustard" href="${chrome}">Abrir en Chrome</a>`;
    } else if (inApp && ios) {
      html = `<p><b>Esta app no deja abrir la cámara 3D.</b> Tocá <b>•••</b> o el ícono de compartir y elegí <b>“Abrir en Safari”</b>. O copiá el link y pegalo en Safari.</p><button class="btn btn--mustard js-arv-copy" type="button">Copiar link</button>`;
    } else if (android) {
      html = `<p><b>No pudimos abrir la cámara 3D.</b> Tu celular necesita <b>Google Play Services para RA</b> (gratis). Si ya lo tenés, abrí la página en Chrome.</p><a class="btn btn--mustard" href="https://play.google.com/store/apps/details?id=com.google.ar.core" target="_blank" rel="noopener">Instalar desde Play Store</a>`;
    } else if (ios) {
      html = `<p><b>No pudimos abrir la cámara 3D.</b> Abrí la página en <b>Safari</b> (iPhone con iOS 12 o más nuevo).</p><button class="btn btn--mustard js-arv-copy" type="button">Copiar link</button>`;
    } else {
      html = `<p>La realidad aumentada funciona en el celular. Escaneá el código QR.</p>`;
    }
    help.innerHTML = html; help.hidden = false;
    const copy = help.querySelector(".js-arv-copy");
    if (copy) copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(link); copy.textContent = "✓ Link copiado"; }
      catch (e) { window.prompt("Copiá este link:", link); }
    });
    help.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  async function drawQR() {
    const it = items[cur]; const box = $(".js-arv-qrimg");
    try {
      await load(QR_SRC);
      const q = window.qrcode(0, "M"); q.addData(deepLink(it.id)); q.make();
      box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) { qrBox.hidden = true; }
  }

  function show(i) {
    cur = (i + items.length) % items.length;
    const it = items[cur];
    $(".js-arv-name").textContent = it.name;
    $(".js-arv-desc").textContent = `${short(it.desc)} Tamaño real: ${U.ar.diameterCm} cm de diámetro.`;
    $(".js-arv-price").textContent = U.money(it.price);
    addBtn.dataset.add = it.id; addBtn.textContent = "Agregar al pedido";
    hint.textContent = mobile ? "Girala · pellizcá para acercar" : "Arrastrá para girarla · rueda para acercar";
    help.hidden = true;
    if (mv) {
      mv.poster = it.img; mv.alt = `Pizza ${it.name} en 3D`;
      mv.setAttribute("ios-src", U.ar.dir + it.id + ".usdz");
      mv.setAttribute("src", U.ar.dir + it.id + ".glb");
    }
    if (!mobile) drawQR();
  }

  async function open(id, from) {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return;
    opener = from || document.activeElement;
    dlg.showModal();
    document.body.classList.add("arv-open");
    show(i);
    if (!mv) {
      try { await load(MV_SRC, true); await customElements.whenDefined("model-viewer"); build(); show(cur); }
      catch (e) { hint.textContent = "No pudimos cargar el visor 3D. Revisá tu conexión."; }
    }
  }

  dlg.addEventListener("close", () => {
    document.body.classList.remove("arv-open");
    if (/^#ver-/.test(location.hash) || /[?&]ver=/.test(location.search)) history.replaceState(null, "", location.pathname + "#menu");
    if (opener && opener.focus) opener.focus();
  });
  $(".js-arv-x").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // backdrop
  $(".js-arv-prev").addEventListener("click", () => show(cur - 1));
  $(".js-arv-next").addEventListener("click", () => show(cur + 1));
  dlg.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("model-viewer")) return;
    if (e.key === "ArrowRight") show(cur + 1); else if (e.key === "ArrowLeft") show(cur - 1);
  });
  arBtn.addEventListener("click", () => {
    if (inApp || !mv || !mv.canActivateAR) { showHelp("unavailable"); return; }
    mv.activateAR();
  });
  // app.js adds to the cart (delegated [data-add]); the toast sits under the dialog, so confirm here.
  addBtn.addEventListener("click", () => { addBtn.textContent = "✓ Agregada"; setTimeout(() => { addBtn.textContent = "Agregar al pedido"; }, 1600); });

  document.addEventListener("click", (e) => { const b = e.target.closest("[data-ar]"); if (b) { e.preventDefault(); open(b.dataset.ar, b); } });

  function fromLink() {
    const m = /^#ver-([\w-]+)$/.exec(location.hash);
    const id = m ? m[1] : new URLSearchParams(location.search).get("ver");
    if (id && !dlg.open) open(id);
  }
  window.addEventListener("hashchange", fromLink);
  fromLink();
})();
