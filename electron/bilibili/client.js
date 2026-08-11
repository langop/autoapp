class BiliRequestError extends Error {
  constructor({ code, message, retryable }) {
    super(message);
    this.name = 'BiliRequestError';
    this.code = code;
    this.retryable = retryable;
  }

  toJSON() {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

function mapBiliError(code, message) {
  const c = Number(code);
  if (c === -352 || c === -412) {
    return {
      code: c,
      message: '公开接口受限，可稍后重试或配置 Cookie',
      retryable: true,
    };
  }
  if (c === -404 || c === -400) {
    return {
      code: c,
      message: message || '用户不存在或参数无效',
      retryable: false,
    };
  }
  return {
    code: Number.isFinite(c) ? c : code,
    message: message || `请求失败(${code})`,
    retryable: true,
  };
}

function createClient({ cookie = '', delayMs = 200, timeoutMs = 15000 } = {}) {
  let currentCookie = cookie || '';
  let chain = Promise.resolve();

  function enqueue(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => new Promise((r) => setTimeout(r, delayMs)),
      () => new Promise((r) => setTimeout(r, delayMs)),
    );
    return run;
  }

  function setCookie(next) {
    currentCookie = typeof next === 'string' ? next.trim() : '';
  }

  async function getJson(url, params = {}) {
    return enqueue(async () => {
      const u = new URL(url);
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        u.searchParams.set(k, String(v));
      }
      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Referer: 'https://www.bilibili.com/',
        Origin: 'https://www.bilibili.com',
      };
      if (currentCookie) headers.Cookie = currentCookie;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let res;
      try {
        res = await fetch(u, { headers, signal: controller.signal });
      } catch (e) {
        if (controller.signal.aborted) {
          throw new BiliRequestError({
            code: 'TIMEOUT',
            message: '请求超时',
            retryable: true,
          });
        }
        throw new BiliRequestError({
          code: 'NETWORK',
          message: `网络失败：${e.message}`,
          retryable: true,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        if (res.status === 412) {
          throw new BiliRequestError(mapBiliError(-412));
        }
        if (res.status === 352) {
          throw new BiliRequestError(mapBiliError(-352));
        }
        throw new BiliRequestError({
          code: res.status,
          message: `HTTP ${res.status}`,
          retryable: true,
        });
      }
      const body = await res.json();
      if (body.code !== 0) {
        throw new BiliRequestError(mapBiliError(body.code, body.message));
      }
      return body;
    });
  }

  return { getJson, setCookie };
}

module.exports = { createClient, mapBiliError, BiliRequestError };
