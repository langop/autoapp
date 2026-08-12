const state = {
  view: 'home',
  previousView: 'home',
  user: null,
  favorites: [],
  dynamics: [],
  dynOffset: null,
  dynHasMore: false,
  dynLoading: false,
  selectedDyn: null,
  comments: [],
  cmtPage: 1,
  cmtHasMore: false,
  cmtLoading: false,
  cmtSort: 'time',
  lightbox: {
    open: false,
    urls: [],
    index: 0,
    scale: 1,
    panX: 0,
    panY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    panStartX: 0,
    panStartY: 0,
    suppressClose: false,
  },
  pinnedExpanded: false,
  cmtSourceExpanded: false,
  playerReturnView: 'dynamics',
  dynamicsBackView: 'profile',
};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showView(name) {
  if (name === 'settings' && state.view !== 'settings') {
    state.previousView = state.view || 'home';
  }
  state.view = name;
  for (const id of [
    'view-home',
    'view-profile',
    'view-dynamics',
    'view-comments',
    'view-settings',
    'view-player',
  ]) {
    $(id).classList.toggle('hidden', id !== `view-${name}`);
  }
}

function scrollDynamicsToTop() {
  const list = $('dyn-list');
  if (list) list.scrollTop = 0;
}

function shouldShowDynTypeLabel(label) {
  const text = String(label || '').trim();
  if (!text) return false;
  return text !== '图文' && text !== '视频';
}

function dynTypeBadgeHtml(d) {
  if (!shouldShowDynTypeLabel(d?.label)) return '';
  return `<span class="dyn-badge">${escapeHtml(d.label)}</span>`;
}

function dynSourceLabelHtml(d) {
  if (!shouldShowDynTypeLabel(d?.label)) return '';
  return `<span class="label">${escapeHtml(d.label)}</span>`;
}

function renderCommentSource(d) {
  const source = $('cmt-source');
  if (!d) {
    source.innerHTML = '';
    source.classList.remove('is-collapsed', 'is-expanded');
    return;
  }
  const expanded = Boolean(state.cmtSourceExpanded);
  const title = String(d.title || '').replace(/^\s+/, '');
  const text = String(d.text || '').replace(/^\s+/, '');
  const preview =
    title ||
    (text ? text.replace(/\s+/g, ' ').trim() : '') ||
    '（无正文）';
  const titleHtml = title
    ? `<div class="cmt-source-title">${escapeHtml(title)}</div>`
    : '';
  const textHtml = text
    ? `<div class="cmt-source-text">${escapeHtml(text)}</div>`
    : '';
  const emptyHtml =
    !title && !text ? '<div class="cmt-source-text">（无正文）</div>' : '';
  source.classList.toggle('is-collapsed', !expanded);
  source.classList.toggle('is-expanded', expanded);
  source.innerHTML = `
    <button type="button" class="cmt-source-toggle" aria-expanded="${expanded ? 'true' : 'false'}">
      <span class="cmt-source-toggle-main">
        ${dynSourceLabelHtml(d)}
        <span class="cmt-source-preview">${escapeHtml(preview)}</span>
      </span>
      <span class="cmt-source-chevron" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
    </button>
    <div class="cmt-source-body">
      ${titleHtml}${textHtml}${emptyHtml}
    </div>
  `;
  source.querySelector('.cmt-source-toggle').addEventListener('click', () => {
    state.cmtSourceExpanded = !state.cmtSourceExpanded;
    renderCommentSource(d);
  });
}

const FAB_NEAR_BOTTOM_PX = 140;

function isScrollNearBottom(el) {
  if (!el) return false;
  const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
  return remaining <= FAB_NEAR_BOTTOM_PX;
}

function updateLoadMoreFab(listId, btnId, { hasMore, loading }) {
  const btn = $(btnId);
  const list = $(listId);
  if (!btn) return;
  if (!hasMore) {
    btn.classList.add('hidden');
    btn.disabled = true;
    return;
  }
  const show = isScrollNearBottom(list);
  btn.classList.toggle('hidden', !show);
  btn.disabled = Boolean(loading);
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString();
}

function dayKey(ts) {
  if (!ts) return 'unknown';
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDayLabel(ts) {
  if (!ts) return '未知日期';
  const d = new Date(ts * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - that) / 86400000);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const datePart =
    d.getFullYear() === now.getFullYear()
      ? `${d.getMonth() + 1}月${d.getDate()}日`
      : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  let hint = weekdays[d.getDay()];
  if (diff === 0) hint = '今天';
  else if (diff === 1) hint = '昨天';
  return `${datePart}（${hint}）`;
}

