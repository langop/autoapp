async function fetchUserInfo(client, uid) {
  const mid = String(uid || '').trim();
  if (!/^\d+$/.test(mid)) {
    const { BiliRequestError } = require('./client');
    throw new BiliRequestError({
      code: 'INVALID_UID',
      message: 'UID 必须是数字',
      retryable: false,
    });
  }
  const body = await client.getJson(
    'https://api.bilibili.com/x/web-interface/card',
    { mid },
  );
  const card = body.data?.card || {};
  return {
    uid: String(card.mid || mid),
    name: card.name || '',
    avatar: card.face || '',
    sign: card.sign || '',
    fans: Number(body.data?.follower || 0),
    level: Number(card.level_info?.current_level || 0),
  };
}

module.exports = { fetchUserInfo };
