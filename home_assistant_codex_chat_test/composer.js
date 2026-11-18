/* HA Codex spellchecking composer: presentation only, uses same ttyd socket. */
(() => {
  'use strict';

  const init = () => {
    if (document.getElementById('ha-codex-composer')) return;
    const bridge = window.haCodexComposerBridge;
    if (!bridge) return;

    const panel = document.createElement('section');
    panel.id = 'ha-codex-composer';
    panel.setAttribute('aria-label', 'Write a message to Codex');
    panel.innerHTML = `
      <div class="ha-codex-composer-top">
        <span class="ha-codex-composer-heading">Ask Codex</span>
        <span class="ha-codex-composer-toolbar">
          <span id="ha-codex-composer-status" class="ha-codex-composer-status" role="status">Connecting…</span>
          <button type="button" id="ha-codex-composer-toggle" aria-expanded="true">Hide</button>
        </span>
      </div>
      <div class="ha-codex-compose-area">
        <textarea id="ha-codex-message" rows="1" lang="en-GB"
          placeholder="Ask Codex anything…" aria-label="Codex message"
          spellcheck="true" autocorrect="on" autocapitalize="sentences"
          autocomplete="off" data-1p-ignore="true"></textarea>
        <button type="button" id="ha-codex-send" class="ha-codex-send" title="Send message" aria-label="Send message" disabled>↑</button>
      </div>
      <div id="ha-codex-composer-feedback" class="ha-codex-composer-error" hidden></div>
      <div class="ha-codex-composer-hint">Enter sends · Shift+Enter starts a new line · On mobile, use Send</div>`;
    document.body.appendChild(panel);

    const input = panel.querySelector('#ha-codex-message');
    const sendButton = panel.querySelector('#ha-codex-send');
    const status = panel.querySelector('#ha-codex-composer-status');
    const feedback = panel.querySelector('#ha-codex-composer-feedback');
    const toggle = panel.querySelector('#ha-codex-composer-toggle');
    const mobileKeyboard = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    // The existing xterm page resizes when the panel height changes. This
    // keeps terminal output visible above the composer, including on mobile.
    let previousHeight = 0;
    const fit = () => {
      const height = Math.ceil(panel.getBoundingClientRect().height);
      if (height !== previousHeight) {
        previousHeight = height;
        document.documentElement.style.setProperty('--ha-codex-composer-h', height + 'px');
        window.dispatchEvent(new Event('resize'));
      }
    };
    document.body.classList.add('ha-codex-composer-enabled');
    if (window.ResizeObserver) new ResizeObserver(fit).observe(panel);
    window.addEventListener('resize', fit);

    const refresh = () => {
      const ready = bridge.ready();
      status.textContent = ready ? 'Terminal connected' : 'Terminal disconnected';
      sendButton.disabled = !ready || !input.value.trim();
    };
    bridge.subscribe(refresh);
    const pulse = window.setInterval(refresh, 1500);
    window.addEventListener('pagehide', () => window.clearInterval(pulse), { once: true });
    const sizeInput = () => {
      input.style.height = 'auto';
      const height = Math.min(180, Math.max(48, input.scrollHeight));
      input.style.height = height + 'px';
      input.style.overflowY = input.scrollHeight > 180 ? 'auto' : 'hidden';
    };
    input.addEventListener('input', () => {
      feedback.hidden = true;
      sizeInput();
      refresh();
    });

    const send = () => {
      const message = input.value;
      if (!message.trim()) return;
      try {
        if (!bridge.send(message)) return;
        input.value = '';
        sizeInput();
        feedback.hidden = true;
        refresh();
        fit();
        // Do not steal focus from a phone's keyboard after pressing Send.
      } catch (error) {
        feedback.textContent = error.message || 'Could not send. Your message is still here.';
        feedback.hidden = false;
        refresh();
      }
    };
    sendButton.addEventListener('click', send);
    input.addEventListener('keydown', (event) => {
      // IME composition and mobile keyboard Enter should not submit a prompt.
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter' && !mobileKeyboard && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });
    toggle.addEventListener('click', () => {
      const collapsed = document.body.classList.toggle('ha-codex-composer-collapsed');
      toggle.textContent = collapsed ? 'Show' : 'Hide';
      toggle.setAttribute('aria-expanded', String(!collapsed));
      fit();
    });
    // The stored add-on setting may still be 14px after an update.
    // Only increase small fonts on phones; preserve larger font choices.
    let attempts = 0;
    const updateMobileFont = () => {
      const term = window.term;
      if (!term || !term.options) return false;
      if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches
          && Number(term.options.fontSize) < 16) {
        term.options.fontSize = 16;
        window.dispatchEvent(new Event('resize'));
      }
      return true;
    };
    const fontRetry = window.setInterval(() => {
      attempts += 1;
      if (updateMobileFont() || attempts >= 80) window.clearInterval(fontRetry);
    }, 125);
    window.addEventListener('pagehide', () => window.clearInterval(fontRetry), { once: true });
    updateMobileFont();
    sizeInput();
    refresh();
    fit();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
