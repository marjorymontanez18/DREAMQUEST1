/* DREAM QUEST — accounts & roles (customer / admin).
   Everything is stored in this browser's localStorage (this site has no server).
   Edit the two values in AUTH_CONFIG below. */
var AUTH_CONFIG = {
  // Anyone who wants to sign up as an ADMIN must type this code. Change it and keep it private!
  adminCode: 'DQ-OWNER-2026',
  // A ready-made owner account so you can get in the first time (change the password in Profile).
  seedAdmin: { username: 'admin', password: 'dreamquest123', email: 'admin@dreamquest.com', name: 'Owner' }
};

var DQAuth = (function () {
  var USERS = 'dqUsers', SESS = 'dqSession', LAST = 'dqLastLogin';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) };
  function read(store, k, d) { try { var r = store.getItem(k); return r ? JSON.parse(r) : d } catch (e) { return d } }
  function write(store, k, v) { try { store.setItem(k, JSON.stringify(v)); return true } catch (e) { return false } }
  var users = function () { return read(localStorage, USERS, []) };
  var saveUsers = function (u) { return write(localStorage, USERS, u) };

  /* ---- password hashing (salted SHA-256; falls back to a simple hash if the browser blocks crypto) ---- */
  function fallbackHash(s) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677) }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 'f' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  function hash(pw, salt) {
    var s = salt + ':' + pw;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2) }).join('');
      }).catch(function () { return fallbackHash(s) });
    }
    return Promise.resolve(fallbackHash(s));
  }
  function newSalt() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
  function newId() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

  /* ---- make sure the owner account exists ---- */
  var ready = (function () {
    var a = AUTH_CONFIG.seedAdmin;
    if (users().some(function (u) { return u.id === 'u-admin' })) return Promise.resolve();
    var salt = newSalt();
    return hash(a.password, salt).then(function (h) {
      var l = users(); if (l.some(function (u) { return u.id === 'u-admin' })) return;
      l.push({ id: 'u-admin', role: 'admin', name: a.name, username: a.username, email: a.email, phone: '', address: '', salt: salt, passHash: h, createdAt: new Date().toISOString() });
      saveUsers(l);
    });
  })();

  /* ---- session ---- */
  function session() { return read(localStorage, SESS, null) || read(sessionStorage, SESS, null) }
  function user() {
    var s = session(); if (!s) return null;
    var u = users().filter(function (x) { return x.id === s.id })[0];
    return u || null;
  }
  function startSession(u, remember) {
    localStorage.removeItem(SESS); sessionStorage.removeItem(SESS);
    write(remember === false ? sessionStorage : localStorage, SESS, { id: u.id, at: Date.now() });
  }
  function logout(to) { try { localStorage.removeItem(SESS); sessionStorage.removeItem(SESS) } catch (e) { } location.href = to || 'index.html'; return false }
  function home(u) { u = u || user(); return u ? (u.role === 'admin' ? 'dashboard.html' : 'account.html') : 'login.html' }
  function safeNext(n) { return /^[\w\-]+\.html(\?[\w=&\-]*)?(#[\w\-]*)?$/.test(n || '') ? n : '' }

  /* ---- sign up / log in ---- */
  var norm = function (s) { return String(s || '').trim().toLowerCase() };
  function signup(f) {
    return ready.then(function () {
      var role = f.role === 'admin' ? 'admin' : 'customer';
      var name = String(f.name || '').trim(), email = norm(f.email), phone = String(f.phone || '').trim();
      if (!name) throw new Error('Please enter your full name.');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please enter a valid email address.');
      if (role === 'customer' && !/^[0-9+ \-]{7,}$/.test(phone)) throw new Error('Please enter a valid mobile number.');
      if (String(f.password || '').length < 6) throw new Error('Password must be at least 6 characters.');
      if (f.password !== f.confirm) throw new Error('Passwords do not match.');
      if (role === 'admin' && String(f.code || '').trim() !== AUTH_CONFIG.adminCode) throw new Error('Incorrect owner access code. Ask the business owner for it.');
      var l = users();
      if (l.some(function (u) { return norm(u.email) === email || (u.username && norm(u.username) === email) })) throw new Error('An account with this email already exists. Please log in instead.');
      var salt = newSalt();
      return hash(f.password, salt).then(function (h) {
        var u = { id: newId(), role: role, name: name, email: email, phone: phone, address: String(f.address || '').trim(), salt: salt, passHash: h, createdAt: new Date().toISOString() };
        l = users(); l.push(u);
        if (!saveUsers(l)) throw new Error('Could not save your account in this browser (storage is full or blocked).');
        startSession(u, f.remember !== false);
        write(localStorage, LAST, { role: role, id: email });
        return u;
      });
    });
  }
  function login(f) {
    return ready.then(function () {
      var role = f.role === 'admin' ? 'admin' : 'customer', id = norm(f.id);
      if (!id || !f.password) throw new Error('Please enter your ' + (role === 'admin' ? 'email or username' : 'email') + ' and password.');
      var u = users().filter(function (x) { return norm(x.email) === id || (x.username && norm(x.username) === id) })[0];
      if (!u) throw new Error('No account found with that ' + (role === 'admin' ? 'email or username' : 'email') + '. You can sign up first.');
      return hash(f.password, u.salt).then(function (h) {
        if (h !== u.passHash) throw new Error('Incorrect password.');
        if (u.role !== role) throw new Error('This is ' + (u.role === 'admin' ? 'an admin' : 'a customer') + ' account. Please choose "' + (u.role === 'admin' ? 'Admin' : 'Customer') + '" to log in.');
        startSession(u, f.remember !== false);
        write(localStorage, LAST, { role: role, id: id });
        return u;
      });
    });
  }
  function update(id, fields) {
    var l = users(), u = l.filter(function (x) { return x.id === id })[0]; if (!u) throw new Error('Account not found.');
    if (fields.email !== undefined) {
      var em = norm(fields.email);
      if (!/^\S+@\S+\.\S+$/.test(em)) throw new Error('Please enter a valid email address.');
      if (l.some(function (x) { return x.id !== id && (norm(x.email) === em || (x.username && norm(x.username) === em)) })) throw new Error('Another account already uses that email.');
      fields.email = em;
    }
    ['name', 'email', 'phone', 'address'].forEach(function (k) { if (fields[k] !== undefined) u[k] = String(fields[k]).trim() });
    if (!u.name) throw new Error('Name cannot be empty.');
    if (!saveUsers(l)) throw new Error('Could not save changes.');
    return u;
  }
  function changePassword(id, oldPw, newPw, confirm) {
    return ready.then(function () {
      var l = users(), u = l.filter(function (x) { return x.id === id })[0]; if (!u) throw new Error('Account not found.');
      if (String(newPw || '').length < 6) throw new Error('New password must be at least 6 characters.');
      if (newPw !== confirm) throw new Error('New passwords do not match.');
      return hash(oldPw, u.salt).then(function (h) {
        if (h !== u.passHash) throw new Error('Current password is incorrect.');
        var salt = newSalt();
        return hash(newPw, salt).then(function (nh) { u.salt = salt; u.passHash = nh; if (!saveUsers(l)) throw new Error('Could not save changes.'); return true });
      });
    });
  }

  /* ---- page guards: keep admins on admin pages and customers on customer pages ---- */
  function guard(role) {
    var u = user(), page = location.pathname.split('/').pop() || 'index.html';
    if (!u) { location.replace('login.html?role=' + role + '&next=' + encodeURIComponent(page + location.search)); return false }
    if (role !== 'any' && u.role !== role) { location.replace(home(u)); return false }
    return true;
  }
  /* hide the page until the guard has approved it (prevents a flash of admin content) */
  function protect(role) {
    var ok = guard(role);
    if (!ok) { document.documentElement.style.visibility = 'hidden'; return false }
    return true;
  }

  /* ---- sidebar for dashboards (different menu for admin vs customer) ---- */
  function mountSide(active) {
    var u = user(), el = document.getElementById('side'); if (!u || !el) return;
    var links = u.role === 'admin'
      ? [['dashboard', 'Dashboard', 'dashboard.html'], ['orders', 'Orders', 'bookings.html'], ['products', 'Products', 'products.html'], ['inventory', 'Inventory', 'inventory.html'], ['customers', 'Customers', 'customers.html'], ['settings', 'Settings', 'settings.html'], ['profile', 'My Profile', 'profile.html']]
      : [['dashboard', 'Dashboard', 'account.html'], ['orders', 'My Orders', 'account.html#orders'], ['rentals', 'Browse Rentals', 'rentals.html'], ['cart', 'My Cart', 'cart.html'], ['profile', 'My Profile', 'profile.html']];
    el.innerHTML = '<div class="brand"><span class="dq">DQ</span><span>DREAM QUEST<small>EVENT ESSENTIALS</small></span></div>' +
      '<div class="who"><b>' + esc(u.name) + '</b><span class="role ' + u.role + '">' + (u.role === 'admin' ? 'Admin' : 'Customer') + '</span></div>' +
      links.map(function (l) { return '<a href="' + l[2] + '"' + (l[0] === active ? ' class="on"' : '') + '>' + l[1] + '</a>' }).join('') +
      '<a href="index.html">Back to Website</a><a href="#" onclick="return DQAuth.logout()">Log Out</a>';
  }

  return { ready: ready, user: user, session: session, signup: signup, login: login, logout: logout, update: update, changePassword: changePassword, guard: guard, protect: protect, home: home, safeNext: safeNext, mountSide: mountSide, esc: esc, users: users, last: function () { return read(localStorage, LAST, null) } };
})();
