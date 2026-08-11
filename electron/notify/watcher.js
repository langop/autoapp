const BODY_MAX_LEN = 100;

function pickLatestNonPinned(items) {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (item && !item.isTop) return item;
  }
  return null;
}

function diffWatchUpdate({ prevId, nextId }) {
  const next = nextId != null ? String(nextId) : '';
  const prev = prevId != null ? String(prevId) : '';
  if (!next) return 'skip';
  if (!prev) return 'init';
  if (prev !== next) return 'changed';
  return 'same';
}

function truncateBody(text) {
  const s = String(text || '').trim();
  if (s.length <= BODY_MAX_LEN) return s;
  return `${s.slice(0, BODY_MAX_LEN - 1)}…`;
}

function buildNotifyPayload(up, item) {
  const body = truncateBody(item.title || item.text || '');
  return {
    title: `${up.name || ''} 更新了动态`,
    body,
    uid: String(up.uid),
  };
}

async function runWatchRound({ favorites, fetchDynamicsForUid, watch, onNotify }) {
  const targets = favorites.filter((f) => f.notifyEnabled);
  for (const up of targets) {
    try {
      const { items } = await fetchDynamicsForUid(up.uid);
      const latest = pickLatestNonPinned(items);
      if (!latest) continue;
      const prev = watch.get(up.uid)?.lastDynamicId || '';
      const kind = diffWatchUpdate({ prevId: prev, nextId: latest.id });
      if (kind === 'init' || kind === 'same') {
        if (kind === 'init') watch.set(up.uid, latest.id);
        continue;
      }
      if (kind === 'changed') {
        onNotify(buildNotifyPayload(up, latest));
        watch.set(up.uid, latest.id);
      }
    } catch {
      // skip this up
    }
  }
}

module.exports = {
  pickLatestNonPinned,
  diffWatchUpdate,
  buildNotifyPayload,
  runWatchRound,
};
