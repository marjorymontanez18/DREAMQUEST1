/* DREAM QUEST — shop engine (catalog, cart, checkout). Edit CONFIG and PRODUCTS below. */
var CONFIG = {
  phone: '0900 000 0000',            // <- replace with your real number
  email: 'hello@dreamquest.com',     // <- replace; customers' orders can be emailed here
  address: 'Your street, Davao City', // <- replace
  deliveryFee: 500,                  // flat delivery fee (PHP)
  depositRate: 0.2,                  // refundable security deposit (20% of rental subtotal)
  endpoint: ''                       // optional: Formspree/Google Apps Script URL to receive every order online
};
var PRODUCTS = [
  { id: 'monoblock', cat: 'chairs', name: 'Monoblock Chair', price: 15, unit: 'chair', min: 20, stock: 500, img: 'images/monoblock.jpg', desc: 'Durable, stackable, everyday seating for parties, fiestas and family gatherings.' },
  { id: 'tiffany', cat: 'chairs', name: 'Tiffany Chair', price: 45, unit: 'chair', min: 20, stock: 300, img: 'images/tiffany.jpg', desc: 'A timeless, elegant gold chair with a clean silhouette, ideal for weddings, galas and formal receptions.' },
  { id: 'folding', cat: 'chairs', name: 'Folding Chair', price: 25, unit: 'chair', min: 20, stock: 300, img: 'images/folding.jpg', desc: 'Light, practical seating that sets up fast for any gathering.' },
  { id: 'round', cat: 'tables', name: 'Round Table', price: 150, unit: 'table', min: 1, stock: 60, img: 'images/round-table.jpg', desc: 'Seats 8–10 guests comfortably. Perfect for receptions and banquets.' },
  { id: 'rect', cat: 'tables', name: 'Rectangular Table', price: 120, unit: 'table', min: 1, stock: 40, img: 'images/rectangular-table.jpg', desc: 'Ideal for buffets, registration desks and long family seating.' },
  { id: 'cocktail', cat: 'tables', name: 'Cocktail Table', price: 100, unit: 'table', min: 1, stock: 30, img: 'images/cocktail-table.jpg', desc: 'High tables for mingling receptions and standing events.' },
  { id: 'linens', cat: 'acc', name: 'Tablecloths & Chair Covers', price: 30, unit: 'set', min: 10, stock: 200, img: 'images/linens.jpg', desc: 'Linens that finish the look. Available in white, gold, blue and green.' },
  { id: 'pk-bday', cat: 'package', name: 'Birthday Celebration Package', price: 1800, unit: 'package', min: 1, stock: 10, desc: '30 chairs, 4 tables and tablecloths.' },
  { id: 'pk-wed', cat: 'package', name: 'Wedding Reception Package', price: 8500, unit: 'package', min: 1, stock: 5, desc: '100 Tiffany chairs, 10 round tables and linens.' },
  { id: 'pk-corp', cat: 'package', name: 'Corporate Event Package', price: 3600, unit: 'package', min: 1, stock: 8, desc: '60 chairs and 8 rectangular tables.' },
  { id: 'pk-fam', cat: 'package', name: 'Family Gathering Package', price: 2200, unit: 'package', min: 1, stock: 10, desc: '40 monoblock chairs and 5 tables.' }
];
var DQ = (function () {
  var $ = function (s, r) { return (r || document).querySelector(s) };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) };
  var peso = function (n) { return '₱' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 }) };
  var get = function (k, d) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : d } catch (e) { return d } };
  var set = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch (e) { return false } };
  var prod = function (id) { return PRODUCTS.filter(function (p) { return p.id === id })[0] };
  var cart = function () { return get('dqCart', []).filter(function (i) { return prod(i.id) }) };
  var opts = function () { var o = get('dqOpts', {}); return { days: Math.max(1, parseInt(o.days) || 1), service: o.service || 'Delivery' } };
  function badge() { var n = cart().reduce(function (s, i) { return s + i.qty }, 0), c = $('#cc'); if (c) c.textContent = n }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg; document.body.appendChild(t); setTimeout(function () { t.remove() }, 3200) }
  function add(id, qty) {
    var p = prod(id), c = cart(), l = c.filter(function (i) { return i.id === id })[0];
    qty = Math.max(p.min, parseInt(qty) || p.min);
    var q = Math.min(p.stock, (l ? l.qty : 0) + qty);
    if (l) l.qty = q; else c.push({ id: id, qty: q });
    set('dqCart', c); badge(); toast('Added <b>' + esc(p.name) + '</b> to your cart. <a href="cart.html">View cart</a>');
  }
  function totals(items, o) {
    var sub = items.reduce(function (s, i) { return s + prod(i.id).price * i.qty }, 0), rent = sub * o.days;
    var fee = o.service === 'Delivery' ? CONFIG.deliveryFee : 0;
    return { perDay: sub, rent: rent, fee: fee, total: rent + fee, deposit: Math.round(rent * CONFIG.depositRate) };
  }
  function card(p) {
    var img = p.img ? '<div class="ph"><img src="' + p.img + '" alt="' + esc(p.name) + '" loading="lazy"></div>' : '';
    return '<article class="card">' + img + '<h3>' + esc(p.name) + '</h3><p>' + esc(p.desc) + '</p><span class="price">' + peso(p.price) + ' / ' + p.unit + ' / day</span><span class="tag">' + (p.stock > 0 ? 'Available · min. ' + p.min : 'Out of stock') + '</span><div><a class="btn" href="product-details.html?id=' + p.id + '">Details</a> <button class="btn fill" data-add="' + p.id + '">Add to Cart</button></div></article>';
  }
  function init() {
    document.querySelectorAll('[data-cat]').forEach(function (g) { g.innerHTML = PRODUCTS.filter(function (p) { return p.cat === g.dataset.cat }).map(card).join('') });
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-add]'); if (b) add(b.dataset.add, prod(b.dataset.add).min) });
    document.querySelectorAll('[data-cfg]').forEach(function (n) { n.textContent = CONFIG[n.dataset.cfg] });
    badge();
    var pg = document.body.dataset.page; if (pg && DQ['p_' + pg]) DQ['p_' + pg]();
  }
  return { $: $, esc: esc, peso: peso, get: get, set: set, prod: prod, cart: cart, opts: opts, add: add, totals: totals, badge: badge, toast: toast, init: init };
})();