function fmtClock(ts) {
  if (!ts) return '--:--';
  const d = new Date(ts * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtFullDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day} ${fmtClock(ts)}`;
}

function groupDynamicsByDay(items) {
  const groups = [];
  const map = new Map();
  for (const item of items) {
    const key = dayKey(item.publishTime);
    let group = map.get(key);
    if (!group) {
      group = { key, label: fmtDayLabel(item.publishTime), items: [] };
      map.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function splitDynamics(items) {
  const pinned = [];
  const rest = [];
  for (const item of items) {
    if (item.isTop) pinned.push(item);
    else rest.push(item);
  }
  return { pinned, dayGroups: groupDynamicsByDay(rest) };
}

async function call(fn, ...args) {
  const res = await fn(...args);
  if (res && res.error) {
    const err = new Error(res.error.message || '请求失败');
    err.code = res.error.code;
    err.retryable = res.error.retryable;
    throw err;
  }
  return res;
}

async function confirmRemoveFavorite(fav) {
  const name = fav.name || `UID ${fav.uid}`;
  if (!window.confirm(`确定取消收藏「${name}」？`)) return;
  try {
    await call(window.biliApi.removeFavorite, fav.uid);
    await refreshFavorites();
  } catch (e) {
    $('home-error').textContent = e.message || '取消收藏失败';
  }
}

const FAV_DRAG_THRESHOLD_PX = 8;

function clearFavDragStyles(root) {
  root.querySelectorAll('.fav-card.dragging, .fav-card.drag-over').forEach((el) => {
    el.classList.remove('dragging', 'drag-over');
  });
}

async function persistFavoriteOrder(box) {
  const uids = [...box.querySelectorAll('.fav-card')].map((el) => el.dataset.uid);
  try {
    await call(window.biliApi.reorderFavorites, uids);
    await refreshFavorites();
  } catch (e) {
    $('home-error').textContent = e.message || '排序保存失败';
    await refreshFavorites();
  }
}

async function refreshFavorites() {
  state.favorites = await call(window.biliApi.listFavorites);
  const box = $('fav-list');
  box.innerHTML = '';
  if (!state.favorites.length) {
    box.innerHTML = '<p class="muted">暂无收藏</p>';
    return;
  }
  let favDragSnapshot = null;

  state.favorites.forEach((fav, index) => {
    const el = document.createElement('div');
    el.className = `fav-card tone-${index % 4}`;
    el.dataset.uid = String(fav.uid);
    el.draggable = true;
    el.innerHTML = `
      <div class="fav-row fav-row-main">
        <img class="fav-avatar" draggable="false" src="${escapeHtml(toDisplayUrl(fav.avatar || ''))}" alt="" />
        <div class="fav-name">${escapeHtml(fav.name || '未知 UP')}</div>
      </div>
      <div class="fav-row fav-row-meta">
        <div class="muted fav-uid">UID ${escapeHtml(fav.uid)}</div>
        <div class="fav-actions">
          <button class="fav-notify${fav.notifyEnabled ? ' active' : ''}" type="button">提醒</button>
          <button class="fav-unfav" type="button">移除</button>
        </div>
      </div>
    `;
    const avatar = el.querySelector('.fav-avatar');
    if (avatar) avatar.draggable = false;

    let pointerDown = null;
    let suppressClick = false;

    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.fav-actions')) return;
      pointerDown = { x: e.clientX, y: e.clientY };
      suppressClick = false;
    });

    el.addEventListener('dragstart', (e) => {
      if (e.target.closest?.('.fav-actions')) {
        e.preventDefault();
        return;
      }
      suppressClick = true;
      favDragSnapshot = [...box.querySelectorAll('.fav-card')];
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(fav.uid));
      box.classList.add('reordering');
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const over = e.currentTarget;
      if (over.classList.contains('dragging')) return;
      box.querySelectorAll('.fav-card.drag-over').forEach((n) => {
        if (n !== over) n.classList.remove('drag-over');
      });
      over.classList.add('drag-over');
      const dragging = box.querySelector('.fav-card.dragging');
      if (!dragging || dragging === over) return;
      const cards = [...box.querySelectorAll('.fav-card')];
      const from = cards.indexOf(dragging);
      const to = cards.indexOf(over);
      if (from < 0 || to < 0 || from === to) return;
      if (from < to) over.after(dragging);
      else over.before(dragging);
    });

    el.addEventListener('dragleave', (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-over');
      }
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      clearFavDragStyles(box);
      box.classList.remove('reordering');
    });

    // Prefer dragend persist (Windows-stable); avoid double-save with drop
    el.addEventListener('dragend', async (e) => {
      const cancelled = e.dataTransfer?.dropEffect === 'none';
      if (cancelled && favDragSnapshot) {
        for (const card of favDragSnapshot) {
          box.appendChild(card);
        }
      }
      favDragSnapshot = null;
      const uids = [...box.querySelectorAll('.fav-card')].map((n) => n.dataset.uid);
      const before = state.favorites.map((f) => String(f.uid));
      clearFavDragStyles(box);
      box.classList.remove('reordering');
      pointerDown = null;
      if (!cancelled && uids.join(',') !== before.join(',')) {
        await persistFavoriteOrder(box);
      }
    });

    const notifyBtn = el.querySelector('.fav-notify');
    notifyBtn.onclick = async (e) => {
      e.stopPropagation();
      const next = !fav.notifyEnabled;
      try {
        await call(window.biliApi.setFavoriteNotify, fav.uid, next);
        await refreshFavorites();
      } catch (err) {
        $('home-error').textContent = err.message || '提醒设置失败';
      }
    };
    notifyBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    const unfavBtn = el.querySelector('.fav-unfav');
    unfavBtn.onclick = (e) => {
      e.stopPropagation();
      confirmRemoveFavorite(fav);
    };
    unfavBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });

    el.onclick = (e) => {
      if (e.target.closest('.fav-actions')) return;
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (pointerDown) {
        const dx = e.clientX - pointerDown.x;
        const dy = e.clientY - pointerDown.y;
        if (Math.hypot(dx, dy) >= FAV_DRAG_THRESHOLD_PX) return;
      }
      openFavoriteDynamics(fav.uid);
    };
    box.appendChild(el);
  });
}

function renderProfile() {
  const u = state.user;
  $('profile-card').innerHTML = `
    <img src="${escapeHtml(toDisplayUrl(u.avatar))}" alt="" />
    <div>
      <h2 style="margin:0 0 6px">${escapeHtml(u.name)}</h2>
      <div class="muted">UID ${escapeHtml(u.uid)} · Lv.${escapeHtml(u.level)} · 粉丝 ${escapeHtml(u.fans)}</div>
      <p>${escapeHtml(u.sign || '（无签名）')}</p>
    </div>
  `;
  const saved = state.favorites.some((x) => String(x.uid) === String(u.uid));
  $('btn-toggle-fav').textContent = saved ? '取消收藏' : '收藏';
}

async function prepareUser(uid) {
  state.user = await call(window.biliApi.getUserInfo, String(uid).trim());
  state.dynamics = [];
  state.dynOffset = null;
  state.dynHasMore = false;
  state.selectedDyn = null;
  state.comments = [];
}

async function openProfile(uid) {
  $('home-error').textContent = '';
  $('profile-error').textContent = '';
  try {
    await prepareUser(uid);
    await refreshFavorites();
    renderProfile();
    showView('profile');
  } catch (e) {
    if (state.view === 'home') $('home-error').textContent = e.message;
    else $('profile-error').textContent = e.message;
  }
}

async function openFavoriteDynamics(uid) {
  $('home-error').textContent = '';
  try {
    await prepareUser(uid);
    state.dynamicsBackView = 'home';
    await openDynamics();
  } catch (e) {
    $('home-error').textContent = e.message;
  }
}

let notifyToastTimer = null;
let notifyToastUid = '';

function showNotifyToast(payload) {
  const el = $('notify-toast');
  notifyToastUid = String(payload?.uid || '');
  $('notify-toast-title').textContent = payload?.title || '动态更新';
  $('notify-toast-body').textContent = payload?.body || '';
  el.classList.remove('hidden');
  if (notifyToastTimer) clearTimeout(notifyToastTimer);
  notifyToastTimer = setTimeout(() => {
    el.classList.add('hidden');
    notifyToastTimer = null;
  }, 8000);
}

function updateDynamicsBackLabel() {
  $('btn-back-profile').textContent =
    state.dynamicsBackView === 'home' ? '← 首页' : '← 资料';
}

async function openDynamics() {
  updateDynamicsBackLabel();
  showView('dynamics');
  scrollDynamicsToTop();
  await loadDynamics(true);
  scrollDynamicsToTop();
}

function toDisplayUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let raw = url.trim();
  if (!raw) return '';
  if (raw.startsWith('//')) raw = `https:${raw}`;
  if (raw.startsWith('http://')) raw = `https://${raw.slice('http://'.length)}`;
  try {
    const u = new URL(raw);
    const host = u.hostname;
    if (
      host.endsWith('hdslb.com') ||
      host.endsWith('bilibili.com') ||
      host.endsWith('bilivideo.com')
    ) {
      return `bili-media://${host}${u.pathname}${u.search}`;
    }
  } catch {
    return raw;
  }
  return raw;
}

