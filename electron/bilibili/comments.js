function mapReply(r) {
  return {
    rpid: String(r.rpid),
    uname: r.member?.uname || '',
    avatar: r.member?.avatar || '',
    content: r.content?.message || '',
    like: Number(r.like || 0),
    ctime: Number(r.ctime || 0),
    replies: Array.isArray(r.replies) ? r.replies.map(mapReply) : [],
  };
}

function normalizeCommentsResponse(body, page, pageSize) {
  const data = body.data || {};
  const items = Array.isArray(data.replies) ? data.replies.map(mapReply) : [];
  const all = Number(data.cursor?.all_count ?? data.page?.count ?? 0);
  const hasMore = page * pageSize < all || Boolean(data.cursor?.is_end === false && items.length >= pageSize);
  return { items, page, hasMore: items.length === 0 ? false : hasMore };
}

async function fetchComments(client, { type, oid, page }) {
  const pn = Number(page || 1);
  const ps = 20;
  const body = await client.getJson('https://api.bilibili.com/x/v2/reply', {
    type,
    oid,
    pn,
    ps,
    sort: 2,
  });
  return normalizeCommentsResponse(body, pn, ps);
}

module.exports = { mapReply, normalizeCommentsResponse, fetchComments };
