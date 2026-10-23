/**
 * PlayJo – Mock SMS OTP service + modal controller
 * ------------------------------------------------
 * In production the three functions in `OtpService` become API calls:
 *   POST /api/auth/otp/send    { phone }         -> server generates + SMS-es the code
 *   POST /api/auth/otp/verify  { phone, code }   -> server checks the hash, sets phone_verified = true
 * The server must store only a HASH of the code, rate-limit by phone + IP,
 * expire after 5 minutes, and lock after 5 failed attempts.
 */

const OTP_CONFIG = {
  length: 6,
  ttlSeconds: 300,        // code lifetime
  resendCooldown: 30,     // seconds before "Resend" is enabled
  maxAttempts: 5,
  demoMode: true          // shows the code in a toast since no SMS is really sent
};

/* ---------------- Mock backend ---------------- */
const OtpService = (() => {
  const store = {}; // phone -> { code, expiresAt, attempts }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms)); // simulate network latency

  return {
    async send(phone) {
      await wait(700);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      store[phone] = { code, expiresAt: Date.now() + OTP_CONFIG.ttlSeconds * 1000, attempts: 0 };
      console.info(`[MOCK SMS → ${phone}] Your PlayJo code is ${code}`);
      return { ok: true, demoCode: OTP_CONFIG.demoMode ? code : undefined };
    },

    async verify(phone, code) {
      await wait(600);
      const rec = store[phone];
      if (!rec) return { ok: false, error: 'No code was requested for this number.' };
      if (Date.now() > rec.expiresAt) { delete store[phone]; return { ok: false, error: 'Code expired. Please request a new one.' }; }
      if (rec.attempts >= OTP_CONFIG.maxAttempts) return { ok: false, error: 'Too many attempts. Request a new code.' };

      rec.attempts++;
      if (rec.code !== code) {
        const left = OTP_CONFIG.maxAttempts - rec.attempts;
        return { ok: false, error: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` };
      }
      delete store[phone];
      return { ok: true, phone_verified: true };
    }
  };
})();

/* ---------------- Helpers ---------------- */
// Jordanian mobile numbers: 07[7|8|9] + 7 digits. Accepts "79 123 4567", "0791234567", "+962791234567".
function normalizeJordanPhone(raw) {
  let d = String(raw).replace(/[\s\-()]/g, '');
  if (d.startsWith('+962')) d = d.slice(4);
  else if (d.startsWith('00962')) d = d.slice(5);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^7[789]\d{7}$/.test(d) ? '+962' + d : null;
}

const $ = (id) => document.getElementById(id);
function showToast(msg, ms = 6000) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

/* ---------------- Modal controller ---------------- */
const AuthModal = (() => {
  let phone = null;
  let resendTimer = null;
  let expiryTimer = null;
  let pendingUser = null;

  const modal = () => $('auth-modal');
  const steps = ['step-register', 'step-otp', 'step-success'];
  const boxes = () => [...document.querySelectorAll('#otp-boxes .otp-input')];

  function showStep(id) { steps.forEach((s) => $(s).classList.toggle('hidden', s !== id)); }
  function open() { modal().classList.remove('hidden'); modal().classList.add('flex'); showStep('step-register'); }
  function close() { modal().classList.add('hidden'); modal().classList.remove('flex'); clearTimers(); }
  function clearTimers() { clearInterval(resendTimer); clearInterval(expiryTimer); }

  function setError(id, msg) {
    const el = $(id);
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  function startCountdowns() {
    clearTimers();
    // resend cooldown
    let cd = OTP_CONFIG.resendCooldown;
    $('btn-resend').disabled = true;
    $('resend-timer').textContent = `(${cd}s)`;
    resendTimer = setInterval(() => {
      cd--;
      if (cd <= 0) { clearInterval(resendTimer); $('btn-resend').disabled = false; $('resend-timer').textContent = ''; }
      else $('resend-timer').textContent = `(${cd}s)`;
    }, 1000);
    // expiry
    let left = OTP_CONFIG.ttlSeconds;
    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('otp-expiry').textContent = fmt(left);
    expiryTimer = setInterval(() => {
      left--;
      $('otp-expiry').textContent = fmt(Math.max(left, 0));
      if (left <= 0) clearInterval(expiryTimer);
    }, 1000);
  }

  async function sendCode() {
    const res = await OtpService.send(phone);
    if (res.demoCode) showToast(`📩 Demo SMS to ${phone}: your PlayJo code is ${res.demoCode}`);
    startCountdowns();
  }

  /* --- Step 1: submit registration --- */
  async function onRegisterSubmit(e) {
    e.preventDefault();
    setError('register-error');
    const f = new FormData(e.target);
    const normalized = normalizeJordanPhone(f.get('phone'));
    if (!f.get('name').trim()) return setError('register-error', 'Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(f.get('email'))) return setError('register-error', 'Please enter a valid email.');
    if (!normalized) return setError('register-error', 'Enter a valid Jordanian mobile number (e.g. 79 123 4567).');
    if (String(f.get('password')).length < 8) return setError('register-error', 'Password must be at least 8 characters.');

    phone = normalized;
    pendingUser = { name: f.get('name'), email: f.get('email'), phone, phone_verified: false, role: 'customer' };

    const btn = $('btn-send-otp');
    btn.disabled = true; btn.textContent = 'Sending…';
    await sendCode();
    btn.disabled = false; btn.textContent = 'Send verification code';

    $('otp-phone-label').textContent = phone;
    boxes().forEach((b) => (b.value = ''));
    setError('otp-error');
    showStep('step-otp');
    boxes()[0].focus();
  }

  /* --- Step 2: OTP boxes UX (auto-advance, backspace, paste) --- */
  function wireBoxes() {
    const bs = boxes();
    bs.forEach((box, i) => {
      box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g, '').slice(0, 1);
        if (box.value && i < bs.length - 1) bs[i + 1].focus();
        if (bs.every((b) => b.value)) verify();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) bs[i - 1].focus();
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, OTP_CONFIG.length);
        digits.split('').forEach((d, k) => { if (bs[k]) bs[k].value = d; });
        (bs[Math.min(digits.length, bs.length - 1)]).focus();
        if (digits.length === OTP_CONFIG.length) verify();
      });
    });
  }

  async function verify() {
    const code = boxes().map((b) => b.value).join('');
    if (code.length < OTP_CONFIG.length) return setError('otp-error', 'Enter all 6 digits.');
    setError('otp-error');

    const btn = $('btn-verify-otp');
    btn.disabled = true; btn.textContent = 'Verifying…';
    const res = await OtpService.verify(phone, code);
    btn.disabled = false; btn.textContent = 'Verify & continue';

    if (!res.ok) {
      setError('otp-error', res.error);
      boxes().forEach((b) => (b.value = ''));
      boxes()[0].focus();
      return;
    }
    // Success: in production the server flips users.phone_verified = TRUE and returns a JWT.
    pendingUser.phone_verified = true;
    try { sessionStorage.setItem('playjo_user', JSON.stringify(pendingUser)); } catch (_) {}
    clearTimers();
    showStep('step-success');
    document.dispatchEvent(new CustomEvent('playjo:verified', { detail: pendingUser }));
  }

  async function resend() {
    $('btn-resend').disabled = true;
    await sendCode();
    boxes().forEach((b) => (b.value = ''));
    setError('otp-error');
    boxes()[0].focus();
  }

  function init() {
    $('btn-signup').addEventListener('click', open);
    $('btn-login').addEventListener('click', open);
    $('modal-close').addEventListener('click', close);
    $('modal-backdrop').addEventListener('click', close);
    $('btn-success-close').addEventListener('click', close);
    $('register-form').addEventListener('submit', onRegisterSubmit);
    $('btn-verify-otp').addEventListener('click', verify);
    $('btn-resend').addEventListener('click', resend);
    $('otp-change-phone').addEventListener('click', (e) => { e.preventDefault(); clearTimers(); showStep('step-register'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    wireBoxes();
  }

  return { init, open, close };
})();

document.addEventListener('DOMContentLoaded', AuthModal.init);