function mediaImg(src, className = '', attrs = '') {
  const display = toDisplayUrl(src);
  return `<img class="${className}" src="${escapeHtml(display)}" alt="" loading="lazy" ${attrs} />`;
}

function isVideoDyn(d) {
  return d.kind === 'DYNAMIC_TYPE_AV' || d.kind === 'DYNAMIC_TYPE_PGC';
}

function dynImageGallery(d) {
  const pics = Array.isArray(d.pics) ? d.pics.filter(Boolean) : [];
  if (isVideoDyn(d)) return pics;
  if (d.cover && !pics.includes(d.cover)) return [d.cover, ...pics];
  if (pics.length) return pics;
  return d.cover ? [d.cover] : [];
}

const LB_SCALE_MIN = 1;
const LB_SCALE_MAX = 5;
const LB_SCALE_STEP = 0.25;

function clampLightboxScale(scale) {
  return Math.min(LB_SCALE_MAX, Math.max(LB_SCALE_MIN, scale));
}

function resetLightboxTransform() {
  const lb = state.lightbox;
  lb.scale = 1;
  lb.panX = 0;
  lb.panY = 0;
  lb.dragging = false;
  lb.suppressClose = false;
}

function applyLightboxTransform() {
  const lb = state.lightbox;
  const img = $('lb-img');
  const stage = $('lb-stage');
  img.style.transform = `translate(${lb.panX}px, ${lb.panY}px) scale(${lb.scale})`;
  stage.classList.toggle('is-zoomed', lb.scale > 1.01);
  $('lb-zoom-label').textContent = `${Math.round(lb.scale * 100)}%`;
  $('lb-zoom-out').disabled = lb.scale <= LB_SCALE_MIN + 0.001;
  $('lb-zoom-in').disabled = lb.scale >= LB_SCALE_MAX - 0.001;
  $('lb-zoom-reset').disabled = lb.scale <= LB_SCALE_MIN + 0.001;
}

function setLightboxScale(nextScale, anchorX, anchorY) {
  const lb = state.lightbox;
  const prev = lb.scale;
  const scale = clampLightboxScale(nextScale);
  if (Math.abs(scale - prev) < 0.001) {
    applyLightboxTransform();
    return;
  }
  if (scale <= LB_SCALE_MIN) {
    lb.scale = 1;
    lb.panX = 0;
    lb.panY = 0;
  } else if (anchorX != null && anchorY != null) {
    const stage = $('lb-stage').getBoundingClientRect();
    const cx = anchorX - (stage.left + stage.width / 2);
    const cy = anchorY - (stage.top + stage.height / 2);
    lb.panX = cx - ((cx - lb.panX) * scale) / prev;
    lb.panY = cy - ((cy - lb.panY) * scale) / prev;
    lb.scale = scale;
  } else {
    lb.scale = scale;
  }
  applyLightboxTransform();
}

