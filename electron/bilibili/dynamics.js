const TYPE_LABELS = {
  DYNAMIC_TYPE_AV: '视频',
  DYNAMIC_TYPE_DRAW: '图文',
  DYNAMIC_TYPE_WORD: '文字',
  DYNAMIC_TYPE_ARTICLE: '专栏',
  DYNAMIC_TYPE_FORWARD: '转发',
  DYNAMIC_TYPE_LIVE: '直播',
  DYNAMIC_TYPE_LIVE_RCMD: '直播',
  DYNAMIC_TYPE_PGC: '番剧',
  DYNAMIC_TYPE_COURSES: '课程',
  DYNAMIC_TYPE_MUSIC: '音乐',
  DYNAMIC_TYPE_COMMON_SQUARE: '分享',
  DYNAMIC_TYPE_MEDIALIST: '收藏夹',
  DYNAMIC_TYPE_UGC_SEASON: '合集',
};

function majorOf(item) {
  return item?.modules?.module_dynamic?.major || {};
}

function normalizeMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim();
  if (!u) return '';
  if (u.startsWith('//')) u = `https:${u}`;
  if (u.startsWith('http://')) u = `https://${u.slice('http://'.length)}`;
  return u;
}

function normalizeJumpUrl(url) {
  return normalizeMediaUrl(url);
}

function extractJumpUrl(item, major) {
  if (major.archive?.bvid) {
    return `https://www.bilibili.com/video/${major.archive.bvid}`;
  }
  if (major.archive?.jump_url) return normalizeJumpUrl(major.archive.jump_url);
  if (major.pgc?.jump_url) return normalizeJumpUrl(major.pgc.jump_url);
  if (major.pgc?.epid) {
    return `https://www.bilibili.com/bangumi/play/ep${major.pgc.epid}`;
  }
  if (major.live?.jump_url) return normalizeJumpUrl(major.live.jump_url);
  if (major.opus?.jump_url) return normalizeJumpUrl(major.opus.jump_url);
  const id = String(item.id_str || item.id || '');
  if (
    id &&
    (item.type === 'DYNAMIC_TYPE_DRAW' ||
      item.type === 'DYNAMIC_TYPE_WORD' ||
      item.type === 'DYNAMIC_TYPE_FORWARD')
  ) {
    return `https://www.bilibili.com/opus/${id}`;
  }
  return '';
}

function pickPicUrl(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return normalizeMediaUrl(entry);
  return normalizeMediaUrl(
    entry.src ||
      entry.url ||
      entry.img_src ||
      entry.imgSrc ||
      entry.cover ||
      '',
  );
}

function collectPics(major) {
  const out = [];
  const push = (url) => {
    const n = normalizeMediaUrl(url);
    if (n && !out.includes(n)) out.push(n);
  };

  for (const item of major.draw?.items || []) push(pickPicUrl(item));
  for (const pic of major.opus?.pics || []) push(pickPicUrl(pic));
  if (Array.isArray(major.opus?.summary?.rich_text_nodes)) {
    for (const node of major.opus.summary.rich_text_nodes) {
      if (node?.emoji?.url) push(node.emoji.url);
    }
  }
  return out;
}

function mapCommentTarget(item) {
  // Prefer API-provided comment target (needed for opus 图文: type 11 + 相簿 id).
  const basic = item?.basic || {};
  if (basic.comment_type != null && basic.comment_id_str) {
    return {
      type: Number(basic.comment_type),
      oid: String(basic.comment_id_str),
    };
  }

  const id = String(item.id_str || item.id || '');
  const major = majorOf(item);
  switch (item.type) {
    case 'DYNAMIC_TYPE_AV':
      if (!major.archive?.aid) return null;
      return { type: 1, oid: String(major.archive.aid) };
    case 'DYNAMIC_TYPE_DRAW': {
      // 图文评论区 oid 是相簿 id，不是动态 id；无 draw.id 时不要误用 dyn id。
      const albumId = major.draw?.id;
      if (albumId) return { type: 11, oid: String(albumId) };
      return id ? { type: 17, oid: id } : null;
    }
    case 'DYNAMIC_TYPE_WORD':
      return id ? { type: 17, oid: id } : null;
    case 'DYNAMIC_TYPE_ARTICLE':
      if (!major.article?.id) return null;
      return { type: 12, oid: String(major.article.id) };
    case 'DYNAMIC_TYPE_FORWARD':
      return id ? { type: 17, oid: id } : null;
    default:
      return null;
  }
}

