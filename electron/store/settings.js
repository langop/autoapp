const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  cookie: '',
  notifyEnabled: true,
  notifyIntervalMin: 15,
};

function clampInterval(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULTS.notifyIntervalMin;
  return Math.min(60, Math.max(5, Math.round(n)));
}

function createSettingsStore(filePath) {
  function ensureDir() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function read() {
    try {
      if (!fs.existsSync(filePath)) return { ...DEFAULTS };
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { ...DEFAULTS };
      }
      return {
        cookie: typeof data.cookie === 'string' ? data.cookie : DEFAULTS.cookie,
        notifyEnabled:
          typeof data.notifyEnabled === 'boolean'
            ? data.notifyEnabled
            : DEFAULTS.notifyEnabled,
        notifyIntervalMin: clampInterval(
          data.notifyIntervalMin != null
            ? data.notifyIntervalMin
            : DEFAULTS.notifyIntervalMin,
        ),
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function write(settings) {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
  }

  return {
    get() {
      return read();
    },
    save(partial) {
      const prev = read();
      const next = {
        cookie:
          typeof partial?.cookie === 'string' ? partial.cookie.trim() : prev.cookie,
        notifyEnabled:
          typeof partial?.notifyEnabled === 'boolean'
            ? partial.notifyEnabled
            : prev.notifyEnabled,
        notifyIntervalMin: clampInterval(
          partial?.notifyIntervalMin != null
            ? Number(partial.notifyIntervalMin)
            : prev.notifyIntervalMin,
        ),
      };
      write(next);
      return next;
    },
  };
}

module.exports = { createSettingsStore };