function renderLightbox() {
  const lb = state.lightbox;
  const root = $('lightbox');
  if (!lb.open || !lb.urls.length) {
    root.classList.add('hidden');
    root.setAttribute('aria-hidden', 'true');
    return;
  }
  root.classList.remove('hidden');
  root.setAttribute('aria-hidden', 'false');
  $('lb-img').src = toDisplayUrl(lb.urls[lb.index]);
  $('lb-counter').textContent = `${lb.index + 1} / ${lb.urls.length}`;
  $('lb-prev').disabled = lb.urls.length <= 1;
  $('lb-next').disabled = lb.urls.length <= 1;
  applyLightboxTransform();
}

function openLightbox(urls, index = 0) {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return;
  state.lightbox.open = true;
  state.lightbox.urls = list;
  state.lightbox.index = Math.max(0, Math.min(index, list.length - 1));
  resetLightboxTransform();
  renderLightbox();
}

function closeLightbox() {
  state.lightbox.open = false;
  state.lightbox.urls = [];
  state.lightbox.index = 0;
  resetLightboxTransform();
  $('lb-img').removeAttribute('src');
  applyLightboxTransform();
  renderLightbox();
}

function stepLightbox(delta) {
  const lb = state.lightbox;
  if (!lb.open || lb.urls.length <= 1) return;
  lb.index = (lb.index + delta + lb.urls.length) % lb.urls.length;
  resetLightboxTransform();
  renderLightbox();
}

function buildPlayerUrl(d) {
  if (d?.bvid) {
    return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(d.bvid)}&high_quality=1&danmaku=0&autoplay=1`;
  }
  if (d?.type === 1 && d?.oid) {
    return `https://player.bilibili.com/player.html?aid=${encodeURIComponent(d.oid)}&high_quality=1&danmaku=0&autoplay=1`;
  }
  if (d?.jumpUrl) return d.jumpUrl;
  return '';
}

function openVideoLink(d) {
  const url = buildPlayerUrl(d);
  if (!url) {
    $('dyn-error').textContent = '暂无可播放地址';
    return;
  }
  state.playerReturnView =
    state.view && state.view !== 'player' ? state.view : 'dynamics';
  $('player-title').textContent = d.title || '视频';
  $('player-error').textContent = '';
  const wv = $('player-webview');
  try {
    wv.src = url;
  } catch (e) {
    $('player-error').textContent = e.message || '播放器打开失败';
  }
  showView('player');
}

function closePlayer() {
  const wv = $('player-webview');
  try {
    if (typeof wv.stop === 'function') wv.stop();
  } catch {
    /* ignore */
  }
  try {
    wv.src = 'about:blank';
  } catch {
    /* ignore */
  }
  showView(state.playerReturnView || 'dynamics');
}

function renderDynMedia(d) {
  const pics = Array.isArray(d.pics) ? d.pics.filter(Boolean).slice(0, 9) : [];
  const cover = d.cover || '';
  const isVideo = isVideoDyn(d);
  const canOpenVideo =
    isVideo && Boolean(d.jumpUrl || d.bvid || (d.type === 1 && d.oid));
  const gallery = dynImageGallery(d);

  const videoFrame = (coverSrc) => `
    <div class="media-frame is-video ${canOpenVideo ? 'is-clickable' : ''}"
         data-media="${canOpenVideo ? 'video' : ''}"
         role="${canOpenVideo ? 'button' : ''}"
         ${canOpenVideo ? 'tabindex="0"' : ''}>
      ${mediaImg(coverSrc, 'dyn-cover')}
      <span class="play-badge">${canOpenVideo ? '播放视频' : '视频'}</span>
    </div>
  `;

  const picAt = (src, index, className = 'is-clickable') =>
    mediaImg(
      src,
      className,
      `data-media="pic" data-index="${index}" role="button" tabindex="0"`,
    );

  const picGrid = (list, cols, indexOffset = 0) => `
    <div class="dyn-pics ${cols}">
      ${list.map((src, i) => picAt(src, indexOffset + i)).join('')}
    </div>
  `;

  if (cover && !pics.length) {
    if (isVideo) {
      return `<div class="dyn-media video-cover">${videoFrame(cover)}</div>`;
    }
    return `
      <div class="dyn-media only-cover">
        <div class="media-frame is-clickable" data-media="pic" data-index="0" role="button" tabindex="0">
          ${mediaImg(cover, 'dyn-cover')}
        </div>
      </div>
    `;
  }

  if (!cover && pics.length) {
    const cols = pics.length === 1 ? 'one' : pics.length === 2 ? 'two' : 'three';
    return picGrid(pics, cols, 0);
  }

  if (cover && pics.length) {
    if (isVideo) {
      return `
        <div class="dyn-media with-side">
          ${videoFrame(cover)}
          ${picGrid(pics.slice(0, 6), 'three', 0)}
        </div>
      `;
    }
    const coverIndex = gallery.indexOf(cover);
    const picOffset = coverIndex === 0 ? 1 : 0;
    return `
      <div class="dyn-media with-side">
        <div class="media-frame is-clickable" data-media="pic" data-index="${Math.max(coverIndex, 0)}" role="button" tabindex="0">
          ${mediaImg(cover, 'dyn-cover')}
        </div>
        ${picGrid(pics.slice(0, 6), 'three', picOffset)}
      </div>
    `;
  }

  if (!gallery.length) return '';
  const cols = gallery.length === 1 ? 'one' : gallery.length === 2 ? 'two' : 'three';
  return picGrid(gallery, cols, 0);
}

