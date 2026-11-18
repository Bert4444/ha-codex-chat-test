/*
 * HA Codex composer -> existing ttyd socket bridge (ttyd 1.7.7).
 * This script MUST run before ttyd's bundled client creates its WebSocket.
 * ttyd does not expose its xterm instance as window.term. Rather than open a
 * second session, capture ttyd's existing /ws connection without changing any
 * of its messages. No external traffic, credentials, or transcript storage.
 */
(() => {
  'use strict';
  if (window.haCodexComposerBridge) return;

  const nativeSend = WebSocket.prototype.send;
  const encoder = new TextEncoder();
  let activeSocket = null;
  let listeners = [];

  const notify = () => {
    listeners.forEach((fn) => { try { fn(); } catch (_) { /* listener */ } });
  };
  const isTerminalSocket = (socket) => {
    try { return new URL(socket.url, location.href).pathname.endsWith('/ws'); }
    catch (_) { return false; }
  };

  WebSocket.prototype.send = function (data) {
    // ttyd sends its auth/geometry handshake over this socket. Track it, but
    // never inspect or modify the bytes. Retain the native send behaviour.
    if (isTerminalSocket(this) && activeSocket !== this) {
      activeSocket = this;
      this.addEventListener('close', notify);
      this.addEventListener('open', notify);
      notify();
    }
    return nativeSend.call(this, data);
  };

  const sendInput = (socket, data) => {
    // ttyd client -> server protocol: ASCII '0', then UTF-8 PTY input bytes.
    const bytes = encoder.encode(data);
    const frame = new Uint8Array(bytes.length + 1);
    frame[0] = 48;
    frame.set(bytes, 1);
    nativeSend.call(socket, frame);
  };

  window.haCodexComposerBridge = Object.freeze({
    ready: () => !!activeSocket && activeSocket.readyState === WebSocket.OPEN,
    subscribe: (fn) => {
      listeners.push(fn);
      return () => { listeners = listeners.filter((item) => item !== fn); };
    },
    send: (message) => {
      const socket = activeSocket;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error('The terminal is not connected. Your message has not been sent.');
      }
      if (typeof message !== 'string' || !message.trim()) return false;
      // Bracketed paste keeps a multiline Codex prompt together, then CR
      // submits it. Intended for the interactive Codex prompt, not a shell.
      const text = message.replace(/\r\n?/g, '\n');
      sendInput(socket, '\x1b[200~' + text + '\x1b[201~');
      sendInput(socket, '\r');
      return true;
    },
  });
})();
