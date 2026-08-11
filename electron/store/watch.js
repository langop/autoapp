const fs = require('fs');
const path = require('path');

function createWatchStore(filePath) {
  function ensureDir() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function read() {
    try {
      if (!fs.existsSync(filePath)) return { byUid: {} };
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { byUid: {} };
      }
      const byUid = data.byUid && typeof data.byUid === 'object' ? data.byUid : {};
      return { byUid };
    } catch {
      return { byUid: {} };
    }
  }

  function write(data) {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  return {
    get(uid) {
      const entry = read().byUid[String(uid)];
      if (!entry || typeof entry !== 'object') return undefined;
      return {
        lastDynamicId: String(entry.lastDynamicId || ''),
        updatedAt: entry.updatedAt,
      };
    },
    set(uid, lastDynamicId) {
      const data = read();
      data.byUid[String(uid)] = {
        lastDynamicId: String(lastDynamicId),
        updatedAt: Date.now(),
      };
      write(data);
    },
    remove(uid) {
      const data = read();
      delete data.byUid[String(uid)];
      write(data);
    },
    clearMissing(uids) {
      const keep = new Set(uids.map(String));
      const data = read();
      for (const key of Object.keys(data.byUid)) {
        if (!keep.has(key)) delete data.byUid[key];
      }
      write(data);
    },
  };
}

module.exports = { createWatchStore };
