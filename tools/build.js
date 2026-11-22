/**
 * tools/build.js — สร้างไฟล์สำหรับติดตั้งจริง
 *
 *   node tools/build.js
 *       → dist/apps-script/   ไฟล์ทั้งหมดสำหรับวางใน Apps Script (ทางเลือก A: หน้าเว็บรันใน Apps Script)
 *
 *   node tools/build.js --api https://script.google.com/macros/s/XXXX/exec
 *       → dist/web/index.html  หน้าเว็บไฟล์เดียวสำหรับ GitHub Pages / Firebase Hosting (ทางเลือก B)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONT = path.join(ROOT, 'frontend');
const args = process.argv.slice(2);
const apiIdx = args.indexOf('--api');
const apiUrl = apiIdx >= 0 ? args[apiIdx + 1] : '';

const JS_FILES = ['api.js', 'ui.js', 'icons.js', 'forms.js', 'maps.js', 'offline.js', 'app.js', 'wizard.js', 'species.js', 'review.js', 'admin.js',
  'field.js', 'map3d.js', 'learn.js'];

function read(p) { return fs.readFileSync(p, 'utf8'); }

function bundleHtml(api, pwa) {
  let html = read(path.join(FRONT, 'index.html'));
  // Apps Script รันใน iframe ใช้ manifest/Service Worker ไม่ได้ → ตัดออก
  if (!pwa) html = html.replace(/<!--PWA-->[\s\S]*?<!--\/PWA-->/, '');
  const css = read(path.join(FRONT, 'css', 'style.css'));
  const config = 'window.BMF_CONFIG = { API_URL: ' + JSON.stringify(api || '') + ' };';
  const js = [config].concat(JS_FILES.map(f => '/* ---- ' + f + ' ---- */\n' + read(path.join(FRONT, 'js', f)))).join('\n\n');
  if (/<\/script/i.test(js)) throw new Error('พบข้อความ </script ในโค้ด — แก้ก่อน bundle');
  html = html.replace(/<!--BUILD:CSS-->[\s\S]*?<!--\/BUILD:CSS-->/, () => '<style>\n' + css + '\n</style>');
  html = html.replace(/<!--BUILD:JS-->[\s\S]*?<!--\/BUILD:JS-->/, () => '<script>\n' + js + '\n</script>');
  return html;
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  console.log('  ✓', path.relative(ROOT, p), '(' + Math.round(Buffer.byteLength(content) / 1024) + ' KB)');
}

console.log('สร้าง dist/apps-script/ ...');
const out = path.join(ROOT, 'dist', 'apps-script');
fs.rmSync(out, { recursive: true, force: true });
fs.readdirSync(path.join(ROOT, 'backend')).forEach(f => {
  writeFile(path.join(out, f), read(path.join(ROOT, 'backend', f)));
});
writeFile(path.join(out, 'Index.html'), bundleHtml('', false));

if (apiUrl) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(apiUrl)) {
    console.warn('⚠️  URL ควรมีรูปแบบ https://script.google.com/macros/s/.../exec');
  }
  console.log('สร้าง dist/web/ ...');
  writeFile(path.join(ROOT, 'dist', 'web', 'index.html'), bundleHtml(apiUrl, true));
  ['sw.js', 'manifest.webmanifest', 'icon.svg'].forEach(f => writeFile(path.join(ROOT, 'dist', 'web', f), read(path.join(FRONT, f))));
} else {
  console.log('(ถ้าจะฝากหน้าเว็บบน GitHub Pages ให้รันใหม่พร้อม --api <URL ของ Web App>)');
}
console.log('เสร็จแล้ว');
