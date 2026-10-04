(() => {
  "use strict";

  const EVENT_NAME = "bve-shadow-root-attached";
  const nativeAttachShadow = Element.prototype.attachShadow;

  if (nativeAttachShadow.__bveHooked) return;

  function attachShadow(init) {
    const root = Reflect.apply(nativeAttachShadow, this, [init]);
    this.dispatchEvent(new CustomEvent(EVENT_NAME, { bubbles: true }));
    return root;
  }

  Object.defineProperty(attachShadow, "__bveHooked", { value: true });
  Element.prototype.attachShadow = attachShadow;
})();