function bindDynMedia(el, d) {
  el.querySelectorAll('[data-media="pic"]').forEach((node) => {
    const open = (e) => {
      e.stopPropagation();
      const idx = Number(node.getAttribute('data-index') || 0);
      openLightbox(dynImageGallery(d), idx);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(e);
      }
    });
  });

  const video = el.querySelector('[data-media="video"]');
  if (video) {
    const open = (e) => {
      e.stopPropagation();
      openVideoLink(d);
    };
    video.addEventListener('click', open);
    video.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(e);
      }
    });
  }
}

function createDynCard(d, { pinned = false } = {}) {
  const el = document.createElement('div');
  el.className = pinned ? 'dyn-card is-pinned' : 'dyn-card';
  const titleHtml = d.title
    ? `<div class="dyn-title">${escapeHtml(d.title)}</div>`
    : '';
  const textHtml = d.text
    ? `<div class="dyn-text">${escapeHtml(d.text)}</div>`
    : '';
  const typeBadge = dynTypeBadgeHtml(d);
  const goLabel = d.commentSupported ? '查看评论 →' : '暂无评论入口';
  if (pinned) {
    el.innerHTML = `
      <div class="dyn-main">
        <div class="dyn-top">
          <span class="dyn-badge pin">置顶</span>
          ${typeBadge}
          <span class="dyn-fulltime">${escapeHtml(fmtFullDateTime(d.publishTime))}</span>
        </div>
        ${titleHtml}
        ${textHtml}
        ${renderDynMedia(d)}
        <div class="dyn-meta muted">
          <span>评论 ${escapeHtml(d.stat.comment)} · 赞 ${escapeHtml(d.stat.like)}</span>
          <span class="dyn-go">${goLabel}</span>
        </div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="dyn-time-col" aria-label="发布时间">
        <span class="dyn-clock">${escapeHtml(fmtClock(d.publishTime))}</span>
        <span class="dyn-time-dot"></span>
      </div>
      <div class="dyn-main">
        ${typeBadge ? `<div class="dyn-top">${typeBadge}</div>` : ''}
        ${titleHtml}
        ${textHtml}
        ${renderDynMedia(d)}
        <div class="dyn-meta muted">
          <span>评论 ${escapeHtml(d.stat.comment)} · 赞 ${escapeHtml(d.stat.like)}</span>
          <span class="dyn-go">${goLabel}</span>
        </div>
      </div>
    `;
  }
  el.onclick = () => openComments(d);
  bindDynMedia(el, d);
  return el;
}

function appendDynSection(box, { className, label, count, items, pinned = false }) {
  if (!items.length) return;
  const section = document.createElement('section');
  section.className = className;
  if (pinned) {
    const expanded = Boolean(state.pinnedExpanded);
    section.classList.toggle('is-collapsed', !expanded);
    section.innerHTML = `
      <button type="button" class="dyn-day-head dyn-pinned-toggle" aria-expanded="${expanded ? 'true' : 'false'}">
        <span class="dyn-day-label">${escapeHtml(label)}</span>
        <span class="dyn-pinned-meta">
          <span class="dyn-day-count">${count} 条</span>
          <span class="dyn-pinned-chevron" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
        </span>
      </button>
    `;
    const list = document.createElement('div');
    list.className = 'dyn-day-list pinned-list';
    for (const d of items) list.appendChild(createDynCard(d, { pinned }));
    section.appendChild(list);
    section.querySelector('.dyn-pinned-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      state.pinnedExpanded = !state.pinnedExpanded;
      const open = state.pinnedExpanded;
      section.classList.toggle('is-collapsed', !open);
      e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
      const chevron = section.querySelector('.dyn-pinned-chevron');
      if (chevron) chevron.textContent = open ? '▾' : '▸';
      updateLoadMoreFab('dyn-list', 'btn-more-dyn', {
        hasMore: state.dynHasMore,
        loading: state.dynLoading,
      });
    });
  } else {
    section.innerHTML = `
      <div class="dyn-day-head">
        <span class="dyn-day-label">${escapeHtml(label)}</span>
        <span class="dyn-day-count">${count} 条</span>
      </div>
    `;
    const list = document.createElement('div');
    list.className = 'dyn-day-list';
    for (const d of items) list.appendChild(createDynCard(d, { pinned }));
    section.appendChild(list);
  }
  box.appendChild(section);
}

function renderDynamics() {
  const box = $('dyn-list');
  box.innerHTML = '';
  const { pinned, dayGroups } = splitDynamics(state.dynamics);
  $('dyn-count').textContent = state.dynamics.length
    ? `${state.dynamics.length} 条 · ${dayGroups.length} 天${pinned.length ? ` · 置顶 ${pinned.length}` : ''}`
    : '';

  if (!state.dynamics.length) {
    box.innerHTML = '<p class="muted empty-hint">暂无动态</p>';
  }

  appendDynSection(box, {
    className: 'dyn-day dyn-pinned',
    label: '置顶',
    count: pinned.length,
    items: pinned,
    pinned: true,
  });

  for (const group of dayGroups) {
    appendDynSection(box, {
      className: 'dyn-day',
      label: group.label,
      count: group.items.length,
      items: group.items,
      pinned: false,
    });
  }

  updateLoadMoreFab('dyn-list', 'btn-more-dyn', {
    hasMore: state.dynHasMore,
    loading: state.dynLoading,
  });
  $('btn-refresh-dyn').disabled = state.dynLoading;
}

