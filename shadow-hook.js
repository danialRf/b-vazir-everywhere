(() => {
  "use strict";

  const EVENT_NAME = "bve-shadow-root-attached";
  const originalAttachShadow = Element.prototype.attachShadow;

  if (originalAttachShadow.__bveShadowHook) return;

  function attachShadowWithNotification(init) {
    const root = originalAttachShadow.call(this, init);
    this.dispatchEvent(new CustomEvent(EVENT_NAME, { bubbles: true }));
    return root;
  }

  Object.defineProperty(attachShadowWithNotification, "__bveShadowHook", { value: true });
  Element.prototype.attachShadow = attachShadowWithNotification;
})();
