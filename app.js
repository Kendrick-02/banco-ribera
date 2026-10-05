/* Banco Ribera – interfaz accesible (sin base de datos: los datos viven en memoria) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const dateFmt = d => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(d));

const state = {
  hidden: false,
  accounts: [
    { id: 'ahorros', name: 'Cuenta de ahorros', num: '4821', balance: 4850000 },
    { id: 'corriente', name: 'Cuenta corriente', num: '7730', balance: 1230500 }
  ],
  moves: [
    { d: '2026-10-02', t: 'Nómina de octubre', a: 3200000, acc: 'ahorros' },
    { d: '2026-10-01', t: 'Arriendo apartamento', a: -1450000, acc: 'ahorros' },
    { d: '2026-09-30', t: 'Supermercado', a: -286400, acc: 'corriente' },
    { d: '2026-09-28', t: 'Pago de servicios públicos', a: -198700, acc: 'corriente' },
    { d: '2026-09-27', t: 'Transferencia recibida', a: 150000, acc: 'ahorros' },
    { d: '2026-09-25', t: 'Suscripción de streaming', a: -32900, acc: 'corriente' }
  ],
  pending: null
};

/* ---------- Utilidades de accesibilidad ---------- */
function announce(msg) {
  const l = $('#live'); l.textContent = '';
  setTimeout(() => (l.textContent = msg), 50);
}
function setError(input, msg) {
  const err = $('#' + input.id + '-err');
  input.classList.toggle('is-invalid', !!msg);
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  err.hidden = !msg; err.textContent = msg || '';
}
function showSummary(box, items) {
  box.innerHTML = `<p class="fw-bold mb-1">Revisa ${items.length === 1 ? 'este campo' : 'estos ' + items.length + ' campos'}:</p><ul class="mb-0">` +
    items.map(i => `<li><a href="#${i.id}">${i.msg}</a></li>`).join('') + '</ul>';
  box.hidden = false; box.focus();
  $$('a', box).forEach(a => a.addEventListener('click', e => { e.preventDefault(); $(a.getAttribute('href')).focus(); }));
}

/* ---------- Preferencias (tamaño de texto y alto contraste) ---------- */
let scale = +(localStorage.getItem('scale') || 100);
const applyScale = () => { document.documentElement.style.fontSize = scale + '%'; localStorage.setItem('scale', scale); };
$('#font-up').onclick = () => { scale = Math.min(150, scale + 10); applyScale(); announce('Texto al ' + scale + ' por ciento'); };
$('#font-down').onclick = () => { scale = Math.max(80, scale - 10); applyScale(); announce('Texto al ' + scale + ' por ciento'); };
const setContrast = on => {
  document.documentElement.toggleAttribute('data-contrast', on);
  if (on) document.documentElement.setAttribute('data-contrast', 'high');
  $('#contrast').setAttribute('aria-pressed', on);
  localStorage.setItem('contrast', on ? '1' : '');
};
$('#contrast').onclick = () => { const on = $('#contrast').getAttribute('aria-pressed') !== 'true'; setContrast(on); announce(on ? 'Alto contraste activado' : 'Alto contraste desactivado'); };
applyScale(); setContrast(!!localStorage.getItem('contrast'));

/* ---------- Inicio de sesión ---------- */
$('#toggle-pass').onclick = e => {
  const p = $('#password'), show = p.type === 'password';
  p.type = show ? 'text' : 'password';
  e.target.textContent = show ? 'Ocultar clave' : 'Mostrar clave';
  e.target.setAttribute('aria-pressed', show);
};
$('#login-form').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('#email'), pass = $('#password'), errors = [];
  const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
  setError(email, okMail ? '' : 'Escribe un correo válido, por ejemplo nombre@correo.com.');
  setError(pass, pass.value.length >= 6 ? '' : 'La clave debe tener al menos 6 caracteres.');
  if (!okMail) errors.push({ id: 'email', msg: 'Correo electrónico: escribe un correo válido.' });
  if (pass.value.length < 6) errors.push({ id: 'password', msg: 'Clave: debe tener al menos 6 caracteres.' });
  if (errors.length) return showSummary($('#login-errors'), errors);
  $('#login-errors').hidden = true;
  $('#view-login').hidden = true; $('#app').hidden = false;
  if (!location.hash) location.hash = '#inicio';
  route();
});
$('#logout').onclick = () => { $('#app').hidden = true; $('#view-login').hidden = false; $('#login-form').reset(); $('#email').focus(); announce('Sesión cerrada'); };