function renderCommentText(comment) {
  let html = escapeHtml(comment.content || '');
  const emotes = Array.isArray(comment.emotes) ? comment.emotes : [];
  // Replace longer emote codes first to avoid partial overlaps.
  const sorted = [...emotes].sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));
  for (const emote of sorted) {
    if (!emote.text || !emote.url) continue;
    const token = escapeHtml(emote.text);
    const img = mediaImg(emote.url, 'cmt-emote');
    html = html.split(token).join(img);
  }
  const pics = Array.isArray(comment.pics) ? comment.pics.filter(Boolean) : [];
  const picsHtml = pics.length
    ? `<div class="cmt-pics">${pics
        .map(
          (src, i) =>
            mediaImg(
              src,
              'cmt-pic is-clickable',
              `data-media="pic" data-index="${i}" data-origin="${escapeHtml(src)}" role="button" tabindex="0"`,
            ),
        )
        .join('')}</div>`
    : '';
  return `${html ? `<div class="post-text">${html}</div>` : ''}${picsHtml}`;
}

function bindCommentMedia(root) {
  root.querySelectorAll('.cmt-pics').forEach((group) => {
    const nodes = [...group.querySelectorAll('[data-media="pic"]')];
    const gallery = nodes.map((n) => n.getAttribute('data-origin') || n.getAttribute('src') || '');
    nodes.forEach((node, i) => {
      const open = (e) => {
        e.stopPropagation();
        openLightbox(gallery, Number(node.getAttribute('data-index') || i));
      };
      node.addEventListener('click', open);
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open(e);
        }
      });
    });
  });
}

function isUpComment(comment) {
  const upUid = state.user?.uid;
  if (!upUid || !comment?.mid) return false;
  return String(comment.mid) === String(upUid);
}

function isCjkChar(ch) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(ch);
}

function displayCommentName(comment, isUp) {
  if (isUp) return '';
  const name = String(comment?.uname || '');
  if (!name) return name;
  const limit = isCjkChar(name[0]) ? 2 : 4;
  if (name.length <= limit) return name;
  return `${name.slice(0, limit)}...`;
}

function commentNameHtml(comment, isUp) {
  const name = displayCommentName(comment, isUp);
  if (!name) return '';
  return `<strong title="${escapeHtml(comment.uname || '')}">${escapeHtml(name)}</strong>`;
}

function renderReplyBlock(r) {
  const up = isUpComment(r);
  return `
    <div class="post-reply${up ? ' is-up' : ''}">
      <div class="post-head">
        ${up ? '<span class="up-badge">UP</span>' : ''}
        ${commentNameHtml(r, up)}
        <span class="muted post-like">赞 ${escapeHtml(r.like)}</span>
        <span class="muted post-time">${escapeHtml(fmtTime(r.ctime))}</span>
      </div>
      <div class="post-body">${renderCommentText(r)}</div>
    </div>
  `;
}

function sortCommentList(items) {
  const list = Array.isArray(items) ? [...items] : [];
  if (state.cmtSort === 'hot') {
    list.sort(
      (a, b) =>
        Number(b.like || 0) - Number(a.like || 0) ||
        Number(b.ctime || 0) - Number(a.ctime || 0),
    );
  } else {
    list.sort((a, b) => Number(b.ctime || 0) - Number(a.ctime || 0));
  }
  return list.map((c) => ({
    ...c,
    replies: sortCommentList(c.replies || []),
  }));
}

function updateCommentSortButtons() {
  $('btn-cmt-sort-time').classList.toggle('active', state.cmtSort === 'time');
  $('btn-cmt-sort-hot').classList.toggle('active', state.cmtSort === 'hot');
}

async function setCommentSort(mode) {
  if (mode !== 'time' && mode !== 'hot') return;
  if (state.cmtSort === mode) return;
  state.cmtSort = mode;
  updateCommentSortButtons();
  if (!state.selectedDyn?.commentSupported) {
    renderComments();
    return;
  }
  await loadComments(true);
}

function renderComments() {
  const box = $('cmt-list');
  box.innerHTML = '';
  const comments = sortCommentList(state.comments);
  comments.forEach((c, index) => {
    const el = document.createElement('article');
    const up = isUpComment(c);
    el.className = up ? 'post is-up' : 'post';
    const floor = index + 1;
    const subs = (c.replies || []).map(renderReplyBlock).join('');
    el.innerHTML = `
      <div class="post-main">
        <div class="post-head">
          <span class="post-floor">#${floor}</span>
          ${up ? '<span class="up-badge">UP</span>' : ''}
          ${commentNameHtml(c, up)}
          <span class="muted post-like">赞 ${escapeHtml(c.like)}</span>
          <span class="muted post-time">${escapeHtml(fmtTime(c.ctime))}</span>
        </div>
        <div class="post-body">${renderCommentText(c)}</div>
        ${subs ? `<div class="post-replies">${subs}</div>` : ''}
      </div>
    `;
    box.appendChild(el);
  });
  bindCommentMedia(box);
  updateCommentSortButtons();
  updateLoadMoreFab('cmt-list', 'btn-more-cmt', {
    hasMore: state.cmtHasMore,
    loading: state.cmtLoading,
  });
}

