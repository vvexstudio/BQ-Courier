// DOM HUD — the dense "delivery app" layer over the 3D view.
//
// Owns every element declared in index.html: the order card (address, cargo,
// distance, countdown + timer bar), the score panel, the speedo, center
// toasts, and a live minimap. The minimap pre-renders the street network once
// to an offscreen canvas (it never changes), then each frame blits it and
// draws the dynamic bits: route, drop beacon, and the bike as a heading
// triangle. All coordinates fit the whole bbox — at ~600m that stays legible
// and beats implementing a scrolling camera for the MVP.

const COLORS = {
  mapBg: '#0d101c',
  road: '#3a4260',
  bikeLane: '#1d7a52',
  route: '#ffb02e',
  drop: '#ff4fa3',
  bike: '#39ff9a',
};

export function createHUD() {
  const el = (id) => document.getElementById(id);
  const els = {
    status: el('status'),
    order: el('order'),
    orderAddr: el('order-addr'),
    orderCargo: el('order-cargo'),
    orderDist: el('order-dist'),
    orderClock: el('order-clock'),
    timerFill: el('timerfill'),
    score: el('score'),
    delivered: el('delivered'),
    streak: el('streak'),
    kmh: el('kmh'),
    fps: el('fps'),
    toast: el('toast'),
    toastMain: el('toast-main'),
    toastSub: el('toast-sub'),
    minimap: el('minimap'),
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
    const pad = 14;
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
    ctx.drawImage(base, 0, 0);

    // Active route.
    if (delivery.phase === 'riding' && delivery.route) {
      ctx.strokeStyle = COLORS.route;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      delivery.route.forEach((p, i) => {
        const [mx, mz] = toMap(p.x, p.z);
        i === 0 ? ctx.moveTo(mx, mz) : ctx.lineTo(mx, mz);
      });
      ctx.stroke();
    }

    // Drop point.
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

    // Bike: a triangle pointing along heading. World forward is (-sin h, -cos h);
    // the triangle is drawn tip-up, and rotating a tip-up shape by -h makes its
    // tip track that forward vector on the north-up map.
    const [bx, bz] = toMap(bike.x, bike.z);
    ctx.save();
    ctx.translate(bx, bz);
    ctx.rotate(-bike.heading);
    ctx.fillStyle = COLORS.bike;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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

  function setStatus(msg) {
    els.status.textContent = msg;
  }

  const fmtClock = (s) => {
    const t = Math.max(0, Math.ceil(s));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };

  // Per-frame refresh of everything data-driven.
  function update(delivery, bike, kmh, fps) {
    els.kmh.textContent = kmh;
    els.fps.textContent = `${fps} fps`;

    els.score.textContent = delivery.score;
    els.delivered.textContent = delivery.delivered;
    els.streak.textContent = `×${delivery.streak} streak`;

    const active = delivery.phase === 'riding' && delivery.order;
    els.order.classList.toggle('hidden', !delivery.order);
    if (delivery.order) {
      els.orderAddr.textContent = delivery.order.name
        ? `${delivery.order.name} — ${delivery.order.label}`
        : delivery.order.label;
      els.orderCargo.textContent = `📦 ${delivery.order.cargo}`;
    }
    if (active) {
      els.orderDist.textContent = `${Math.round(delivery.distLeft)} m`;
      els.orderClock.textContent = fmtClock(delivery.timeLeft);
      const frac = Math.max(0, delivery.timeLeft / delivery.timeLimit);
      els.timerFill.style.width = `${frac * 100}%`;
      els.timerFill.className = frac < 0.2 ? 'low' : frac < 0.45 ? 'mid' : '';
      els.orderClock.classList.toggle('low', frac < 0.2);
    } else if (delivery.order) {
      els.orderDist.textContent = 'delivered';
      els.orderClock.textContent = '—';
    }

    drawMap(delivery, bike);
  }

  return { initMap, update, toast, setStatus };
}