/* ---------- product details ---------- */
DQ.p_product = function () {
  var $ = DQ.$, id = new URLSearchParams(location.search).get('id'), p = DQ.prod(id), box = $('#pd');
  if (!p) { box.innerHTML = '<p>Product not found. <a href="rentals.html">Back to catalog</a></p>'; return }
  document.title = p.name + ' — DREAM QUEST';
  var qs = p.min === 1 ? [1, 2, 5, 10] : [p.min, p.min * 2.5, p.min * 5, p.min * 10];
  box.innerHTML = '<div class="ph" style="aspect-ratio:1">' + (p.img ? '<img src="' + p.img + '" alt="' + DQ.esc(p.name) + '">' : DQ.esc(p.name)) + '</div><div><p class="muted"><a href="rentals.html">&larr; Back to catalog</a></p><h1>' + DQ.esc(p.name) + '</h1><p class="price" style="font-size:1.6rem">' + DQ.peso(p.price) + ' per ' + p.unit + ' per day</p><p class="muted">' + DQ.esc(p.desc) + '</p><h3 style="margin-top:20px">Rental Terms</h3><ul class="muted"><li>Minimum order: ' + p.min + ' ' + p.unit + (p.min > 1 ? 's' : '') + '</li><li>Refundable security deposit (' + Math.round(CONFIG.depositRate * 100) + '% of rental) applies</li><li>Damaged or missing items are charged at replacement cost</li></ul><h3 style="margin-top:20px">Quantity</h3><div class="chips" id="qc">' + qs.map(function (q) { return '<a href="#" data-q="' + q + '">' + q + '</a>' }).join('') + '</div><div class="qrow"><input id="q" type="number" min="' + p.min + '" max="' + p.stock + '" value="' + p.min + '" step="1"><span class="muted">Max ' + p.stock + ' · <b id="est" class="price"></b> per day</span></div><div class="btns" style="justify-content:flex-start"><button class="btn fill" id="add">Add to Cart</button><a class="btn" href="cart.html">View Cart</a></div></div>';
  var q = $('#q'), est = function () { var n = Math.min(p.stock, Math.max(p.min, parseInt(q.value) || p.min)); $('#est').textContent = DQ.peso(n * p.price) }; est();
  q.oninput = est; q.onchange = function () { q.value = Math.min(p.stock, Math.max(p.min, parseInt(q.value) || p.min)); est() };
  $('#qc').onclick = function (e) { var a = e.target.closest('[data-q]'); if (a) { e.preventDefault(); q.value = Math.min(p.stock, a.dataset.q); est() } };
  $('#add').onclick = function () { q.onchange(); DQ.add(p.id, q.value) };
};

