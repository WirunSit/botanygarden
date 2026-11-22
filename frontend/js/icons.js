/**
 * icons.js — รูปลายเส้นสำหรับตัวเลือกสัณฐานวิทยา (เลือกจากรูปแทนการพิมพ์ศัพท์)
 * คีย์ตรงกับคอลัมน์ icon ในชีต Lists เช่น "leaf_shape/ovate"
 * ครูเปลี่ยนเป็นรูปของตัวเองได้ โดยใส่ URL รูปในคอลัมน์ icon แทน
 */
var Icons = (function () {
  var CX = 40;

  function f(n) { return Math.round(n * 10) / 10; }
  function svg(inner) { return '<svg class="ico" viewBox="0 0 80 80" aria-hidden="true">' + inner + '</svg>'; }

  /**
   * ใบจากฟังก์ชันความกว้าง prof(t, side) โดย t=0 ที่โคน t=1 ที่ปลาย
   * o: { top, bot, apexY, baseY, petiole, veins: 'pinnate'|'palmate'|'parallel'|false, scale, cx, rot }
   */
  function leafPath(prof, o) {
    o = o || {};
    var N = 56, top = o.top || 8, bot = o.bot || 70, cx = o.cx || CX;
    var R = [], L = [];
    for (var i = 1; i < N; i++) {
      var t = i / N, y = bot - (bot - top) * t;
      R.push([cx + prof(t, 1, i), y]);
      L.push([cx - prof(t, -1, i), y]);
    }
    var pts = [[cx, o.baseY || bot]].concat(R, [[cx, o.apexY || top]], L.reverse());
    return 'M' + pts.map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join('L') + 'Z';
  }

  function leaf(prof, o) {
    o = o || {};
    var top = o.top || 8, bot = o.bot || 70;
    var out = '<path class="lf" d="' + leafPath(prof, o) + '"/>';
    var veins = o.veins === undefined ? 'mid' : o.veins;
    if (veins === 'mid' || veins === 'pinnate') out += '<path class="v" d="M40 ' + (o.baseY || bot) + 'L40 ' + (top + 5) + '"/>';
    if (veins === 'pinnate') {
      for (var y = bot - 10; y > top + 10; y -= 9) {
        var w = prof((bot - y) / (bot - top), 1) * 0.8;
        out += '<path class="v" d="M40 ' + y + 'Q' + f(40 + w * .5) + ' ' + (y - 3) + ' ' + f(40 + w) + ' ' + (y - 8) + 'M40 ' + y + 'Q' + f(40 - w * .5) + ' ' + (y - 3) + ' ' + f(40 - w) + ' ' + (y - 8) + '"/>';
      }
    }
    if (o.petiole !== false) out += '<path class="st" d="M40 ' + bot + 'L40 ' + (bot + 8) + '"/>';
    return out;
  }

  // โปรไฟล์ความกว้าง
  var P = {
    curve: function (a, b, W) { return function (t) { return W * Math.pow(Math.sin(Math.PI * Math.pow(t, a)), b); }; },
    halves: function (base, apex, W, right) {
      return function (t, side) {
        var g = t < .5 ? (side === -1 && right ? right : base)(t / .5) : apex((1 - t) / .5);
        return W * g;
      };
    }
  };
  // g(u): u=0 ที่ปลาย/โคน, u=1 ที่กลางใบ
  var G = {
    acute: function (u) { return Math.sin(Math.PI / 2 * u); },
    acuminate: function (u) { return u < .35 ? .22 * (u / .35) : .22 + .78 * Math.sin(Math.PI / 2 * (u - .35) / .65); },
    obtuse: function (u) { return Math.pow(Math.sin(Math.PI / 2 * u), .55); },
    rounded: function (u) { return Math.sqrt(1 - (1 - u) * (1 - u)); },
    cuneate: function (u) { return Math.min(1, u * 1.15); },
    truncate: function (u) { return .8 + .2 * Math.sin(Math.PI / 2 * u); },
    cordate: function (u) { return Math.sqrt(1 - (1 - u) * (1 - u)) * (u < .3 ? 1 + (1 - u / .3) * .1 : 1); }
  };

  function leafShape(kind) {
    switch (kind) {
      case 'ovate': return leaf(P.curve(.66, 1, 22));
      case 'elliptic': return leaf(P.curve(1, 1, 21));
      case 'lanceolate': return leaf(P.curve(.75, 1.2, 11), { top: 4, bot: 72 });
      case 'cordate': return leaf(P.halves(G.rounded, G.acute, 26), { baseY: 60 });
      case 'oblong': return leaf(function (t) { return 15 * Math.pow(Math.sin(Math.PI * t), .3); }, { top: 6, bot: 72 });
      case 'obovate': return leaf(P.curve(1.6, 1, 22));
      case 'linear': return leaf(function (t) { return 4.5 * Math.pow(Math.sin(Math.PI * t), .2); }, { top: 3, bot: 74 });
      case 'orbicular': return leaf(P.halves(G.rounded, G.rounded, 28), { top: 10, bot: 68, baseY: 64 });
      case 'palmately_lobed':
        return '<path class="lf" d="M40 66 L30 62 L14 64 L22 52 L6 40 L22 38 L18 20 L32 30 L40 6 L48 30 L62 20 L58 38 L74 40 L58 52 L66 64 L50 62 Z"/>' +
          '<path class="v" d="M40 64L40 12M40 64L14 42M40 64L66 42M40 64L22 24M40 64L58 24"/><path class="st" d="M40 66L40 76"/>';
    }
    return '';
  }

  function leafApex(kind) {
    var o = { veins: 'mid' };
    switch (kind) {
      case 'acute': return leaf(P.halves(G.obtuse, G.acute, 20), o);
      case 'acuminate': return leaf(P.halves(G.obtuse, G.acuminate, 20), { top: 2, veins: 'mid' });
      case 'obtuse': return leaf(P.halves(G.obtuse, G.obtuse, 20), o);
      case 'rounded': return leaf(P.halves(G.obtuse, G.rounded, 20), o);
      case 'emarginate': return leaf(P.halves(G.obtuse, G.rounded, 20), { apexY: 16, veins: 'mid' });
      case 'mucronate': return leaf(P.halves(G.obtuse, G.rounded, 20), { apexY: 0, top: 10, veins: 'mid' });
    }
    return '';
  }

  function leafBase(kind) {
    var o = { veins: 'mid' };
    switch (kind) {
      case 'cuneate': return leaf(P.halves(G.cuneate, G.acute, 20), o);
      case 'obtuse': return leaf(P.halves(G.obtuse, G.acute, 20), o);
      case 'rounded': return leaf(P.halves(G.rounded, G.acute, 20), o);
      case 'cordate': return leaf(P.halves(G.rounded, G.acute, 22), { baseY: 60, veins: 'mid' });
      case 'truncate': return leaf(P.halves(G.truncate, G.acute, 20), o);
      case 'oblique': return leaf(P.halves(G.rounded, G.acute, 20, function (u) { return u < .25 ? 0 : G.cuneate((u - .25) / .75); }), o);
    }
    return '';
  }

  function leafMargin(kind) {
    var base = P.curve(1, 1, 20);
    var tooth = {
      entire: function () { return 0; },
      serrate: function (t, s, i) { return (i % 4) / 4 * 3.2; },
      dentate: function (t, s, i) { var k = i % 4; return (k < 2 ? k : 4 - k) * 1.7; },
      crenate: function (t, s, i) { return Math.abs(Math.sin(i * Math.PI / 4)) * 2.6; },
      undulate: function (t) { return Math.sin(t * Math.PI * 8) * 2.2; },
      lobed: function (t) { return Math.abs(Math.sin(t * Math.PI * 3.5)) * 7 - 3; }
    }[kind];
    if (!tooth) return '';
    return leaf(function (t, s, i) { var w = base(t); return Math.max(0, w + (w > 2 ? tooth(t, s, i || 0) : 0)); }, { veins: 'mid' });
  }

  function ell(cx, cy, rx, ry, rot) {
    return '<ellipse class="lf" cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" transform="rotate(' + (rot || 0) + ' ' + cx + ' ' + cy + ')"/>';
  }
  function line(d, cls) { return '<path class="' + (cls || 'st') + '" d="' + d + '"/>'; }
  function circ(cx, cy, r, cls) { return '<circle class="' + (cls || 'lf') + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>'; }
  function flower(cx, cy, r) { return circ(cx, cy, r || 3.4, 'fl'); }

  function leafType(kind) {
    var o = '';
    switch (kind) {
      case 'simple':
        return line('M40 78L40 60') + '<g transform="translate(0,-6)">' + leaf(P.curve(1, 1, 18), { top: 10, bot: 62, veins: 'pinnate', petiole: false }) + '</g>';
      case 'pinnate':
        o = line('M40 78L40 8');
        [62, 50, 38, 26].forEach(function (y) { o += ell(29, y, 9, 4.2, 15) + ell(51, y, 9, 4.2, -15); });
        return o + ell(40, 12, 4.2, 8, 0);
      case 'bipinnate':
        o = line('M40 78L40 10');
        [58, 38, 20].forEach(function (y) {
          o += line('M40 ' + y + 'L14 ' + (y - 8), 'v2') + line('M40 ' + y + 'L66 ' + (y - 8), 'v2');
          for (var k = 0; k < 4; k++) {
            var x1 = 36 - k * 6, x2 = 44 + k * 6, yy = y - 2 - k * 2;
            o += ell(x1, yy - 3, 1.8, 3, -20) + ell(x1, yy + 3, 1.8, 3, 20) + ell(x2, yy - 3, 1.8, 3, 20) + ell(x2, yy + 3, 1.8, 3, -20);
          }
        });
        return o;
      case 'palmate_compound':
        o = line('M40 78L40 44');
        [-70, -35, 0, 35, 70].forEach(function (a) {
          o += '<g transform="rotate(' + a + ' 40 44)">' + ell(40, 25, 6, 17, 0) + '</g>';
        });
        return o;
      case 'trifoliate':
        o = line('M40 78L40 44');
        [-55, 0, 55].forEach(function (a) { o += '<g transform="rotate(' + a + ' 40 44)">' + ell(40, 24, 8, 18, 0) + '</g>'; });
        return o;
    }
    return '';
  }

  function arrangement(kind) {
    var o = line('M40 78L40 4');
    switch (kind) {
      case 'alternate':
        [66, 50, 34, 18].forEach(function (y, i) { o += i % 2 ? ell(26, y - 4, 13, 4.5, 25) : ell(54, y - 4, 13, 4.5, -25); });
        return o;
      case 'opposite':
        [62, 40, 18].forEach(function (y) { o += ell(26, y - 4, 13, 4.5, 25) + ell(54, y - 4, 13, 4.5, -25); });
        return o;
      case 'decussate':
        [64, 46, 28, 12].forEach(function (y, i) {
          o += i % 2 ? ell(40, y - 7, 4, 8, 0) + ell(40, y + 1, 5, 3, 0) : ell(26, y - 4, 13, 4.5, 25) + ell(54, y - 4, 13, 4.5, -25);
        });
        return o;
      case 'whorled':
        [58, 26].forEach(function (y) {
          o += ell(25, y - 4, 13, 4, 20) + ell(55, y - 4, 13, 4, -20) + ell(33, y + 3, 9, 3.6, -20) + ell(47, y + 3, 9, 3.6, 20);
        });
        return o;
      case 'clustered':
        o = line('M40 78L40 40');
        [-80, -50, -20, 10, 40, 70, 100].forEach(function (a) { o += '<g transform="rotate(' + (a - 15) + ' 40 40)">' + ell(40, 20, 4.5, 16, 0) + '</g>'; });
        return o;
    }
    return '';
  }

  function venation(kind) {
    switch (kind) {
      case 'pinnate': return leaf(P.curve(1, 1, 21), { veins: 'pinnate' });
      case 'palmate':
        return leaf(P.halves(G.rounded, G.acute, 26), { baseY: 62, veins: false }) +
          '<path class="v" d="M40 62L40 12M40 62L22 22M40 62L58 22M40 62L16 46M40 62L64 46"/>';
      case 'parallel':
        return leaf(function (t) { return 11 * Math.pow(Math.sin(Math.PI * t), .5); }, { top: 3, bot: 72, veins: false }) +
          '<path class="v" d="M40 72L40 6M36 70Q33 40 38 8M44 70Q47 40 42 8M32 66Q28 40 36 12M48 66Q52 40 44 12"/>';
    }
    return '';
  }

  function habit(kind) {
    var ground = line('M6 76L74 76', 'gr');
    switch (kind) {
      case 'tree': return ground + '<path class="tr" d="M37 76L38 46L42 46L43 76Z"/>' + circ(40, 30, 21) + circ(28, 36, 10) + circ(52, 36, 10);
      case 'shrub': return ground + line('M30 76L34 54M40 76L40 50M50 76L46 54', 'trl') + '<path class="lf" d="M8 64Q8 34 40 32Q72 34 72 64Q56 70 40 66Q24 70 8 64Z"/>';
      case 'herb': return ground + line('M40 76L40 30M40 60L28 50M40 50L52 40', 'stg') + ell(24, 46, 7, 3.5, 30) + ell(56, 36, 7, 3.5, -30) + ell(40, 26, 3.5, 7, 0) + flower(40, 20, 3.5);
      case 'climber':
        return ground + '<path class="tr" d="M58 76L58 6L62 6L62 76Z"/>' +
          line('M60 76C46 70 74 62 60 56C46 50 74 42 60 36C46 30 74 22 60 14', 'stg') + ell(48, 62, 6, 3, 20) + ell(72, 46, 6, 3, -20) + ell(48, 32, 6, 3, 20) + ell(72, 18, 6, 3, -20);
      case 'scandent':
        return ground + '<path class="tr" d="M60 76L60 20L64 20L64 76Z"/>' + line('M18 76Q20 40 44 26Q56 20 66 26', 'trl') + line('M26 76Q30 50 50 40Q60 36 70 42', 'trl') +
          ell(40, 30, 7, 3.5, -20) + ell(56, 22, 6, 3, 10) + ell(46, 44, 6, 3, -15);
      case 'palm':
        return ground + '<path class="tr" d="M38 76L39 26L41 26L42 76Z"/>' +
          line('M40 26Q22 14 6 26M40 26Q58 14 74 26M40 26Q30 10 18 8M40 26Q50 10 62 8M40 26Q40 12 40 4M40 26Q24 24 12 40M40 26Q56 24 68 40', 'pf');
      case 'bamboo':
        var b = ground;
        [[28, 8], [40, 4], [52, 10]].forEach(function (c) {
          b += '<path class="bb" d="M' + (c[0] - 2.5) + ' 76L' + (c[0] - 2.5) + ' ' + c[1] + 'L' + (c[0] + 2.5) + ' ' + c[1] + 'L' + (c[0] + 2.5) + ' 76Z"/>';
          for (var y = 70; y > c[1] + 6; y -= 11) b += line('M' + (c[0] - 3) + ' ' + y + 'L' + (c[0] + 3) + ' ' + y, 'v');
        });
        return b + ell(20, 16, 8, 2.5, 30) + ell(62, 18, 8, 2.5, -30) + ell(46, 8, 7, 2.2, -40);
      case 'fern':
        var o = ground;
        [[-1, 'M40 76Q30 40 10 30'], [1, 'M40 76Q50 40 70 30'], [0, 'M40 76Q38 40 40 6']].forEach(function (fr) {
          o += line(fr[1], 'stg');
        });
        for (var i = 0; i < 7; i++) {
          var y = 66 - i * 9;
          o += line('M40 ' + y + 'l-' + (10 - i) + ' -4M40 ' + y + 'l' + (10 - i) + ' -4', 'pf');
        }
        return o;
      case 'orchid':
        return '<path class="tr" d="M20 70Q10 70 12 60L16 40Q20 34 26 40L30 60Q30 70 20 70Z"/>' + line('M6 72L74 72', 'gr') +
          '<path class="lf" d="M22 40Q14 20 22 8Q26 22 24 40Z"/><path class="lf" d="M24 40Q38 26 34 12Q28 28 22 40Z"/>' +
          line('M28 50Q50 36 62 18', 'stg') + flower(46, 34, 4) + flower(54, 26, 4) + flower(62, 18, 4.6);
    }
    return '';
  }

  function bark(kind) {
    var o = '<path class="tr" d="M24 4L56 4L58 76L22 76Z"/>';
    switch (kind) {
      case 'smooth': return o + line('M32 10L31 70M48 8L49 72', 'bk2');
      case 'fissured': return o + line('M30 6Q34 20 29 34Q26 50 31 74M40 4Q44 22 38 40Q36 56 41 76M50 6Q47 24 52 40Q55 58 50 74', 'bk');
      case 'flaking': return o + '<path class="bkp" d="M28 12L40 10L42 24L30 26Z M44 30L54 28L55 42L45 44Z M28 44L38 46L36 60L26 58Z M42 58L54 56L55 70L44 70Z"/>';
      case 'rough': var r = o; for (var i = 0; i < 26; i++) r += line('M' + (27 + (i * 37) % 28) + ' ' + (8 + (i * 23) % 64) + 'l3 2', 'bk'); return r;
      case 'spiny': var s = o; for (var y = 12; y < 74; y += 12) s += '<path class="sp" d="M24 ' + y + 'l-8 -2l8 -4Z M56 ' + (y + 6) + 'l8 -2l-8 -4Z M38 ' + (y + 3) + 'l2 -6l2 6Z"/>'; return s;
      case 'lenticellate': var l = o; for (var k = 0; k < 14; k++) l += line('M' + (28 + (k * 11) % 22) + ' ' + (10 + k * 4.6) + 'l6 0', 'bk'); return l;
    }
    return '';
  }

  function inflorescence(kind) {
    var o = '';
    switch (kind) {
      case 'solitary': return line('M40 78Q38 50 40 36', 'stg') + ell(32, 60, 8, 3.5, 25) +
        '<g>' + [0, 72, 144, 216, 288].map(function (a) { return '<ellipse class="fl" cx="40" cy="20" rx="6" ry="11" transform="rotate(' + a + ' 40 30)"/>'; }).join('') + '</g>' + circ(40, 30, 4, 'fc');
      case 'raceme':
        o = line('M40 78L40 8', 'stg');
        for (var y = 66; y >= 12; y -= 9) { var d = (y / 9) % 2 ? -1 : 1; o += line('M40 ' + y + 'l' + d * 9 + ' -4', 'stg') + flower(40 + d * 11, y - 5); }
        return o;
      case 'spike':
        o = line('M40 78L40 8', 'stg');
        for (var y2 = 64; y2 >= 12; y2 -= 6) o += flower(36, y2, 3) + flower(44, y2 - 3, 3);
        return o;
      case 'panicle':
        o = line('M40 78L40 8', 'stg');
        [[60, 1], [48, -1], [36, 1], [24, -1]].forEach(function (b) {
          var x2 = 40 + b[1] * 22;
          o += line('M40 ' + b[0] + 'L' + x2 + ' ' + (b[0] - 12), 'stg') + flower(x2, b[0] - 13, 3) +
            line('M' + (40 + b[1] * 9) + ' ' + (b[0] - 5) + 'l' + b[1] * 4 + ' -9', 'stg') + flower(40 + b[1] * 13, b[0] - 15, 3);
        });
        return o + flower(40, 8);
      case 'umbel':
        o = line('M40 78L40 46', 'stg');
        [-60, -36, -12, 12, 36, 60].forEach(function (a) {
          var r = a * Math.PI / 180, x = 40 + Math.sin(r) * 28, y = 46 - Math.cos(r) * 28;
          o += line('M40 46L' + f(x) + ' ' + f(y), 'stg') + flower(f(x), f(y));
        });
        return o;
      case 'head':
        o = line('M40 78L40 40', 'stg') + circ(40, 30, 16, 'fl');
        for (var k = 0; k < 18; k++) o += circ(f(40 + Math.cos(k) * (k % 3 + 2) * 4), f(30 + Math.sin(k) * (k % 3 + 2) * 4), 1.4, 'fc');
        return o;
      case 'corymb':
        o = line('M40 78L40 14', 'stg');
        [[66, -28], [56, 28], [46, -18], [36, 18], [26, -8]].forEach(function (b) {
          o += line('M40 ' + b[0] + 'Q' + (40 + b[1] * .8) + ' ' + (b[0] - 6) + ' ' + (40 + b[1]) + ' 14', 'stg') + flower(40 + b[1], 12);
        });
        return o + flower(40, 12);
      case 'cyme':
        return line('M40 78L40 30M40 46L24 30M40 46L56 30M24 30L16 20M24 30L30 18M56 30L50 18M56 30L64 20', 'stg') +
          circ(40, 26, 6, 'fl') + flower(24, 28) + flower(56, 28) + flower(16, 18, 2.6) + flower(30, 16, 2.6) + flower(50, 16, 2.6) + flower(64, 18, 2.6);
    }
    return '';
  }

  function fruit(kind) {
    switch (kind) {
      case 'berry': return circ(40, 42, 24, 'fr') + circ(32, 38, 2.4, 'sd') + circ(46, 34, 2.4, 'sd') + circ(40, 50, 2.4, 'sd') + circ(50, 46, 2.4, 'sd') + circ(30, 50, 2.4, 'sd') + line('M40 18L42 8', 'st');
      case 'drupe': return '<path class="fr" d="M40 12C64 14 70 50 52 66C44 72 30 70 24 60C12 40 20 12 40 12Z"/><path class="pit" d="M40 26C52 28 54 48 46 56C40 60 32 56 30 48C28 36 32 26 40 26Z"/>';
      case 'legume': return '<path class="frp" d="M8 50Q40 22 74 30Q72 38 40 44Q20 50 10 58Z"/>' + circ(24, 47, 3.4, 'sd') + circ(36, 42, 3.4, 'sd') + circ(48, 38, 3.4, 'sd') + circ(60, 35, 3.4, 'sd');
      case 'capsule': return '<path class="frp" d="M40 70L22 52Q16 34 28 22L40 34Z M40 70L58 52Q64 34 52 22L40 34Z M40 34L32 14Q40 6 48 14Z"/>' + circ(36, 44, 2.6, 'sd') + circ(44, 48, 2.6, 'sd');
      case 'samara': return '<path class="frw" d="M30 56Q40 10 66 8Q58 30 38 60Z"/>' + circ(30, 60, 8, 'pit');
      case 'achene': return '<path class="pit" d="M40 18Q52 34 48 56Q40 64 32 56Q28 34 40 18Z"/>' + line('M40 18L40 8', 'v');
      case 'aggregate': var a = ''; [[40, 22], [32, 30], [48, 30], [26, 40], [40, 38], [54, 40], [32, 50], [48, 50], [40, 58]].forEach(function (p) { a += circ(p[0], p[1], 7, 'fr'); }); return a + line('M40 14L40 6', 'st');
      case 'multiple': var m = '<ellipse class="frg" cx="40" cy="42" rx="22" ry="30"/>'; for (var y = 20; y < 68; y += 8) for (var x = 24; x < 58; x += 8) m += circ(x + (y % 16 ? 4 : 0), y, 1.6, 'sd'); return m + line('M40 12L40 4', 'st');
      case 'hesperidium': return circ(40, 40, 26, 'frc') + circ(40, 40, 21, 'frcin') + '<path class="v" d="M40 40L40 19M40 40L58 30M40 40L58 50M40 40L40 61M40 40L22 50M40 40L22 30"/>';
      case 'pepo': return '<ellipse class="frg" cx="40" cy="42" rx="28" ry="24"/><path class="v" d="M40 18Q26 42 40 66M40 18Q54 42 40 66M40 18Q16 42 26 62M40 18Q64 42 54 62"/>';
    }
    return '';
  }

  function symmetry(kind) {
    if (kind === 'actinomorphic') {
      return [0, 72, 144, 216, 288].map(function (a) { return '<ellipse class="fl" cx="40" cy="22" rx="8" ry="14" transform="rotate(' + a + ' 40 40)"/>'; }).join('') +
        circ(40, 40, 6, 'fc') + line('M40 4L40 76M8 30L72 50M8 50L72 30', 'ax');
    }
    if (kind === 'zygomorphic') {
      return '<path class="fl" d="M40 8C62 8 70 30 56 42C50 46 44 40 40 40C36 40 30 46 24 42C10 30 18 8 40 8Z"/>' +
        '<path class="fl" d="M40 42C30 44 18 52 22 62C28 66 34 56 40 50Z M40 42C50 44 62 52 58 62C52 66 46 56 40 50Z"/>' +
        '<path class="fl" d="M34 52C34 64 40 72 40 72C40 72 46 64 46 52Z"/>' + line('M40 2L40 78', 'ax');
    }
    return '';
  }

  var BUILDERS = {
    leaf_shape: leafShape, leaf_apex: leafApex, leaf_base: leafBase, leaf_margin: leafMargin,
    leaf_type: leafType, leaf_arrangement: arrangement, leaf_venation: venation, habit: habit,
    bark: bark, flower_type: inflorescence, fruit_type: fruit, symmetry: symmetry
  };

  var cache = {};
  /** คืน HTML ของไอคอนจากค่าในคอลัมน์ icon */
  function render(icon) {
    if (!icon) return '';
    if (/^#[0-9a-f]{3,8}$/i.test(icon)) return '<span class="sw" style="background:' + icon + '"></span>';
    if (/^https?:\/\//.test(icon)) return '<img src="' + esc(icon) + '" alt="" style="width:72px;height:72px;object-fit:contain">';
    if (cache[icon] !== undefined) return cache[icon];
    var parts = icon.split('/');
    var b = BUILDERS[parts[0]];
    var inner = b ? b(parts[1]) : '';
    cache[icon] = inner ? svg(inner) : '';
    return cache[icon];
  }

  /** ไอคอนตัวแทนต้นไม้ตามลักษณะวิสัย (ใช้ตอนยังไม่มีรูป) */
  var HABIT_EMOJI = { 'ไม้ต้น': '🌳', 'ไม้พุ่ม': '🌿', 'ไม้ล้มลุก': '🌱', 'ไม้เลื้อย': '🍃', 'ไม้รอเลื้อย': '🍃', 'ปาล์ม': '🌴', 'ไผ่': '🎋', 'เฟิร์น': '🌿', 'กล้วยไม้': '🌸' };
  function habitEmoji(h) { return HABIT_EMOJI[h] || '🌳'; }

  return { render: render, habitEmoji: habitEmoji };
})();
