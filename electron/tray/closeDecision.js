function resolveCloseDecision({ closeAction, isQuitting }) {
  if (isQuitting) return 'allow-quit';
  if (closeAction === 'tray') return 'hide';
  if (closeAction === 'quit') return 'allow-quit';
  return 'ask';
}

module.exports = { resolveCloseDecision };
