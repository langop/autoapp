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

  return {
    list() {
      return read();
    },
    add(user) {
      const list = read().filter((x) => String(x.uid) !== String(user.uid));
      list.unshift({
        uid: String(user.uid),
        name: user.name || '',
        avatar: user.avatar || '',
        savedAt: user.savedAt || Date.now(),
      });
      write(list);
      return { ok: true };
    },
    remove(uid) {
      write(read().filter((x) => String(x.uid) !== String(uid)));
      return { ok: true };
    },
  };
}

module.exports = { createFavoritesStore };
