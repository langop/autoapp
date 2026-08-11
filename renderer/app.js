const state = {
  view: 'home',
  user: null,
  favorites: [],
  dynamics: [],
  dynOffset: null,
  dynHasMore: false,
  selectedDyn: null,
  comments: [],
  cmtPage: 1,
  cmtHasMore: false,
};

function $(id) {
  return document.getElementById(id);
}

function showView(name) {
  state.view = name;
  for (const id of ['view-home', 'view-profile', 'view-dynamics']) {
    $(id).classList.toggle('hidden', id !== `view-${name}`);
  }
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString();
}

async function call(fn, ...args) {
  const res = await fn(...args);
  if (res && res.error) throw res.error;
  return res;
}

async function refreshFavorites() {
  state.favorites = await call(window.biliApi.listFavorites);
  const box = $('fav-list');
  box.innerHTML = '';
  if (!state.favorites.length) {
    box.innerHTML = '<p class="muted">暂无收藏</p>';
    return;
  }
  for (const fav of state.favorites) {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<strong>${fav.name}</strong> <span class="muted">UID ${fav.uid}</span>`;
    el.onclick = () => openProfile(fav.uid);
    box.appendChild(el);
  }
}

function renderProfile() {
  const u = state.user;
  $('profile-card').innerHTML = `
    <img src="${u.avatar}" alt="" />
    <div>
      <h2 style="margin:0 0 6px">${u.name}</h2>
      <div class="muted">UID ${u.uid} · Lv.${u.level} · 粉丝 ${u.fans}</div>
      <p>${u.sign || '（无签名）'}</p>
    </div>
  `;
  const saved = state.favorites.some((x) => String(x.uid) === String(u.uid));
  $('btn-toggle-fav').textContent = saved ? '取消收藏' : '收藏';
}

async function openProfile(uid) {
  $('home-error').textContent = '';
  $('profile-error').textContent = '';
  try {
    state.user = await call(window.biliApi.getUserInfo, String(uid).trim());
    await refreshFavorites();
    renderProfile();
    showView('profile');
  } catch (e) {
    if (state.view === 'home') $('home-error').textContent = e.message;
    else $('profile-error').textContent = e.message;
  }
}

function renderDynamics() {
  const box = $('dyn-list');
  box.innerHTML = '';
  if (!state.dynamics.length) {
    box.innerHTML = '<p class="muted">暂无动态</p>';
  }
  for (const d of state.dynamics) {
    const el = document.createElement('div');
    el.className = 'item' + (state.selectedDyn?.id === d.id ? ' active' : '');
    el.innerHTML = `
      <div>${d.text || '（无文本）'}</div>
      <div class="muted">${fmtTime(d.publishTime)} · 评论 ${d.stat.comment} · 点赞 ${d.stat.like}</div>
    `;
    el.onclick = () => selectDynamic(d);
    box.appendChild(el);
  }
  $('btn-more-dyn').disabled = !state.dynHasMore;
}

function renderComments() {
  const box = $('cmt-list');
  box.innerHTML = '';
  for (const c of state.comments) {
    const el = document.createElement('div');
    el.className = 'item';
    const subs = (c.replies || [])
      .map((r) => `<div class="muted" style="margin-left:12px">└ ${r.uname}: ${r.content}</div>`)
      .join('');
    el.innerHTML = `<strong>${c.uname}</strong> · 赞 ${c.like}<div>${c.content}</div>${subs}`;
    box.appendChild(el);
  }
  $('btn-more-cmt').classList.toggle('hidden', !state.cmtHasMore);
}

async function loadDynamics(reset) {
  $('dyn-error').textContent = '';
  try {
    if (reset) {
      state.dynamics = [];
      state.dynOffset = null;
      state.selectedDyn = null;
      state.comments = [];
      state.cmtHasMore = false;
      $('cmt-hint').textContent = '选择一条动态查看评论';
    }
    const res = await call(window.biliApi.getDynamics, {
      uid: state.user.uid,
      offset: reset ? '' : state.dynOffset || '',
    });
    state.dynamics = reset ? res.items : state.dynamics.concat(res.items);
    state.dynOffset = res.nextOffset;
    state.dynHasMore = res.hasMore;
    renderDynamics();
    renderComments();
  } catch (e) {
    $('dyn-error').textContent = e.message;
  }
}

async function selectDynamic(d) {
  state.selectedDyn = d;
  renderDynamics();
  $('cmt-error').textContent = '';
  state.comments = [];
  state.cmtPage = 1;
  state.cmtHasMore = false;
  if (!d.commentSupported) {
    $('cmt-hint').textContent = '暂不支持评论加载';
    renderComments();
    return;
  }
  $('cmt-hint').textContent = `动态 ${d.id} 的评论`;
  await loadComments(true);
}

async function loadComments(reset) {
  const d = state.selectedDyn;
  if (!d?.commentSupported) return;
  try {
    const page = reset ? 1 : state.cmtPage + 1;
    const res = await call(window.biliApi.getComments, {
      type: d.type,
      oid: d.oid,
      page,
    });
    state.cmtPage = res.page;
    state.cmtHasMore = res.hasMore;
    state.comments = reset ? res.items : state.comments.concat(res.items);
    if (!state.comments.length) $('cmt-hint').textContent = '暂无评论';
    renderComments();
  } catch (e) {
    $('cmt-error').textContent = e.message;
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
  $('btn-back-profile').onclick = () => showView('profile');
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
  $('btn-open-dynamics').onclick = async () => {
    showView('dynamics');
    await loadDynamics(true);
  };
  $('btn-more-dyn').onclick = () => loadDynamics(false);
  $('btn-more-cmt').onclick = () => loadComments(false);
}

document.addEventListener('DOMContentLoaded', async () => {
  bind();
  await refreshFavorites();
  showView('home');
});