function parseLiveRcmd(major) {
  try {
    const raw = major.live_rcmd?.content;
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const live = parsed?.live_play_info || parsed?.live_info || parsed;
    return {
      title: live?.title || live?.live_title || '',
      cover: live?.cover || live?.cover_img || '',
      text: live?.area_name ? `分区：${live.area_name}` : '',
    };
  } catch {
    return null;
  }
}

function extractContent(item) {
  const kind = item.type || 'UNKNOWN';
  const label = TYPE_LABELS[kind] || '动态';
  const dyn = item?.modules?.module_dynamic || {};
  const major = majorOf(item);
  const desc = dyn.desc?.text || '';

  let title = '';
  let text = desc;
  let cover = '';
  let pics = [];
  let bvid = major.archive?.bvid ? String(major.archive.bvid) : '';
  let jumpUrl = extractJumpUrl(item, major);

  if (major.archive) {
    title = major.archive.title || '';
    cover = normalizeMediaUrl(major.archive.cover || '');
    text = desc || major.archive.desc || '';
  }

  if (major.article) {
    title = title || major.article.title || '';
    const covers = major.article.covers || [];
    cover = cover || normalizeMediaUrl(covers[0] || major.article.cover || '');
    text = text || desc || major.article.desc || '';
  }

  if (major.opus) {
    title = title || major.opus.title || '';
    text = text || desc || major.opus.summary?.text || '';
  }

  if (major.pgc) {
    title = title || major.pgc.title || '';
    cover = cover || normalizeMediaUrl(major.pgc.cover || '');
    text = text || desc || major.pgc.ep_desc || '';
  }

  if (major.live) {
    title = title || major.live.title || '';
    cover = cover || normalizeMediaUrl(major.live.cover || '');
    text = text || desc || (major.live.badge?.text ? `直播 · ${major.live.badge.text}` : '');
  }

  if (major.live_rcmd) {
    const live = parseLiveRcmd(major);
    if (live) {
      title = title || live.title;
      cover = cover || normalizeMediaUrl(live.cover || '');
      text = text || desc || live.text || '';
    }
  }

  if (major.common) {
    title = title || major.common.title || major.common.desc || '';
    cover = cover || normalizeMediaUrl(major.common.cover || '');
    text = text || desc || major.common.desc || '';
  }

  if (major.courses) {
    title = title || major.courses.title || '';
    cover = cover || normalizeMediaUrl(major.courses.cover || '');
    text = text || desc || '';
  }

  if (major.music) {
    title = title || major.music.title || '';
    cover = cover || normalizeMediaUrl(major.music.cover || '');
    text = text || desc || major.music.label || '';
  }

  // Always collect image albums from draw/opus (newer APIs often use opus for 图文).
  pics = collectPics(major);
  if (!text) text = desc;

  if (kind === 'DYNAMIC_TYPE_FORWARD' && item.orig) {
    const orig = extractContent(item.orig);
    const origLine = [orig.label, orig.title || orig.text].filter(Boolean).join(' · ');
    text = [desc, origLine ? `原动态：${origLine}` : ''].filter(Boolean).join('\n');
    if (!cover) cover = orig.cover;
    if (!pics.length) pics = orig.pics;
    if (!title && orig.title) title = `转发：${orig.title}`;
    if (!bvid) bvid = orig.bvid || '';
    if (!jumpUrl) jumpUrl = orig.jumpUrl || '';
  }

  return {
    kind,
    label,
    title,
    text,
    cover: normalizeMediaUrl(cover),
    pics: pics.map(normalizeMediaUrl).filter(Boolean),
    bvid,
    jumpUrl,
  };
}

function isPinnedDynamic(item) {
  const tag = item?.modules?.module_tag?.text;
  return Boolean(tag && String(tag).includes('置顶'));
}

function normalizeDynamicItem(item) {
  const target = mapCommentTarget(item);
  const content = extractContent(item);
  const stat = item?.modules?.module_stat || {};
  return {
    id: String(item.id_str || item.id || ''),
    kind: content.kind,
    label: content.label,
    type: target ? target.type : null,
    oid: target ? target.oid : null,
    commentSupported: Boolean(target),
    isTop: isPinnedDynamic(item),
    title: content.title,
    text: content.text,
    cover: content.cover,
    pics: content.pics,
    bvid: content.bvid || '',
    jumpUrl: content.jumpUrl || '',
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
      features: 'itemOpusStyle,opusBigCover,htmlNewStyle',
    },
  );
  return normalizeDynamicsResponse(body);
}

module.exports = {
  mapCommentTarget,
  isPinnedDynamic,
  normalizeDynamicItem,
  normalizeDynamicsResponse,
  normalizeMediaUrl,
  extractContent,
  fetchDynamics,
};