/* ---------- cart ---------- */
DQ.p_cart = function () {
  var $ = DQ.$;
  function draw() {
    var c = DQ.cart(), o = DQ.opts();
    if (!c.length) { $('#cartbox').innerHTML = '<div class="empty"><h3>YOUR CART IS EMPTY</h3><p class="muted">Browse our rentals and add items to get started.</p><p><a class="btn fill" href="rentals.html">Browse Rentals</a></p></div>'; return }
    var t = DQ.totals(c, o);
    $('#cartbox').innerHTML = '<div class="tw"><table><thead><tr><th>Item</th><th>Price / day</th><th>Qty</th><th>Line / day</th><th></th></tr></thead><tbody>' + c.map(function (i) { var p = DQ.prod(i.id); return '<tr><td><a href="product-details.html?id=' + p.id + '">' + DQ.esc(p.name) + '</a><br><small class="muted">Min ' + p.min + ' · max ' + p.stock + '</small></td><td>' + DQ.peso(p.price) + '</td><td><input class="qty" type="number" min="' + p.min + '" max="' + p.stock + '" value="' + i.qty + '" data-id="' + p.id + '"></td><td>' + DQ.peso(p.price * i.qty) + '</td><td><button class="btn" data-rm="' + p.id + '">Remove</button></td></tr>' }).join('') + '</tbody></table></div>' +
      '<div class="sum"><form onsubmit="return false"><label>Rental days<input id="days" type="number" min="1" max="30" value="' + o.days + '"></label><label>Delivery option<select id="svc"><option' + (o.service === 'Delivery' ? ' selected' : '') + ' value="Delivery">Delivery (' + DQ.peso(CONFIG.deliveryFee) + ')</option><option' + (o.service === 'Pick-up' ? ' selected' : '') + ' value="Pick-up">Pick-up (free)</option></select></label></form>' +
      '<dl class="dl"><dt>Rental per day</dt><dd>' + DQ.peso(t.perDay) + '</dd><dt>Rental × ' + o.days + ' day(s)</dt><dd>' + DQ.peso(t.rent) + '</dd><dt>' + o.service + ' fee</dt><dd>' + DQ.peso(t.fee) + '</dd><dt><b>Total</b></dt><dd class="price" style="font-size:1.4rem">' + DQ.peso(t.total) + '</dd></dl><p class="muted"><small>Plus refundable security deposit of ' + DQ.peso(t.deposit) + ', returned after the items are collected in good condition.</small></p><div class="btns" style="justify-content:flex-end"><a class="btn" href="rentals.html">Continue Shopping</a><a class="btn fill" href="checkout.html">Proceed to Checkout</a></div></div>';
  }
  document.addEventListener('change', function (e) {
    var t = e.target, c = DQ.cart();
    if (t.classList.contains('qty')) { var p = DQ.prod(t.dataset.id); c.forEach(function (i) { if (i.id === p.id) i.qty = Math.min(p.stock, Math.max(p.min, parseInt(t.value) || p.min)) }); DQ.set('dqCart', c) }
    else if (t.id === 'days' || t.id === 'svc') { DQ.set('dqOpts', { days: Math.min(30, Math.max(1, parseInt($('#days').value) || 1)), service: $('#svc').value }) } else return;
    draw(); DQ.badge();
  });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (b) { DQ.set('dqCart', DQ.cart().filter(function (i) { return i.id !== b.dataset.rm })); draw(); DQ.badge() } });
  draw();
};

