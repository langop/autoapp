const fs = require('fs');
const path = require('path');

function createFavoritesStore(filePath) {
  function ensureDir() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function read() {
    try {
      if (!fs.existsSync(filePath)) return [];
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function write(list) {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
  }

  function normalize(item) {
    return {
      ...item,
      notifyEnabled: Boolean(item.notifyEnabled),
    };
  }

  return {
    list() {
      return read().map(normalize);
    },
    add(user) {
      const list = read().filter((x) => String(x.uid) !== String(user.uid));
      list.unshift({
        uid: String(user.uid),
        name: user.name || '',
        avatar: user.avatar || '',
        savedAt: user.savedAt || Date.now(),
        notifyEnabled: Boolean(user.notifyEnabled),
      });
      write(list);
      return { ok: true };
    },
    setNotify(uid, enabled) {
      const list = read();
      const item = list.find((x) => String(x.uid) === String(uid));
      if (item) {
        item.notifyEnabled = Boolean(enabled);
        write(list);
      }
      return { ok: true };
    },
    remove(uid) {
      write(read().filter((x) => String(x.uid) !== String(uid)));
      return { ok: true };
    },
  };
}

module.exports = { createFavoritesStore };
