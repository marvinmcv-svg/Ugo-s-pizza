/* Ugo's Pizza — all site + assistant content.
 * Shared by the browser (window.UGOS) and the assistant's tools (module.exports).
 * Every fact has its source next to it. Nothing here is invented: if it isn't
 * public, it's not here (see README "Needs owner input").
 *
 * Sources used:
 *   [WEB-MENU]  https://ugospizzas.com/menu/            (names, ingredients, prices)
 *   [WEB-HOME]  https://ugospizzas.com/                 ("Nuestras promos" combo graphics, WhatsApp)
 *   [WEB-UBIC]  https://ugospizzas.com/ubicaciones/     (branches, addresses, hours, maps, WhatsApp)
 *   [WEB-FRAN]  https://ugospizzas.com/franquicias/     (story copy, franchise/jobs form)
 *   [IG-BIO]    https://www.instagram.com/ugos_pizza/   (bio: "sólo para hermosos", +20 sabores)
 *   [IG-*]      individual posts, URL given inline
 */
(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.UGOS = data;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const UGOS = {
    brand: "Ugo's Pizza",
    slogan: "Sólo para hermosos", // [IG-BIO] "Ugo's Pizza sólo para hermosos🍕😎"
    city: "Santa Cruz de la Sierra", // [WEB-UBIC] anillos / Plan 3000 / La Guardia; [WEB-HOME] "la ciudad de los anillos"
    cityNick: "la ciudad de los anillos", // [WEB-HOME] graphic "El mejor sabor en LA CIUDAD DE LOS ANILLOS"
    country: "Bolivia",

    config: {
      callCenter: "59160007071", // [WEB-HOME] wa.me/59160007071 ; [IG] captions "Haz tu pedido al WhatsApp http://wa.me/59160007071"
      scoobyneta: "59176066200", // [IG] https://www.instagram.com/p/Df98OMcuhXH/ "Whatsapp Scoobyneta: 760 66200"
      instagram: "https://www.instagram.com/ugos_pizza/",
      facebook: "https://www.facebook.com/PizzaUgos", // [WEB-HOME] footer
      tiktok: "https://www.tiktok.com/@ugospizza", // [WEB-HOME] footer
      website: "https://ugospizzas.com/",
      franchise: "https://ugospizzas.com/franquicias/", // [WEB-HOME] "¿Querés tu propia sucursal? / ¿Querés trabajar con nosotros? CONTÁCTANOS"
      timezone: "America/La_Paz",
      locale: "es-BO",
      currency: "Bs", // [WEB-MENU] "47,00Bs." ; captions "35 Bs."
    },

    // [WEB-MENU] every pizza starts "Masa madre, salsa de tomate a la leña, ... mozzarella"
    base: "masa madre, salsa de tomate a la leña y mozzarella",
    // [WEB-HOME] banner "El sabor único de Ugo's: Masa madre · Urucú · Salsa preparada a leña"
    signature: ["Masa madre", "Urucú", "Salsa preparada a leña"],

    // Sizes: the menu lists ONE price per pizza and no size/cm. Only the combo
    // graphics say "8 porciones · tamaño familiar" [WEB-HOME]. Not asserted for the menu.
    sizes: {},

    // [WEB-MENU] https://ugospizzas.com/menu/ — 18 pizzas, exact text and prices.
    // veg = sin carne (has no meat/fish in the published ingredients).
    menu: [
      {
        id: "pizzas", name: "Pizzas", size: null,
        items: [
          { id: "ugos", name: "Ugo's", price: 65, desc: "Masa madre, salsa de tomate a la leña, mozzarella, jamón, borde de salchichas, volcán de crema de queso cheddar y orégano.", img: "assets/img/pizza-ugos.webp", house: true },
          { id: "jamoneitor", name: "Jamoneitor", price: 47, desc: "Masa madre, salsa de tomate a la leña, mozzarella y jamón.", img: "assets/img/pizza-jamoneitor.webp" },
          { id: "napolitana", name: "Napolitana", price: 44, desc: "Masa madre, salsa de tomate a la leña, tomate, mozzarella y orégano.", img: "assets/img/pizza-napolitana.webp", veg: true },
          { id: "margarita", name: "Margarita", price: 44, desc: "Masa madre, salsa de tomate a la leña, tomate, mozzarella y albahaca fresca.", img: "assets/img/pizza-margarita.webp", veg: true },
          { id: "salchichona", name: "Salchichona", price: 47, desc: "Masa madre, salsa de tomate a la leña, mozzarella y salchicha picada.", img: "assets/img/pizza-salchichona.webp" },
          { id: "chocluda", name: "Chocluda", price: 49, desc: "Masa madre, salsa de tomate a la leña, mozzarella y choclo.", img: "assets/img/pizza-chocluda.webp", veg: true },
          { id: "brocoli-bacon", name: "Brócoli Bacon", price: 48, desc: "Masa madre, salsa de tomate a la leña, mozzarella, tocino, brócoli, orégano y queso catupiry.", img: "assets/img/pizza-brocoli-bacon.webp" },
          { id: "bruto-tocino", name: "Bruto Tocino", price: 52, desc: "Masa madre, salsa de tomate a la leña, mozzarella, tocino, queso cheddar y orégano.", img: "assets/img/pizza-bruto-tocino.webp" },
          { id: "salame", name: "Salame", price: 52, desc: "Masa madre, salsa de tomate a la leña, mozzarella, salame y orégano.", img: "assets/img/pizza-salame.webp" },
          { id: "americana", name: "Americana", price: 52, desc: "Masa madre, salsa de tomate a la leña, mozzarella, jamón, choclo y orégano.", img: "assets/img/pizza-americana.webp" },
          { id: "champinon", name: "Champiñón", price: 58, desc: "Masa madre, salsa de tomate a la leña, mozzarella, champiñones y jamón.", img: "assets/img/pizza-champinon.webp" },
          { id: "hawaiana", name: "Hawaiana", price: 54, desc: "Masa madre, salsa de tomate a la leña, mozzarella, piña, jamón y orégano.", img: "assets/img/pizza-hawaiana.webp" },
          // "la pizza más vendida de Ugo's: LA CHEESEBURGUER" — https://www.instagram.com/p/Df98OMcuhXH/
          { id: "cheeseburguer", name: "Cheeseburguer", price: 58, desc: "Masa madre, salsa de tomate a la leña, mozzarella, carne molida, tocino, queso cheddar y orégano.", img: "assets/img/pizza-cheeseburguer.webp", star: true },
          { id: "pollo-requeson", name: "Pollo Requesón", price: 58, desc: "Masa madre, salsa de tomate a la leña, mozzarella, pollo desmechado, queso catupiry y orégano.", img: "assets/img/pizza-pollo-requeson.webp" },
          { id: "strogonoff-carne", name: "Strogonoff de Carne", price: 58, desc: "Masa madre, salsa de tomate a la leña, mozzarella, carne, crema de leche, papa frita rayada y orégano.", img: "assets/img/pizza-strogonoff-carne.webp" },
          { id: "strogonoff-pollo", name: "Strogonoff de Pollo", price: 58, desc: "Masa madre, salsa de tomate a la leña, mozzarella, pollo, crema de leche, papa frita rayada y orégano.", img: "assets/img/pizza-strogonoff-pollo.webp" },
          { id: "mexicana", name: "Mexicana", price: 60, desc: "Masa madre, salsa de tomate a la leña, mozzarella, queso cheddar, jamón, nachos, jalapeños y orégano.", img: "assets/img/pizza-mexicana.webp" },
          { id: "4-quesos", name: "4 Quesos", price: 60, desc: "Masa madre, salsa de tomate a la leña, mozzarella, queso cheddar, queso roquefort y queso catupiry.", img: "assets/img/pizza-4-quesos.webp", veg: true },
        ],
      },
    ],

    // No extras, sauces, crusts or standalone drink prices are published.
    addons: {},

    // No weekly day promos found in posts or on the website.
    weekly: [],

    // [WEB-HOME] "NUESTRAS PROMOS" graphics (uploads/2026/08/Promo-*.webp). Each reads
    // "<pizza> + <drink>", "8 PORCIONES · TAMAÑO FAMILIAR" and the price badge.
    // The drinks are only sold inside these combos (no standalone price published).
    combos: [
      { id: "combo-2-salchichonas", name: "2 Salchichonas + Pepsi 2 L", price: 100, img: "assets/img/combo-2-salchichonas.webp", post: "assets/img/promo-2-salchichonas.webp", note: "2 pizzas Salchichona tamaño familiar (8 porciones c/u) + Pepsi 2 L", parts: ["salchichona", "salchichona"], drink: "Pepsi 2 L", star: true, tag: "Para compartir" },
      { id: "combo-2-jamoneitor", name: "2 Jamoneitor + Pepsi 2 L", price: 100, img: "assets/img/combo-2-jamoneitor.webp", post: "assets/img/promo-2-jamoneitor.webp", note: "2 pizzas Jamoneitor tamaño familiar (8 porciones c/u) + Pepsi 2 L", parts: ["jamoneitor", "jamoneitor"], drink: "Pepsi 2 L", tag: "Para compartir" },
      { id: "combo-bruto-tocino", name: "Bruto Tocino + Pepsi 2 L", price: 65, img: "assets/img/combo-bruto-tocino.webp", post: "assets/img/promo-bruto-tocino.webp", note: "Pizza Bruto Tocino tamaño familiar (8 porciones) + Pepsi 2 L", parts: ["bruto-tocino"], drink: "Pepsi 2 L" },
      { id: "combo-strogonoff-pollo", name: "Strogonoff de Pollo + Pepsi 1 L", price: 66, img: "assets/img/combo-strogonoff-pollo.webp", post: "assets/img/promo-strogonoff-pollo.webp", note: "Pizza Strogonoff de Pollo tamaño familiar (8 porciones) + Pepsi 1 L", parts: ["strogonoff-pollo"], drink: "Pepsi 1 L" },
      { id: "combo-jamoneitor", name: "Jamoneitor + Pepsi 2 L", price: 60, img: "assets/img/combo-jamoneitor.webp", post: "assets/img/promo-jamoneitor.webp", note: "Pizza Jamoneitor tamaño familiar (8 porciones) + Pepsi 2 L", parts: ["jamoneitor"], drink: "Pepsi 2 L", tag: "Favorito" },
      { id: "combo-salchichona", name: "Salchichona + Pepsi 2 L", price: 60, img: "assets/img/combo-salchichona.webp", post: "assets/img/promo-salchichona.webp", note: "Pizza Salchichona tamaño familiar (8 porciones) + Pepsi 2 L", parts: ["salchichona"], drink: "Pepsi 2 L" },
      { id: "combo-chocluda", name: "Chocluda + Guaraná 2 L", price: 60, img: "assets/img/combo-chocluda.webp", post: "assets/img/promo-chocluda.webp", note: "Pizza Chocluda tamaño familiar (8 porciones) + Guaraná 2 L", parts: ["chocluda"], drink: "Guaraná 2 L" },
      { id: "combo-americana", name: "Americana + Pepsi 1 L", price: 62, img: "assets/img/combo-americana.webp", post: "assets/img/promo-americana.webp", note: "Pizza Americana tamaño familiar (8 porciones) + Pepsi 1 L", parts: ["americana"], drink: "Pepsi 1 L" },
      { id: "combo-salame", name: "Salame + Pepsi 1 L", price: 62, img: "assets/img/combo-salame.webp", post: "assets/img/promo-salame.webp", note: "Pizza Salame tamaño familiar (8 porciones) + Pepsi 1 L", parts: ["salame"], drink: "Pepsi 1 L" },
    ],

    // Promo of the month: "Jamoneitor a 35 Bs por La Scoobyneta".
    // https://www.instagram.com/p/DfapG5MludI/ "Si hacés tu pedido por La Scoobyneta, podés llevarte una
    //   Jamoneitor a solo 35 Bs! Aplica para las primeras 100 pizzas del día pedidas por la Scoobyneta.
    //   Válido todos los días de Noviembre. Llamá al 76066200"
    // https://www.instagram.com/p/DfphlqNuh8Y/ "en vez de pagar 47Bs. te la llevas a 35 Bs."
    yapa: {
      id: "jamoneitor-scoobyneta", name: "Jamoneitor por La Scoobyneta", short: "Jamoneitor a Bs 35",
      price: 35, regular: 47, ref: "jamoneitor",
      from: "2026-11-01", until: "2026-11-30",
      channel: "59176066200",
      conditions: "Solo pidiendo por el delivery La Scoobyneta (WhatsApp 76066200). Aplica a las primeras 100 pizzas del día. Todos los días de noviembre.",
      img: "assets/img/pizza-jamoneitor.webp", video: "assets/video/jamoneitor-35",
      url: "https://www.instagram.com/p/DfapG5MludI/",
    },

    // [WEB-HOME] "Nuestras promos" graphics, all currently on the homepage.
    offers: [
      { img: "assets/img/promo-2-salchichonas.webp", href: "https://ugospizzas.com/", alt: "Promo 2 Salchichonas + Pepsi 2 L a Bs 100" },
      { img: "assets/img/promo-2-jamoneitor.webp", href: "https://ugospizzas.com/", alt: "Promo 2 Jamoneitor + Pepsi 2 L a Bs 100" },
      { img: "assets/img/promo-bruto-tocino.webp", href: "https://ugospizzas.com/", alt: "Promo Bruto Tocino + Pepsi 2 L a Bs 65" },
      { img: "assets/img/promo-strogonoff-pollo.webp", href: "https://ugospizzas.com/", alt: "Promo Strogonoff de Pollo + Pepsi 1 L a Bs 66" },
      { img: "assets/img/promo-jamoneitor.webp", href: "https://ugospizzas.com/", alt: "Promo Jamoneitor + Pepsi 2 L a Bs 60" },
      { img: "assets/img/promo-salchichona.webp", href: "https://ugospizzas.com/", alt: "Promo Salchichona + Pepsi 2 L a Bs 60" },
      { img: "assets/img/promo-chocluda.webp", href: "https://ugospizzas.com/", alt: "Promo Chocluda + Guaraná 2 L a Bs 60" },
      { img: "assets/img/promo-americana.webp", href: "https://ugospizzas.com/", alt: "Promo Americana + Pepsi 1 L a Bs 62" },
      { img: "assets/img/promo-salame.webp", href: "https://ugospizzas.com/", alt: "Promo Salame + Pepsi 1 L a Bs 62" },
    ],

    featured: [
      { ref: "ugos", name: "Ugo's", tag: "La de la casa", img: "assets/img/pizza-ugos.webp", desc: "Borde de salchichas y un volcán de crema de queso cheddar al centro." }, // [WEB-MENU]
      { ref: "cheeseburguer", name: "Cheeseburguer", tag: "La más vendida", img: "assets/video/cheeseburguer.webp", video: "assets/video/cheeseburguer", desc: "Carne molida, tocino y queso cheddar. La más pedida de Ugo's." }, // https://www.instagram.com/p/Df98OMcuhXH/
      { ref: "strogonoff-carne", name: "Strogonoff de Carne", tag: "Con papa rayada", img: "assets/img/pizza-strogonoff-carne.webp", desc: "Carne, crema de leche y papa frita rayada encima." }, // [WEB-MENU]
    ],

    // [WEB-UBIC] https://ugospizzas.com/ubicaciones/ — every branch lists:
    //   "Lunes a Domingo: 12:00 am a 01:00 am. Martes: 17:00 pm a 01:00 am."
    // Read as 12:00 (mediodía) → 01:00 (madrugada), martes desde las 17:00. Confirm with the owner.
    // WhatsApp numbers match the branch list in IG captions, e.g. https://www.instagram.com/p/DfC0seNoVa7/
    branches: [
      { id: "radial-27", name: "Radial 27", address: "Radial 27, 5to anillo (norte)", maps: "https://www.google.com/maps?q=-17.7375495,-63.1727192", whatsapp: "59176066200", hours: { default: ["12:00", "01:00"], 2: ["17:00", "01:00"] }, note: "También es el WhatsApp de La Scoobyneta" },
      { id: "paragua", name: "Paraguá", address: "Av. Cristóbal de Mendoza", maps: "https://maps.app.goo.gl/NBsJEpTYfNiuyuHTA", whatsapp: "59175662162", hours: { default: ["12:00", "01:00"], 2: ["17:00", "01:00"] } },
      { id: "pirai", name: "Piraí", address: "Av. Piraí entre 2do y 3er anillo", maps: "https://maps.app.goo.gl/njMqbGRan6p5CRtX9", whatsapp: "59176046564", hours: { default: ["12:00", "01:00"], 2: ["17:00", "01:00"] } },
      { id: "santos-dumont", name: "Santos Dumont", address: "Av. Santos Dumont", maps: "https://maps.app.goo.gl/3o5t7nV6rM9swMi7A", whatsapp: "59176666551", hours: { default: ["12:00", "01:00"], 2: ["17:00", "01:00"] } },
      { id: "mechero", name: "Mechero", address: "Av. Plan 3000, calle Petrolera, al frente de la plaza El Mechero", maps: "https://maps.app.goo.gl/5whL5aBuwByRoJev5", whatsapp: "59177030613", hours: { default: ["12:00", "01:00"], 2: ["17:00", "01:00"] } },
      { id: "plan-3000", name: "Plan 3000", address: "Av. Paurito", maps: "https://maps.app.goo.gl/dWEtYf3qRhhrzcNe9", whatsapp: "59175657123", hours: { default: ["12:00", "01:00"], 2: ["17:00", "01:00"] } },
      { id: "villa", name: "Villa 1ro de Mayo", address: "Plaza principal, esquina calle 3", maps: "https://maps.app.goo.gl/7z43GE5gmibF4xeHA", whatsapp: "59176000301", hours: { default: ["12:00", "01:00"], 2: ["17:00", "01:00"] } },
      { id: "km-6", name: "Doble Vía Km 6", address: "Av. Doble Vía La Guardia, entre 6to y 7mo anillo", maps: "https://maps.app.goo.gl/YvFhfirK4VkvWNwX8", whatsapp: "59169339933", hours: { default: ["12:00", "01:00"], 2: ["17:00", "01:00"] } },
      { id: "lujan", name: "Luján", address: "Av. Virgen de Luján", maps: "https://www.google.com/maps?q=-17.7440395,-63.1166574", whatsapp: "59175150007", hours: { default: ["12:00", "01:00"], 2: ["17:00", "01:00"] } },
    ],

    delivery: {
      name: "La Scoobyneta", // https://www.instagram.com/p/DfapG5MludI/ "LLEGÓ LA SCOOBYNETA! El delivery de Ugo's llegó a la ciudad"
      whatsapp: "59176066200",
      url: "https://www.instagram.com/p/DfapG5MludI/",
    },

    // Plain sentences for the assistant. Only published facts.
    facts: [
      "Ugo's Pizza es una cadena de restaurantes 100% boliviana de Santa Cruz de la Sierra.",
      "El lema es 'Sólo para hermosos' y hay más de 20 sabores para elegir.",
      "Todas las pizzas llevan masa madre, salsa de tomate a la leña y mozzarella; el sabor único de Ugo's es masa madre, urucú y salsa preparada a leña.",
      "La Cheeseburguer es la pizza más vendida de Ugo's.",
      "El delivery propio se llama La Scoobyneta y se pide al WhatsApp 76066200.",
      "Pedidos generales por WhatsApp al 60007071.",
      "Los combos de pizza + gaseosa son de tamaño familiar, 8 porciones.",
      "Las gaseosas solo se publican dentro de los combos; no hay precio suelto publicado.",
      "La Caja Transformer: se divide por las líneas segmentadas y salen cuatro platos; doblándola queda una mini caja para llevar.",
      "Ugo's está preparando una nueva pizza 'combinación carnívora' que todavía no salió (no se puede pedir aún).",
      "Para franquicias o trabajar en Ugo's se completa el formulario en ugospizzas.com/franquicias.",
      "No hay información publicada de alérgenos, costo de delivery ni métodos de pago: hay que consultar a la sucursal.",
    ],

    story: {
      // [WEB-FRAN]
      lede: "Cadena de restaurantes 100% boliviana.",
      p1: "Somos una empresa totalmente comprometida con nuestra herencia culinaria, ofreciendo calidad y tradición en cada pizza que servimos.",
      // [WEB-HOME] banners
      p2: "Masa madre, urucú y salsa preparada a la leña: ese es el sabor único de Ugo's. Y llega en la Caja Transformer, que se convierte en cuatro platos.",
      timeline: [
        { k: "Masa madre", v: "La base de cada una de nuestras +20 pizzas." },
        { k: "Salsa a la leña", v: "Salsa de tomate preparada a leña, con urucú." },
        { k: "Caja Transformer", v: "Dividila por las líneas: cuatro platos. Doblala: mini caja para llevar." },
      ],
      video: "assets/video/sucursal",
    },

    reels: [
      { src: "assets/video/cheeseburguer", caption: "La más vendida: la Cheeseburguer 😋", url: "https://www.instagram.com/p/Df98OMcuhXH/" },
      { src: "assets/video/jamoneitor-35", caption: "¡Jamoneitor a 35 Bs por la Scoobyneta!", url: "https://www.instagram.com/p/DfphlqNuh8Y/" },
      { src: "assets/video/scoobyneta-noche", caption: "Tu Jamoneitor a 35 Bs 😛", url: "https://www.instagram.com/p/DfkrFlzoHYR/" },
      { src: "assets/video/kit-emergencia", caption: "Que no te sorprenda el apagón 🚨", url: "https://www.instagram.com/p/Dfx1wxHlvJm/" },
      { src: "assets/video/pizza-en-caja", caption: "Tu kit de supervivencia 🔥", url: "https://www.instagram.com/p/Df0DxInuIvG/" },
      { src: "assets/video/suegra", caption: "¿Querés conquistar a tu suegra? 👑", url: "https://www.instagram.com/p/DfC0seNoVa7/" },
      { src: "assets/video/mesero", caption: "Más hambre que paciencia 💀", url: "https://www.instagram.com/p/DfGUcISixbH/" },
    ],

    feed: [
      { img: "assets/img/feed-Df98OMcuhXH.webp", url: "https://www.instagram.com/p/Df98OMcuhXH/", alt: "Sólo para hermosos: la Scoobyneta de Ugo's" },
      { img: "assets/img/feed-DfphlqNuh8Y.webp", url: "https://www.instagram.com/p/DfphlqNuh8Y/", alt: "Jamoneitor a 35 Bs en su caja" },
      { img: "assets/img/feed-DfkrFlzoHYR.webp", url: "https://www.instagram.com/p/DfkrFlzoHYR/", alt: "Pedido nocturno por la Scoobyneta" },
      { img: "assets/img/feed-Dfx1wxHlvJm.webp", url: "https://www.instagram.com/p/Dfx1wxHlvJm/", alt: "Ugo comiendo pizza en la sucursal" },
      { img: "assets/img/feed-Df0DxInuIvG.webp", url: "https://www.instagram.com/p/Df0DxInuIvG/", alt: "Pizza recién salida en caja Ugo's" },
      { img: "assets/img/feed-DfC0seNoVa7.webp", url: "https://www.instagram.com/p/DfC0seNoVa7/", alt: "Ugo con la Caja Transformer" },
      { img: "assets/img/feed-DfGUcISixbH.webp", url: "https://www.instagram.com/p/DfGUcISixbH/", alt: "Meme del mesero cuando estás muerto de hambre" },
      { img: "assets/img/feed-DfD3mJFqhIf.webp", url: "https://www.instagram.com/p/DfD3mJFqhIf/", alt: "Halloween en Ugo's" },
    ],
  };

  /* ---------- derived helpers (pure, shared by site + tools) ---------- */

  UGOS.catalog = function (date) {
    const out = {};
    for (const cat of UGOS.menu) {
      for (const it of cat.items) {
        out[it.id] = { id: it.id, name: it.name, price: it.price, kind: "pizza", cat: cat.id, size: it.size || cat.size || null, desc: it.desc, veg: !!it.veg, hot: !!it.hot, star: !!it.star, house: !!it.house, img: it.img };
      }
    }
    for (const c of UGOS.combos) {
      out[c.id] = { id: c.id, name: "Combo " + c.name, price: c.price, kind: "combo", cat: "combos", size: "Familiar · 8 porciones", desc: c.note, veg: c.parts.every((p) => out[p] && out[p].veg), hot: !!c.hot, parts: c.parts.slice(), drink: c.drink, img: c.img };
    }
    const y = UGOS.yapa;
    if (y && UGOS.yapaActive(date)) {
      out[y.id] = { id: y.id, name: y.name, price: y.price, regular: y.regular, kind: "promo", cat: "promo", size: null, desc: y.conditions, veg: false, hot: true, ref: y.ref, channel: y.channel, from: y.from, until: y.until, img: y.img };
    }
    return out;
  };

  const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
  UGOS.toMin = toMin;

  // Local wall-clock parts in the shop's timezone.
  UGOS.localParts = function (date) {
    const d = date || new Date();
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: UGOS.config.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
    const p = {};
    for (const x of f.formatToParts(d)) p[x.type] = x.value;
    const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
    return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, dow, ymd: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour}:${p.minute}`, min: +p.hour * 60 + +p.minute };
  };

  UGOS.hoursFor = function (b, dow) {
    const h = b.hours || {};
    return h[dow] || h.default || null;
  };

  // Status of a branch at a local (dow, minute). Handles closing after midnight.
  UGOS.branchStatus = function (b, date) {
    const L = UGOS.localParts(date);
    const today = UGOS.hoursFor(b, L.dow);
    const yest = UGOS.hoursFor(b, (L.dow + 6) % 7);
    const now = L.min;
    // spill-over from yesterday (e.g. open 12:00 → close 01:00)
    if (yest) {
      const o = toMin(yest[0]), c = toMin(yest[1]);
      if (c <= o && now < c) return { open: true, closingSoon: c - now <= 45, closesAt: yest[1], opensAt: null, label: "Abierto" };
    }
    if (today) {
      const o = toMin(today[0]), c = toMin(today[1]);
      const end = c <= o ? 24 * 60 + c : c;
      if (now >= o && now < end) return { open: true, closingSoon: end - now <= 45, closesAt: today[1], opensAt: null, label: "Abierto" };
      if (now < o) return { open: false, closingSoon: false, closesAt: null, opensAt: today[0], when: "today", label: "Abre " + today[0] };
    }
    const tom = UGOS.hoursFor(b, (L.dow + 1) % 7);
    return { open: false, closingSoon: false, closesAt: null, opensAt: tom ? tom[0] : null, when: "tomorrow", label: tom ? "Mañana " + tom[0] : "Cerrado" };
  };

  // Is the branch open at local HH:MM today (or the after-midnight tail)?
  UGOS.openAt = function (b, hhmm, date) {
    const L = UGOS.localParts(date);
    const t = toMin(hhmm);
    const today = UGOS.hoursFor(b, L.dow);
    const yest = UGOS.hoursFor(b, (L.dow + 6) % 7);
    if (yest) { const o = toMin(yest[0]), c = toMin(yest[1]); if (c <= o && t < c) return true; }
    if (today) { const o = toMin(today[0]), c = toMin(today[1]); const end = c <= o ? 24 * 60 + c : c; if (t >= o && t < end) return true; }
    return false;
  };

  UGOS.yapaActive = function (date) {
    const y = UGOS.yapa; if (!y) return false;
    const L = UGOS.localParts(date);
    return L.ymd >= y.from && L.ymd <= y.until;
  };

  UGOS.todayPromo = function (date) {
    const L = UGOS.localParts(date);
    return (UGOS.weekly || []).find((w) => w.day === L.dow) || null;
  };

  UGOS.money = (n) => UGOS.config.currency + " " + (Math.round(n * 100) / 100).toLocaleString("es-BO");

  UGOS.waLink = (digits, text) => "https://wa.me/" + String(digits).replace(/\D/g, "") + "?text=" + encodeURIComponent(text);

  // Same WhatsApp order format for the website funnel and HermosIA.
  // o = { id?, lines:[{name, qty, subtotal}], total, service, place, address, reference, pin, when, name, payment, notes }
  UGOS.orderText = function (o) {
    const svc = { delivery: "Delivery", pickup: "Recojo en sucursal", mesa: "Para comer en la sucursal" }[o.service] || o.service || "";
    const out = ["¡Hola Ugo's! 🍕 Quiero hacer un pedido" + (o.id ? " (" + o.id + ")" : "")];
    out.push("");
    for (const l of o.lines || []) out.push("• " + l.qty + "× " + l.name + " — " + UGOS.money(l.subtotal));
    out.push("*Total: " + UGOS.money(o.total || 0) + "*");
    out.push("");
    if (svc) out.push("Entrega: " + svc + (o.place ? " · " + o.place : ""));
    if (o.address) out.push("Dirección: " + o.address);
    if (o.reference) out.push("Referencia: " + o.reference);
    if (o.pin) out.push("Ubicación: https://www.google.com/maps?q=" + o.pin.lat.toFixed(6) + "," + o.pin.lng.toFixed(6));
    if (o.when) out.push("Hora: " + (o.when === "asap" ? "Lo antes posible" : o.when));
    if (o.name) out.push("Nombre: " + o.name);
    if (o.payment) out.push("Pago: " + o.payment);
    if (o.notes) out.push("Nota: " + o.notes);
    return out.join("\n");
  };

  return UGOS;
});
