function normalizeMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim();
  if (!u) return '';
  if (u.startsWith('//')) u = `https:${u}`;
  if (u.startsWith('http://')) u = `https://${u.slice('http://'.length)}`;
  return u;
}

function mapEmotes(emoteMap) {
  if (!emoteMap || typeof emoteMap !== 'object') return [];
  return Object.values(emoteMap)
    .map((e) => ({
      text: e?.text || '',
      url: normalizeMediaUrl(e?.url || ''),
    }))
    .filter((e) => e.text && e.url);
}

function mapPictures(pictures) {
  if (!Array.isArray(pictures)) return [];
  return pictures
    .map((p) => normalizeMediaUrl(p?.img_src || p?.src || p?.url || ''))
    .filter(Boolean);
}

function mapReply(r) {
  const content = r.content || {};
  const mid = r.member?.mid ?? r.mid;
  return {
    rpid: String(r.rpid),
    mid: mid != null && mid !== '' ? String(mid) : '',
    uname: r.member?.uname || '',
    avatar: normalizeMediaUrl(r.member?.avatar || ''),
    content: content.message || '',
    pics: mapPictures(content.pictures),
    emotes: mapEmotes(content.emote),
    like: Number(r.like || 0),
    ctime: Number(r.ctime || 0),
    replies: Array.isArray(r.replies) ? r.replies.map(mapReply) : [],
  };
}

function normalizeCommentsResponse(body, page, pageSize) {
  const data = body.data || {};
  const raw = Array.isArray(data.replies) ? data.replies : [];
  const items = raw.map(mapReply);

  let hasMore = false;
  if (data.cursor && typeof data.cursor.is_end === 'boolean') {
    hasMore = data.cursor.is_end === false && items.length > 0;
  } else if (data.page && data.page.count != null) {
    const count = Number(data.page.count);
    const size = Number(data.page.size || pageSize);
    const num = Number(data.page.num || page);
    hasMore = num * size < count;
  } else {
    hasMore = items.length >= pageSize;
  }

  return { items, page, hasMore };
}

async function fetchComments(client, { type, oid, page, sort }) {
  const pn = Number(page || 1);
  const ps = 20;
  // B 站：0 按时间，1 按点赞数，2 按回复数
  const sortMode = sort === 'hot' ? 1 : 0;
  const body = await client.getJson('https://api.bilibili.com/x/v2/reply', {
    type,
    oid,
    pn,
    ps,
    sort: sortMode,
  });
  return normalizeCommentsResponse(body, pn, ps);
}

module.exports = {
  mapReply,
  mapPictures,
  mapEmotes,
  normalizeCommentsResponse,
  fetchComments,
};