/* ---------- Navegación por hash ---------- */
const titles = { inicio: 'Resumen', transferir: 'Transferir', movimientos: 'Movimientos' };
function route() {
  if ($('#app').hidden) return;
  const name = titles[location.hash.slice(1)] ? location.hash.slice(1) : 'inicio';
  $$('.view').forEach(v => (v.hidden = v.id !== 'view-' + name));
  $$('.sidenav .nav-link').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + name));
  $$('.sidenav .nav-link').forEach(a => { if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page'); });
  document.title = titles[name] + ' – Banco Ribera';
  render();
  $('#h-' + name).focus();           // mueve el foco al título de la nueva vista
  announce('Sección ' + titles[name]);
}
window.addEventListener('hashchange', route);

/* ---------- Renderizado ---------- */
const sorted = () => [...state.moves].sort((a, b) => b.d.localeCompare(a.d));
const accName = id => state.accounts.find(a => a.id === id).name;
const val = n => (state.hidden ? '••••••' : money(n)) + (state.hidden ? '' : '');
const hiddenTxt = () => (state.hidden ? '<span class="visually-hidden">Saldo oculto</span>' : '');

function rows(list, caption) {
  return `<caption>${caption}</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Descripción</th><th scope="col">Cuenta</th><th scope="col" class="num">Valor</th></tr></thead><tbody>` +
    (list.length ? list.map(m => `<tr><td>${dateFmt(m.d)}</td><td>${m.t}</td><td>${accName(m.acc)}</td>
      <td class="num ${m.a < 0 ? 'amt-out' : 'amt-in'}"><span class="visually-hidden">${m.a < 0 ? 'Egreso de' : 'Ingreso de'}</span>${m.a < 0 ? '−' : '+'}${money(Math.abs(m.a))}</td></tr>`).join('')
      : '<tr><td colspan="4">No hay movimientos para este filtro.</td></tr>') + '</tbody>';
}
function render() {
  const total = state.accounts.reduce((s, a) => s + a.balance, 0);
  $('#total').innerHTML = val(total) + hiddenTxt();
  $('#accounts').innerHTML = state.accounts.map(a => `<li><p class="acc-name">${a.name}</p><p class="text-body-secondary mb-0">Terminada en ${a.num}</p><p class="acc-balance">${val(a.balance)}${hiddenTxt()}</p></li>`).join('');
  $('#recent').innerHTML = rows(sorted().slice(0, 5), 'Últimos 5 movimientos');
  $('#t-origin').innerHTML = state.accounts.map(a => `<option value="${a.id}">${a.name} (…${a.num}) – ${money(a.balance)}</option>`).join('');
  renderAll();
}
function renderAll() {
  const f = $('#filter').value;
  const list = sorted().filter(m => f === 'all' || (f === 'in' ? m.a > 0 : m.a < 0));
  $('#all').innerHTML = rows(list, 'Historial de movimientos');
}
$('#filter').onchange = () => { renderAll(); announce($$('#all tbody tr').length + ' movimientos mostrados'); };
$('#toggle-balance').onclick = e => {
  state.hidden = !state.hidden; render();
  e.target.setAttribute('aria-pressed', state.hidden);
  e.target.textContent = state.hidden ? 'Mostrar saldos' : 'Ocultar saldos';
  announce(state.hidden ? 'Saldos ocultos' : 'Saldos visibles');
};

/* ---------- Transferencias ---------- */
$('#t-form').addEventListener('submit', e => {
  e.preventDefault();
  const dest = $('#t-dest'), amt = $('#t-amount'), origin = $('#t-origin'), errors = [];
  const acc = state.accounts.find(a => a.id === origin.value);
  const amount = parseInt(amt.value.replace(/[.\s]/g, ''), 10);
  let m1 = '', m2 = '';
  if (!/^\d{10}$/.test(dest.value)) m1 = 'Escribe los 10 dígitos de la cuenta, sin espacios ni guiones.';
  if (!amount || amount <= 0) m2 = 'Escribe un monto mayor a cero, solo con números.';
  else if (amount > acc.balance) m2 = 'El monto supera el saldo disponible (' + money(acc.balance) + ').';
  setError(dest, m1); setError(amt, m2);
  if (m1) errors.push({ id: 't-dest', msg: 'Cuenta destino: ' + m1 });
  if (m2) errors.push({ id: 't-amount', msg: 'Monto: ' + m2 });
  if (errors.length) return showSummary($('#t-errors'), errors);
  $('#t-errors').hidden = true;
  state.pending = { acc, amount, dest: dest.value, note: $('#t-note').value.trim() };
  $('#confirm-body').innerHTML = `<dt>Desde</dt><dd>${acc.name}</dd><dt>Hacia la cuenta</dt><dd>${dest.value}</dd><dt>Monto</dt><dd class="fw-bold fs-4">${money(amount)}</dd>` +
    (state.pending.note ? `<dt>Descripción</dt><dd>${state.pending.note}</dd>` : '');
  bootstrap.Modal.getOrCreateInstance('#confirm').show();
});
$('#confirm-ok').onclick = () => {
  const p = state.pending; if (!p) return;
  p.acc.balance -= p.amount;
  state.moves.push({ d: new Date().toISOString().slice(0, 10), t: p.note || 'Transferencia a cuenta ' + p.dest, a: -p.amount, acc: p.acc.id });
  bootstrap.Modal.getInstance('#confirm').hide();
  $('#t-form').reset(); state.pending = null;
  location.hash = '#inicio'; route();
  $('#notice-text').textContent = 'Transferencia enviada por ' + money(p.amount) + '.';
  $('#notice').hidden = false;
  announce('Transferencia enviada por ' + money(p.amount));
};
$('#notice-close').onclick = () => { $('#notice').hidden = true; $('#h-inicio').focus(); };
