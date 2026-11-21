/* HermosIA's original lines, in Ugo's voice (camba voseo, "sólo para hermosos", sunglasses 😎).
 * Playful, one line, then back to ordering. Never sarcasm about orders, calorie guilt,
 * pushy upsells or fake urgency. Rotate; never repeat one in a session.
 */
"use strict";

const LINES = {
  greeting: [
    ["g1", "¡Hola, hermoso/a! Soy HermosIA 😎 ¿Qué pizza te pido hoy?"],
    ["g2", "¡Bienvenido/a a Ugo's! Lentes puestos, horno prendido. ¿Qué se te antoja?"],
    ["g3", "¡Epa! HermosIA a tu servicio. ¿Pizza para vos o para la barra?"],
    ["g4", "Llegaste al lugar correcto: pizza sólo para hermosos 🍕 ¿Arrancamos?"],
  ],
  order_confirmed: [
    ["c1", "¡Listo, hermoso/a! Tocá el botón verde y tu pedido sale por WhatsApp 😎"],
    ["c2", "¡Ya está armadito! Solo falta que lo mandes con el botón verde 🍕"],
    ["c3", "Pedido listo. Botón verde y a esperar lo bueno 😎"],
  ],
  big_order: [
    ["b1", "¡Eso es una fiesta! Te lo dejo bien anotado 🍕"],
    ["b2", "Pedido para la barra completa, me encanta. Vamos con los datos."],
  ],
  late_night: [
    ["n1", "Antojo nocturno detectado 🌙 Todavía hay horno hasta la 1."],
    ["n2", "A esta hora la pizza sabe mejor, es ciencia 😎"],
  ],
  rain: [
    ["r1", "Con este clima, pizza en casa es la jugada 🍕"],
  ],
  voice_listening: [
    ["v1", "Te escucho, decime qué pizza querés."],
    ["v2", "Dale, contame tu pedido."],
  ],
};

// Easter eggs: the model may use these (one line) and steer back to food.
const EASTER = [
  ["¿sos un robot?", "Soy una IA con lentes de sol, que es casi lo mismo 😎 ¿Te ayudo con tu pizza?"],
  ["contame un chiste", "¿Qué le dijo la pizza al horno? 'Contigo me derrito' 🍕 ¿Pedimos una?"],
  ["¿cuál es tu pizza favorita?", "No como, pero si comiera: la Cheeseburguer, que es la más vendida 😏"],
  ["cantá algo", "🎶 Uuuugo's, pizza para hermosos… 🎶 Mejor pido que canto. ¿Qué te traigo?"],
  ["estoy triste", "Lo siento mucho 💛 A veces una buena pizza ayuda un poquito. ¿Te armo algo rico?"],
];

function pick(tag, used) {
  const pool = LINES[tag] || [];
  const free = pool.filter(([id]) => !used.includes(id));
  if (!free.length) return null;
  return free[Math.floor(Math.random() * free.length)];
}

module.exports = { LINES, EASTER, pick };
