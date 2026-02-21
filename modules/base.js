/**
 * Base class for panel features.
 * script.js imports subclasses, instantiates them, calls init(deps), then uses getListRow() / getScreen().
 * Methods may be no-op or return null/empty if the feature has no implementation.
 */
export class BasePanelFeature {
  constructor() {
    this._listRow = null;
    this._screen = { el: null, onShow: function () {} };
  }

  /**
   * Override: initialize with deps (h, createGearNode, RPC, callbacks, etc.).
   * @param {Object} deps - dependencies passed by script.js
   */
  init(deps) {}

  /** Override: return the list row element or null. */
  getListRow() {
    return this._listRow;
  }

  /** Override: return { el, onShow }. */
  getScreen() {
    return this._screen;
  }

  /** Optional: called when panel opens. */
  onPanelOpen() {}
}