/* ---------- checkout ---------- */
DQ.p_checkout = function () {
  var $ = DQ.$, c = DQ.cart(), o = DQ.opts(), t = DQ.totals(c, o), last = DQ.get('dqLast', null);
  function show(ord) {
    $('#co').style.display = 'none'; var d = $('#done'); d.style.display = 'block';
    var body = 'Order ' + ord.id + '\nName: ' + ord.name + '\nPhone: ' + ord.phone + '\nEvent: ' + ord.eventName + ' on ' + ord.start + ' (' + ord.days + ' day/s)\n' + ord.service + ': ' + ord.address + '\n\n' + ord.quantities + '\n\nTotal: ' + DQ.peso(ord.total) + ' (+ ' + DQ.peso(ord.deposit) + ' refundable deposit)\nPayment: ' + ord.payment;
    d.innerHTML = '<h2>Thank you, ' + DQ.esc(ord.name.split(' ')[0]) + '!</h2><p class="note">Your order was placed. Reference no.: <b>' + DQ.esc(ord.id) + '</b>. We will contact you at ' + DQ.esc(ord.phone) + ' to confirm availability and payment.</p><div class="tw"><table><tbody>' + ord.items.map(function (i) { return '<tr><td>' + DQ.esc(i.name) + ' × ' + i.qty + '</td><td>' + DQ.peso(i.price * i.qty) + ' / day</td></tr>' }).join('') + '</tbody><tfoot><tr><td>Total (' + ord.days + ' day/s' + (ord.fee ? ' + delivery' : '') + ')</td><td>' + DQ.peso(ord.total) + '</td></tr></tfoot></table></div><div class="btns" style="justify-content:flex-start"><a class="btn fill" href="mailto:' + CONFIG.email + '?subject=' + encodeURIComponent('Order ' + ord.id) + '&body=' + encodeURIComponent(body) + '">Email this order to us</a><button class="btn" onclick="print()">Print</button><a class="btn" href="index.html">Back to Home</a></div>';
  }
  if (!c.length) { if (last) { show(last); return } $('#co').innerHTML = '<div class="empty"><h3>YOUR CART IS EMPTY</h3><p><a class="btn fill" href="rentals.html">Browse Rentals</a></p></div>'; return }
  $('#sumbox').innerHTML = '<h3>Order Summary</h3><dl class="dl">' + c.map(function (i) { var p = DQ.prod(i.id); return '<dt>' + DQ.esc(p.name) + ' × ' + i.qty + '</dt><dd>' + DQ.peso(p.price * i.qty) + '</dd>' }).join('') + '<dt>Rental days</dt><dd>' + o.days + '</dd><dt>' + o.service + '</dt><dd>' + DQ.peso(t.fee) + '</dd><dt><b>Total</b></dt><dd class="price">' + DQ.peso(t.total) + '</dd></dl><p class="muted"><small>+ ' + DQ.peso(t.deposit) + ' refundable deposit</small></p><p><a href="cart.html">&larr; Edit cart</a></p>';
  var day = new Date(Date.now() + 864e5).toISOString().slice(0, 10); $('#start').min = day;
  if (o.service === 'Pick-up') { $('#alabel').firstChild.nodeValue = 'Pick-up person / notes (optional)'; $('#address').required = false }
  $('#bf').addEventListener('submit', function (e) {
    e.preventDefault(); var g = function (i) { return $('#' + i).value.trim() }, list = DQ.get('dqBookings', []);
    var max = list.reduce(function (m, b) { var n = parseInt(String(b.id).replace(/\D/g, ''), 10) || 0; return n > m ? n : m }, 0);
    var id = 'DQ-' + String(max + 1).padStart(4, '0'), items = c.map(function (i) { var p = DQ.prod(i.id); return { id: p.id, name: p.name, qty: i.qty, price: p.price, unit: p.unit } });
    var end = new Date(g('start')); end.setDate(end.getDate() + o.days - 1);
    var ord = { id: id, createdAt: new Date().toISOString(), name: g('name'), phone: g('phone'), email: g('email'), eventName: g('eventName'), eventType: g('eventType'), eventDate: g('start'), start: g('start'), end: end.toISOString().slice(0, 10), days: o.days, address: g('address') || '(pick-up)', service: o.service, instructions: g('instructions'), payment: g('payment'), items: items, products: items.map(function (i) { return i.name }), quantities: items.map(function (i) { return i.name + ' x ' + i.qty + ' @ ' + DQ.peso(i.price) }).join('\n'), subtotal: t.rent, fee: t.fee, deposit: t.deposit, total: t.total, status: 'Pending' };
    list.push(ord);
    if (!DQ.set('dqBookings', list)) { alert('Could not save your order in this browser. Please contact us directly.'); return }
    if (CONFIG.endpoint) { try { fetch(CONFIG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(ord) }) } catch (x) { } }
    DQ.set('dqLast', ord); DQ.set('dqCart', []); DQ.badge(); show(ord); scrollTo(0, 0);
  });
};
document.addEventListener('DOMContentLoaded', DQ.init);
