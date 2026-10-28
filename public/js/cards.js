// Card artwork as DOM (for the game) and as a 2D canvas (for Three.js textures).
// Both are drawn from the same glyph paths so the 3D cards match the real ones.

export const SUITS = ['ember', 'tide', 'moss', 'sol'];
export const SUIT_NAMES = { ember: 'Ember', tide: 'Tide', moss: 'Moss', sol: 'Sol' };
export const INK = { ember: '#c4452c', tide: '#2b4a9c', moss: '#2d6a4d', sol: '#cf9322', ink: '#1b1916', card: '#f7f2e8' };

// 24x24 suit glyphs
export const GLYPH = {
  ember: 'M12 2.5 21.5 20h-19Z', // flame as a sharp triangle
  tide: 'M2 9.5c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2.2 5-1.4M2 16c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2.2 5-1.4', // two waves
  moss: 'M12 2c5.5 4 5.5 16 0 20-5.5-4-5.5-16 0-20Z', // leaf
  sol: 'M12 5.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z', // sun disc
};
const STROKED = new Set(['tide']);

// 48x48 action icons
export const ICON = {
  surge: '<path d="M10 30 24 16l14 14M10 40 24 26l14 14" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="square"/><text x="24" y="13" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="700" font-size="11" fill="currentColor">+2</text>',
  eddy: '<path d="M36 18a14 14 0 0 0-25-2M12 30a14 14 0 0 0 25 2" fill="none" stroke="currentColor" stroke-width="4.5"/><path d="M8 8v10h10M40 40V30H30" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="square"/>',
  gift: '<path d="M8 20h32v22H8zM5 13h38v7H5zM24 13v29" fill="none" stroke="currentColor" stroke-width="4"/><path d="M24 13c-3-8-12-8-12-3s8 3 12 3c4 0 12 2 12-3s-9-5-12 3" fill="none" stroke="currentColor" stroke-width="3.5"/>',
  prism: `<path d="M24 3 45 24H24Z" fill="${INK.ember}"/><path d="M45 24 24 45V24Z" fill="${INK.sol}"/><path d="M24 45 3 24h21Z" fill="${INK.moss}"/><path d="M3 24 24 3v21Z" fill="${INK.tide}"/>`,
};

export function glyphSvg(suit, size = 24) {
  const stroked = STROKED.has(suit);
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${GLYPH[suit]}" ${stroked ? 'fill="none" stroke="currentColor" stroke-width="2.6"' : 'fill="currentColor"'}/></svg>`;
}

export function describe(c) {
  if (!c) return '';
  if (c.kind === 'prism') return 'Prism wild';
  const suit = SUIT_NAMES[c.suit];
  return c.kind === 'num' ? `${suit} ${c.rank}` : `${suit} ${c.kind}`;
}

/** Build a card element. Pass null for a face-down card. */
export function cardEl(c, { width, tag = 'div' } = {}) {
  const el = document.createElement(tag);
  if (width) el.style.setProperty('--cw', `${width}px`);
  if (!c) {
    el.className = 'card back';
    el.innerHTML = '<div class="face"><span><b>S</b></span></div>';
    return el;
  }
  el.dataset.id = c.id || '';
  if (c.kind === 'num') {
    el.className = `card ${c.suit} num`;
    const corner = `${c.rank}${glyphSvg(c.suit)}`;
    el.innerHTML = `<div class="corner">${corner}</div><div class="face">${c.rank}</div><div class="corner b">${corner}</div>`;
  } else if (c.kind === 'prism') {
    el.className = 'card prism action';
    el.innerHTML = `<div class="face"><svg viewBox="0 0 48 48" aria-hidden="true">${ICON.prism}</svg></div><div class="tag">Prism</div>`;
  } else {
    el.className = `card ${c.suit} action`;
    el.innerHTML = `<div class="corner">${glyphSvg(c.suit)}</div><div class="face"><svg viewBox="0 0 48 48" aria-hidden="true">${ICON[c.kind]}</svg></div><div class="tag">${c.kind}</div>`;
  }
  el.setAttribute('aria-label', describe(c));
  return el;
}

/* ---------- Canvas version, used for Three.js textures ---------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawGlyph(ctx, suit, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  const p = new Path2D(GLYPH[suit]);
  if (STROKED.has(suit)) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.stroke(p);
  } else {
    ctx.fillStyle = color;
    ctx.fill(p);
  }
  ctx.restore();
}

function drawIcon(ctx, svgInner, x, y, size) {
  // Rasterise the same SVG icon via an Image; returns a promise.
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, x, y, size, size);
      resolve();
    };
    img.onerror = resolve;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" color="${INK.card}" style="color:${INK.card}">${svgInner.replaceAll('currentColor', INK.card)}</svg>`)}`;
  });
}

/** Paint a card face (or back) onto a canvas at 500x700. */
export async function cardCanvas(c) {
  const W = 500;
  const H = 700;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const color = !c ? INK.sol : c.kind === 'prism' ? INK.card : INK[c.suit];
  const bg = !c || c.kind === 'prism' ? INK.ink : INK.card;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // dot texture
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  for (let y = 0; y < H; y += 30) for (let x = (y / 30) % 2 ? 15 : 0; x < W; x += 30) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = !c ? 'rgba(238,232,220,.45)' : color;
  ctx.lineWidth = 6;
  roundRect(ctx, 30, 30, W - 60, H - 60, 24);
  ctx.stroke();

  if (!c) {
    ctx.strokeStyle = 'rgba(238,232,220,.18)';
    ctx.lineWidth = 5;
    for (let r = 120; r < 460; r += 52) {
      ctx.beginPath();
      ctx.arc(W / 2, H + 80, r, Math.PI, 0);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = 'rgba(238,232,220,.6)';
    ctx.lineWidth = 4;
    ctx.strokeRect(-100, -100, 200, 200);
    ctx.restore();
    ctx.fillStyle = INK.card;
    ctx.font = '800 120px "Big Shoulders Display", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', W / 2, H / 2 + 6);
    return cv;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (c.kind === 'num') {
    ctx.fillStyle = color;
    ctx.font = '900 470px "Big Shoulders Display", sans-serif';
    ctx.fillText(String(c.rank), W / 2, H / 2 + 165);
    ctx.font = '800 100px "Big Shoulders Display", sans-serif';
    ctx.fillText(String(c.rank), 92, 142);
    drawGlyph(ctx, c.suit, 62, 158, 60, color);
    ctx.save();
    ctx.translate(W, H);
    ctx.rotate(Math.PI);
    ctx.fillText(String(c.rank), 92, 142);
    drawGlyph(ctx, c.suit, 62, 158, 60, color);
    ctx.restore();
  } else {
    if (c.kind !== 'prism') {
      ctx.fillStyle = color;
      roundRect(ctx, 90, 100, W - 180, H - 240, 20);
      ctx.fill();
      drawGlyph(ctx, c.suit, 50, 46, 44, color);
    }
    await drawIcon(ctx, ICON[c.kind], W / 2 - 150, H / 2 - 190, 300);
    ctx.fillStyle = c.kind === 'prism' ? INK.card : color;
    ctx.font = '700 44px "Geist Mono", monospace';
    ctx.fillText(c.kind.toUpperCase().split('').join(' '), W / 2, H - 62);
  }
  return cv;
}
