/**
 * api.js — ฟังก์ชันกลาง api(action, data) เรียกหลังบ้านได้ 3 แบบ
 *   gas    : หน้าเว็บรันใน Apps Script (google.script.run)
 *   remote : หน้าเว็บแยก เรียก Web App URL ด้วย POST text/plain (ไม่ติด CORS preflight)
 *   mock   : โหมดทดลอง รันโค้ดหลังบ้านในเบราว์เซอร์
 */
var API = (function () {
  var TOKEN_KEY = 'bmf_token';
  var mode = (window.google && google.script && google.script.run) ? 'gas'
    : (window.BMF_CONFIG.API_URL ? 'remote' : 'mock');

  if (mode === 'mock' && typeof seedDemo === 'function') {
    try { seedDemo(); } catch (e) { console.error('seedDemo', e); }
  }

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } }

  function transport(req) {
    // ใช้ทดสอบโหมดออฟไลน์: window.BMF_FORCE_OFFLINE = true
    if (window.BMF_FORCE_OFFLINE) return Promise.reject(new Error('เชื่อมต่ออินเทอร์เน็ตไม่ได้ (ออฟไลน์)'));
    if (mode === 'gas') {
      return new Promise(function (resolve, reject) {
        google.script.run
          .withSuccessHandler(function (s) { resolve(JSON.parse(s)); })
          .withFailureHandler(function (e) { reject(new Error(e && e.message ? e.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')); })
          .apiRun(JSON.stringify(req));
      });
    }
    if (mode === 'remote') {
      return fetch(window.BMF_CONFIG.API_URL, { method: 'POST', body: JSON.stringify(req), redirect: 'follow' })
        .then(function (r) {
          if (!r.ok) throw new Error('เซิร์ฟเวอร์ตอบกลับผิดพลาด (' + r.status + ')');
          return r.json();
        })
        .catch(function (e) {
          if (e instanceof TypeError) throw new Error('เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง');
          throw e;
        });
    }
    return new Promise(function (resolve) {
      setTimeout(function () {
        // ส่งผ่าน JSON เพื่อให้เหมือนเรียกผ่านเครือข่ายจริง
        resolve(JSON.parse(JSON.stringify(handleRequest(JSON.parse(JSON.stringify(req))))));
      }, 120 + Math.random() * 180);
    });
  }

  function call(action, data) {
    return transport({ action: action, token: getToken(), data: data || {} }).then(function (res) {
      if (!res || !res.ok) {
        var msg = res && res.error ? res.error : 'เกิดข้อผิดพลาด';
        if (msg === 'SESSION_EXPIRED') {
          setToken('');
          if (window.App && App.onSessionExpired) App.onSessionExpired();
          msg = 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง';
        }
        var err = new Error(msg);
        err.server = true;
        throw err;
      }
      return res.data;
    });
  }

  return {
    mode: mode,
    call: call,
    getToken: getToken,
    setToken: setToken
  };
})();

function api(action, data) { return API.call(action, data); }