async function loadDynamics(reset) {
  if (state.dynLoading) return;
  state.dynLoading = true;
  $('btn-more-dyn').disabled = true;
  $('btn-refresh-dyn').disabled = true;
  $('dyn-error').textContent = '';
  try {
    if (reset) {
      state.dynamics = [];
      state.dynOffset = null;
      state.selectedDyn = null;
      state.comments = [];
      state.cmtHasMore = false;
      state.pinnedExpanded = false;
      renderCommentSource(null);
      $('cmt-hint').textContent = '';
      renderComments();
    }
    const res = await call(window.biliApi.getDynamics, {
      uid: state.user.uid,
      offset: reset ? '' : state.dynOffset || '',
    });
    state.dynamics = reset ? res.items : state.dynamics.concat(res.items);
    state.dynOffset = res.nextOffset;
    state.dynHasMore = res.hasMore;
    renderDynamics();
    if (reset) scrollDynamicsToTop();
  } catch (e) {
    $('dyn-error').textContent = e.message;
    renderDynamics();
    if (reset) scrollDynamicsToTop();
  } finally {
    state.dynLoading = false;
    updateLoadMoreFab('dyn-list', 'btn-more-dyn', {
      hasMore: state.dynHasMore,
      loading: false,
    });
    $('btn-refresh-dyn').disabled = false;
  }
}

async function openComments(d) {
  state.selectedDyn = d;
  state.comments = [];
  state.cmtPage = 1;
  state.cmtHasMore = false;
  state.cmtSort = 'time';
  state.cmtSourceExpanded = false;
  $('cmt-error').textContent = '';
  updateCommentSortButtons();
  renderCommentSource(d);
  renderComments();
  showView('comments');

  if (!d.commentSupported) {
    $('cmt-hint').textContent = '该类型暂不支持加载评论';
    $('btn-more-cmt').classList.add('hidden');
    return;
  }

  $('cmt-hint').textContent = '加载中…';
  await loadComments(true);
}

async function loadComments(reset) {
  const d = state.selectedDyn;
  if (!d?.commentSupported) return;
  if (state.cmtLoading) return;
  state.cmtLoading = true;
  $('cmt-error').textContent = '';
  $('btn-more-cmt').disabled = true;
  try {
    const page = reset ? 1 : state.cmtPage + 1;
    const res = await call(window.biliApi.getComments, {
      type: d.type,
      oid: d.oid,
      page,
      sort: state.cmtSort,
    });
    state.cmtPage = res.page;
    state.cmtHasMore = Boolean(res.hasMore);
    state.comments = reset ? res.items : state.comments.concat(res.items || []);
    const sortLabel = state.cmtSort === 'hot' ? '热度' : '时间';
    $('cmt-hint').textContent = state.comments.length
      ? `共展示 ${state.comments.length} 条 · ${sortLabel}${state.cmtHasMore ? '（可继续加载）' : ''}`
      : '暂无评论';
    renderComments();
    if (reset) {
      const list = $('cmt-list');
      if (list) list.scrollTop = 0;
    }
  } catch (e) {
    $('cmt-error').textContent = e.message;
  } finally {
    state.cmtLoading = false;
    updateLoadMoreFab('cmt-list', 'btn-more-cmt', {
      hasMore: state.cmtHasMore,
      loading: false,
    });
  }
}

async function openSettings() {
  $('settings-msg').textContent = '';
  $('settings-error').textContent = '';
  try {
    const s = await call(window.biliApi.getSettings);
    $('cookie-input').value = s.cookie || '';
    $('notify-enabled').checked = s.notifyEnabled !== false;
    $('notify-interval').value = s.notifyIntervalMin ?? 15;
    $('close-action').value = s.closeAction || 'ask';
  } catch (e) {
    $('cookie-input').value = '';
    $('settings-error').textContent = e.message;
  }
  showView('settings');
}

async function saveSettings() {
  $('settings-msg').textContent = '';
  $('settings-error').textContent = '';
  try {
    await call(window.biliApi.saveSettings, {
      cookie: $('cookie-input').value,
      notifyEnabled: $('notify-enabled').checked,
      notifyIntervalMin: Number($('notify-interval').value),
      closeAction: $('close-action').value,
    });
    $('settings-msg').textContent = '已保存，立即生效（无需重启）';
  } catch (e) {
    $('settings-error').textContent = e.message;
  }
}

async function clearCookie() {
  $('cookie-input').value = '';
  await saveSettings();
  if (!$('settings-error').textContent) {
    $('settings-msg').textContent = '已清除 Cookie';
  }
}

