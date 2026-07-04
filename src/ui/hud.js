// DOM HUD — racing-game layout in the 16-bit skin.
//
// Photo-reference layout: deliveries counter top-left (the "checkpoint"
// block), a big elapsed clock top-center with the order countdown under it,
// crashes + score top-right, speedo bottom-left, and a round minimap bottom-
// right with a dotted route. All flat pixel text — no panels.
//
// The minimap pre-renders the street network once to an offscreen canvas (it
// never changes), then each frame blits it clipped to a circle and draws the
// dynamic bits: dotted route, drop dot, and the bike as a white arrow. All
// coordinates fit the whole bbox — at ~600m that stays legible and beats
// implementing a scrolling camera for the MVP.

const COLORS = {
  mapBg: 'rgba(14, 18, 30, 0.55)',
  road: 'rgba(255, 255, 255, 0.35)',
  bikeLane: 'rgba(57, 255, 154, 0.55)',
  route: '#ffffff',       // dotted white, like the reference
  drop: '#ff3b3b',        // red destination dot
  bike: '#ffffff',        // white player arrow
};

export function createHUD() {
  const el = (id) => document.getElementById(id);
  const els = {
    status: el('status'),
    elapsed: el('elapsed'),
    remaining: el('remaining'),
    orderline: el('orderline'),
    delivered: el('delivered'),
    streak: el('streak'),
    crashes: el('crashes'),
    scoreline: el('scoreline'),
    kmh: el('kmh'),
    fps: el('fps'),
    toast: el('toast'),
    toastMain: el('toast-main'),
    toastSub: el('toast-sub'),
    minimap: el('minimap'),
    ticker: el('ticker'),
    boostbar: el('boostbar'),
  };

  const ctx = els.minimap.getContext('2d');
  const W = els.minimap.width;
  const H = els.minimap.height;

  // World -> minimap transform, set once the road network is known.
  let base = null; // offscreen canvas with the static streets
  let toMap = null;

  function initMap(roadLines) {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const line of roadLines) {
      for (const p of line.pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
    }
    const pad = 26; // corners are clipped away by the circle; keep it inboard
    const scale = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
    const ox = (W - (maxX - minX) * scale) / 2;
    const oz = (H - (maxZ - minZ) * scale) / 2;
    toMap = (x, z) => [ox + (x - minX) * scale, oz + (z - minZ) * scale];

    base = document.createElement('canvas');
    base.width = W;
    base.height = H;
    const b = base.getContext('2d');
    b.fillStyle = COLORS.mapBg;
    b.fillRect(0, 0, W, H);
    b.lineCap = 'round';
    b.lineJoin = 'round';
    for (const line of roadLines) {
      b.strokeStyle = line.bike ? COLORS.bikeLane : COLORS.road;
      b.lineWidth = line.bike ? 2 : 2.5;
      b.beginPath();
      line.pts.forEach((p, i) => {
        const [mx, mz] = toMap(p.x, p.z);
        i === 0 ? b.moveTo(mx, mz) : b.lineTo(mx, mz);
      });
      b.stroke();
    }
  }

  function drawMap(delivery, bike) {
    if (!base) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // Everything clips to the circle — the canvas corners stay transparent.
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(base, 0, 0);

    // Active route: dotted white, like a paper map.
    if (delivery.phase === 'riding' && delivery.route) {
      ctx.strokeStyle = COLORS.route;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.setLineDash([2, 9]);
      ctx.beginPath();
      delivery.route.forEach((p, i) => {
        const [mx, mz] = toMap(p.x, p.z);
        i === 0 ? ctx.moveTo(mx, mz) : ctx.lineTo(mx, mz);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Drop point: pulsing red dot.
    if (delivery.order) {
      const [dx, dz] = toMap(delivery.order.dropX, delivery.order.dropZ);
      ctx.fillStyle = COLORS.drop;
      ctx.beginPath();
      ctx.arc(dx, dz, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.drop;
      ctx.lineWidth = 2;
      const pulse = 9 + 3 * Math.sin(performance.now() / 220);
      ctx.beginPath();
      ctx.arc(dx, dz, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bike: a white arrow along heading. World forward is (-sin h, -cos h);
    // the arrow is drawn tip-up, and rotating a tip-up shape by -h makes its
    // tip track that forward vector on the north-up map.
    const [bx, bz] = toMap(bike.x, bike.z);
    ctx.save();
    ctx.translate(bx, bz);
    ctx.rotate(-bike.heading);
    ctx.fillStyle = COLORS.bike;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // circle clip
  }

  // --- toasts ---
  let toastTimer = null;
  function toast(main, sub = '', bad = false) {
    els.toastMain.textContent = main;
    els.toastSub.textContent = sub;
    els.toast.classList.toggle('bad', bad);
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  // --- ticker: fast little score/event popups (near-misses, combos, wipeouts).
  // One line, latest event wins — at combo speed that reads as an update, not
  // as lost information.
  let tickerTimer = null;
  function ping(text, bad = false) {
    els.ticker.textContent = text;
    els.ticker.classList.toggle('bad', bad);
    els.ticker.classList.add('show');
    clearTimeout(tickerTimer);
    tickerTimer = setTimeout(() => els.ticker.classList.remove('show'), 1300);
  }

  function setStatus(msg) {
    els.status.textContent = msg;
  }

  // m:ss for the order countdown.
  const fmtClock = (s) => {
    const t = Math.max(0, Math.ceil(s));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
  // hh:mm:ss for the big elapsed clock, like the reference shot.
  const fmtElapsed = (s) => {
    const t = Math.max(0, Math.floor(s));
    const hh = String(Math.floor(t / 3600)).padStart(2, '0');
    const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  // Per-frame refresh of everything data-driven.
  function update(delivery, bike, kmh, fps, elapsed = 0) {
    els.kmh.textContent = kmh;
    els.fps.textContent = `${fps} fps`;
    els.elapsed.textContent = fmtElapsed(elapsed);

    // Boost meter: amber charging, green full, magenta while firing.
    const boost = bike.boost ?? 0;
    els.boostbar.style.width = `${Math.round(boost)}%`;
    els.boostbar.classList.toggle('full', boost >= 99.5 && !bike.boosting);
    els.boostbar.classList.toggle('firing', !!bike.boosting);

    els.delivered.textContent = delivery.delivered;
    els.streak.textContent = `×${delivery.streak} STREAK`;
    els.crashes.textContent = bike.crashes ?? 0;
    els.scoreline.textContent = `${delivery.score} PTS`;

    const active = delivery.phase === 'riding' && delivery.order;
    els.orderline.classList.toggle('hidden', !delivery.order);
    if (delivery.order) {
      els.orderline.textContent = active
        ? `${delivery.order.label.toUpperCase()} · ${Math.round(delivery.distLeft)}M · ${delivery.order.cargo.toUpperCase()}`
        : 'DELIVERED!';
    }
    if (active) {
      els.remaining.textContent = fmtClock(delivery.timeLeft);
      els.remaining.classList.toggle('low', delivery.timeLeft / delivery.timeLimit < 0.2);
    } else {
      els.remaining.textContent = '--:--';
      els.remaining.classList.remove('low');
    }

    drawMap(delivery, bike);
  }

  return { initMap, update, toast, ping, setStatus };
}
