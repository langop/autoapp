function majorOf(item) {
  return item?.modules?.module_dynamic?.major || {};
}

function mapCommentTarget(item) {
  const id = String(item.id_str || item.id || '');
  const major = majorOf(item);
  switch (item.type) {
    case 'DYNAMIC_TYPE_AV':
      if (!major.archive?.aid) return null;
      return { type: 1, oid: String(major.archive.aid) };
    case 'DYNAMIC_TYPE_DRAW':
      return { type: 11, oid: String(major.draw?.id || id) };
    case 'DYNAMIC_TYPE_WORD':
      return id ? { type: 17, oid: id } : null;
    case 'DYNAMIC_TYPE_ARTICLE':
      if (!major.article?.id) return null;
      return { type: 12, oid: String(major.article.id) };
    default:
      return null;
  }
}

function extractText(item) {
  const dyn = item?.modules?.module_dynamic || {};
  if (dyn.desc?.text) return dyn.desc.text;
  if (dyn.major?.archive?.title) return dyn.major.archive.title;
  if (dyn.major?.article?.title) return dyn.major.article.title;
  if (dyn.major?.opus?.summary?.text) return dyn.major.opus.summary.text;
  return '';
}

function extractPics(item) {
  const draw = majorOf(item).draw;
  if (!draw?.items) return [];
  return draw.items.map((x) => x.src).filter(Boolean);
}

function normalizeDynamicItem(item) {
  const target = mapCommentTarget(item);
  const stat = item?.modules?.module_stat || {};
  return {
    id: String(item.id_str || item.id || ''),
    type: target ? target.type : null,
    oid: target ? target.oid : null,
    commentSupported: Boolean(target),
    text: extractText(item),
    pics: extractPics(item),
    publishTime: Number(item?.modules?.module_author?.pub_ts || 0),
    stat: {
      comment: Number(stat.comment?.count || 0),
      like: Number(stat.like?.count || 0),
      forward: Number(stat.forward?.count || 0),
    },
  };
}

function normalizeDynamicsResponse(body) {
  const data = body.data || {};
  const items = Array.isArray(data.items) ? data.items.map(normalizeDynamicItem) : [];
  return {
    items,
    nextOffset: data.offset ? String(data.offset) : null,
    hasMore: Boolean(data.has_more),
  };
}

async function fetchDynamics(client, { uid, offset }) {
  const body = await client.getJson(
    'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space',
    {
      host_mid: String(uid),
      offset: offset || '',
      timezone_offset: -480,
    },
  );
  return normalizeDynamicsResponse(body);
}

module.exports = {
  mapCommentTarget,
  normalizeDynamicItem,
  normalizeDynamicsResponse,
  fetchDynamics,
};
