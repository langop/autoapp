const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveCloseDecision } = require('../electron/tray/closeDecision');

describe('resolveCloseDecision', () => {
  it('allows quit when isQuitting', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'tray', isQuitting: true }),
      'allow-quit',
    );
  });

  it('hides when closeAction is tray', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'tray', isQuitting: false }),
      'hide',
    );
  });

  it('allows quit when closeAction is quit', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'quit', isQuitting: false }),
      'allow-quit',
    );
  });

  it('asks when closeAction is ask', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'ask', isQuitting: false }),
      'ask',
    );
  });

  it('asks for unknown closeAction', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'weird', isQuitting: false }),
      'ask',
    );
  });
});