function bind() {
  $('btn-search').onclick = () => openProfile($('uid-input').value);
  $('uid-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') openProfile($('uid-input').value);
  });
  $('btn-back-home').onclick = async () => {
    await refreshFavorites();
    showView('home');
  };
  $('btn-back-profile').onclick = async () => {
    if (state.dynamicsBackView === 'home') {
      await refreshFavorites();
      showView('home');
      return;
    }
    showView('profile');
  };
  $('btn-back-dynamics').onclick = () => showView('dynamics');
  $('btn-toggle-fav').onclick = async () => {
    const u = state.user;
    const saved = state.favorites.some((x) => String(x.uid) === String(u.uid));
    if (saved) await call(window.biliApi.removeFavorite, u.uid);
    else
      await call(window.biliApi.addFavorite, {
        uid: u.uid,
        name: u.name,
        avatar: u.avatar,
        savedAt: Date.now(),
      });
    await refreshFavorites();
    renderProfile();
  };
  $('btn-open-dynamics').onclick = () => {
    state.dynamicsBackView = 'profile';
    openDynamics();
  };
  $('btn-refresh-dyn').onclick = async () => {
    scrollDynamicsToTop();
    await loadDynamics(true);
    scrollDynamicsToTop();
  };
  $('btn-more-dyn').onclick = () => loadDynamics(false);
  $('btn-close-player').onclick = () => closePlayer();
  $('btn-more-cmt').onclick = () => loadComments(false);
  $('dyn-list').addEventListener('scroll', () => {
    updateLoadMoreFab('dyn-list', 'btn-more-dyn', {
      hasMore: state.dynHasMore,
      loading: state.dynLoading,
    });
  }, { passive: true });
  $('cmt-list').addEventListener('scroll', () => {
    updateLoadMoreFab('cmt-list', 'btn-more-cmt', {
      hasMore: state.cmtHasMore,
      loading: state.cmtLoading,
    });
  }, { passive: true });
  // Hide FABs until near bottom on first paint.
  $('btn-more-dyn').classList.add('hidden');
  $('btn-more-cmt').classList.add('hidden');
  $('btn-cmt-sort-time').onclick = () => setCommentSort('time');
  $('btn-cmt-sort-hot').onclick = () => setCommentSort('hot');
  $('btn-open-settings').onclick = () => openSettings();
  $('btn-back-from-settings').onclick = () => {
    const back = state.previousView && state.previousView !== 'settings'
      ? state.previousView
      : 'home';
    showView(back);
  };
  $('btn-save-settings').onclick = () => saveSettings();
  $('btn-clear-cookie').onclick = () => clearCookie();
  window.biliApi.onOpenSettings(() => openSettings());
  window.biliApi.onOpenFavoriteDynamics(({ uid }) => {
    if (uid) openFavoriteDynamics(uid);
  });
  window.biliApi.onFavoriteDynamicNotify((payload) => {
    showNotifyToast(payload);
  });
  $('notify-toast').onclick = () => {
    $('notify-toast').classList.add('hidden');
    if (notifyToastUid) openFavoriteDynamics(notifyToastUid);
  };

  $('lb-close').onclick = () => closeLightbox();
  $('lb-prev').onclick = () => stepLightbox(-1);
  $('lb-next').onclick = () => stepLightbox(1);
  $('lb-zoom-in').onclick = (e) => {
    e.stopPropagation();
    setLightboxScale(state.lightbox.scale + LB_SCALE_STEP);
  };
  $('lb-zoom-out').onclick = (e) => {
    e.stopPropagation();
    setLightboxScale(state.lightbox.scale - LB_SCALE_STEP);
  };
  $('lb-zoom-reset').onclick = (e) => {
    e.stopPropagation();
    setLightboxScale(1);
  };
  $('lightbox').addEventListener('click', (e) => {
    const lb = state.lightbox;
    if (lb.suppressClose) {
      lb.suppressClose = false;
      return;
    }
    // Zoomed: stage/img are for panning — only true backdrop closes.
    if (lb.scale > 1.01) {
      if (e.target === $('lightbox')) closeLightbox();
      return;
    }
    if (e.target === $('lightbox') || e.target === $('lb-stage')) closeLightbox();
  });
  const stage = $('lb-stage');
  const img = $('lb-img');
  stage.addEventListener(
    'wheel',
    (e) => {
      if (!state.lightbox.open) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -LB_SCALE_STEP : LB_SCALE_STEP;
      setLightboxScale(state.lightbox.scale + delta, e.clientX, e.clientY);
    },
    { passive: false },
  );
  img.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (state.lightbox.scale > 1.01) setLightboxScale(1);
    else setLightboxScale(2.5, e.clientX, e.clientY);
  });
  const onPointerDown = (e) => {
    if (!state.lightbox.open || state.lightbox.scale <= 1.01) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const lb = state.lightbox;
    lb.dragging = true;
    lb.suppressClose = false;
    lb.dragStartX = e.clientX;
    lb.dragStartY = e.clientY;
    lb.panStartX = lb.panX;
    lb.panStartY = lb.panY;
    stage.classList.add('is-dragging');
    stage.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const lb = state.lightbox;
    if (!lb.dragging) return;
    const dx = e.clientX - lb.dragStartX;
    const dy = e.clientY - lb.dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) lb.suppressClose = true;
    lb.panX = lb.panStartX + dx;
    lb.panY = lb.panStartY + dy;
    applyLightboxTransform();
  };
  const onPointerUp = (e) => {
    const lb = state.lightbox;
    if (!lb.dragging) return;
    lb.dragging = false;
    stage.classList.remove('is-dragging');
    try {
      stage.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);
  img.addEventListener('click', (e) => {
    // Prevent residual click-after-drag from bubbling to backdrop logic.
    if (state.lightbox.scale > 1.01 || state.lightbox.suppressClose) {
      e.stopPropagation();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!state.lightbox.open) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
    if (e.key === '+' || e.key === '=') setLightboxScale(state.lightbox.scale + LB_SCALE_STEP);
    if (e.key === '-' || e.key === '_') setLightboxScale(state.lightbox.scale - LB_SCALE_STEP);
    if (e.key === '0') setLightboxScale(1);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bind();
  await refreshFavorites();
  showView('home');
});
