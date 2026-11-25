import { flushMutationObservers, isHiddenFromAT } from '../../../jest.conf/testUtils';
import {
  KOLIBRI_SNACKBAR_ID,
  getPopoverContainer,
  hideBackground,
  isTopModal,
  restoreBackground,
} from '../modalBackground';

describe('modalBackground', () => {
  let fixtures;
  let openModals;

  function addFixture(parent = document.body, id) {
    const el = document.createElement('div');
    if (id) {
      el.id = id;
    }
    parent.appendChild(el);
    fixtures.push(el);
    return el;
  }

  function addSnackbar(parent) {
    const wrapper = addFixture(parent);
    const snackbar = addFixture(wrapper, KOLIBRI_SNACKBAR_ID);
    const message = addFixture(snackbar);
    return { wrapper, snackbar, message };
  }

  function mount(parent = document.body, $parent = null) {
    const el = addFixture(parent);
    const dialog = addFixture(el);
    return { el, dialog, vm: { $parent } };
  }

  function show(modal) {
    hideBackground(modal.el, modal.dialog, modal.vm);
    openModals.push(modal.vm);
    return modal;
  }

  function open(parent, $parent) {
    return show(mount(parent, $parent));
  }

  function close(vm) {
    restoreBackground(vm);
    openModals.splice(openModals.indexOf(vm), 1);
  }

  beforeEach(() => {
    fixtures = [];
    openModals = [];
  });

  afterEach(() => {
    openModals.forEach(restoreBackground);
    fixtures.forEach(el => el.remove());
  });

  it(`hides siblings of the modal and its ancestors, but not the modal`, () => {
    const app = addFixture();
    const sibling = addFixture(app);
    const appSibling = addFixture();
    const { el, dialog } = open(app);
    expect(sibling).toHaveAttribute('aria-hidden', 'true');
    expect(appSibling).toHaveAttribute('aria-hidden', 'true');
    expect(isHiddenFromAT(el)).toBe(false);
    expect(isHiddenFromAT(dialog)).toBe(false);
    expect(app).not.toHaveAttribute('aria-hidden');
  });

  it(`leaves nothing hidden after modals open and close one after another`, () => {
    const app = addFixture();
    [1, 2].forEach(() => {
      const { vm } = open();
      expect(app).toHaveAttribute('aria-hidden', 'true');
      close(vm);
      expect(document.querySelectorAll('[aria-hidden]')).toHaveLength(0);
    });
  });

  it.each([
    [[], 'false'],
    [['false'], 'false'],
    [['true'], 'true'],
    [['true', 'false'], 'false'],
  ])(
    `keeps content hidden while aria-hidden is set to %j and restores "%s"`,
    async (changes, restored) => {
      const app = addFixture();
      app.setAttribute('aria-hidden', 'false');
      const { vm } = open();
      changes.forEach(value => app.setAttribute('aria-hidden', value));
      await flushMutationObservers();
      expect(app).toHaveAttribute('aria-hidden', 'true');
      close(vm);
      expect(app).toHaveAttribute('aria-hidden', restored);
    },
  );

  it(`restores an aria-hidden value changed just before closing`, () => {
    const app = addFixture();
    const { vm } = open();
    app.setAttribute('aria-hidden', 'false');
    close(vm);
    expect(app).toHaveAttribute('aria-hidden', 'false');
  });

  it(`moves the live region into the top dialog while open`, () => {
    const liveRegion = document.getElementById('k-live-region');
    const outer = open();
    expect(outer.dialog).toContainElement(liveRegion);
    const inner = open(outer.dialog, outer.vm);
    expect(inner.dialog).toContainElement(liveRegion);
    expect(isHiddenFromAT(liveRegion)).toBe(false);
    close(inner.vm);
    expect(outer.dialog).toContainElement(liveRegion);
    expect(inner.dialog).not.toContainElement(liveRegion);
    close(outer.vm);
    expect(liveRegion.parentNode).toBe(document.body);
  });

  describe('#k-overlay', () => {
    it(`keeps content added after open exposed when the snackbar moves`, async () => {
      const overlay = document.getElementById('k-overlay');
      const existing = addFixture(overlay);
      open();
      expect(isHiddenFromAT(overlay)).toBe(false);
      expect(existing).toHaveAttribute('aria-hidden', 'true');
      const added = addFixture(overlay);
      const { wrapper } = addSnackbar();
      await flushMutationObservers();
      wrapper.remove();
      await flushMutationObservers();
      expect(isHiddenFromAT(added)).toBe(false);
      expect(existing).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('snackbar', () => {
    it(`does not hide the snackbar or its wrapper`, () => {
      // Kolibri wraps `#coresnackbar` in an element with no id
      const app = addFixture();
      const sibling = addFixture(app);
      const { message } = addSnackbar(app);
      open();
      expect(isHiddenFromAT(message)).toBe(false);
      expect(sibling).toHaveAttribute('aria-hidden', 'true');
    });

    it(`exposes a snackbar added while open, and hides its wrapper once removed`, async () => {
      const root = addFixture();
      const page = addFixture(root);
      open();
      const { wrapper, message } = addSnackbar(root);
      await flushMutationObservers();
      expect(isHiddenFromAT(message)).toBe(false);
      expect(page).toHaveAttribute('aria-hidden', 'true');
      wrapper.remove();
      await flushMutationObservers();
      expect(root).toHaveAttribute('aria-hidden', 'true');
    });

    it(`restores the page on close after a snackbar comes and goes twice`, async () => {
      const root = addFixture();
      const page = addFixture(root);
      const { vm } = open();
      for (let i = 0; i < 2; i++) {
        const { wrapper } = addSnackbar(root);
        await flushMutationObservers();
        wrapper.remove();
        await flushMutationObservers();
      }
      close(vm);
      expect(root).not.toHaveAttribute('aria-hidden');
      expect(page).not.toHaveAttribute('aria-hidden');
    });
  });

  describe('stacked modals', () => {
    it(`exposes a nested modal, not its parent`, () => {
      const outer = open();
      const outerContent = addFixture(outer.dialog);
      const inner = open(outer.dialog, outer.vm);
      expect(isTopModal(inner.vm)).toBe(true);
      expect(isHiddenFromAT(inner.dialog)).toBe(false);
      expect(isHiddenFromAT(outerContent)).toBe(true);
    });

    it(`keeps a parent modal below a nested modal that opened first`, () => {
      const outer = mount();
      const outerContent = addFixture(outer.dialog);
      const inner = open(outer.dialog, outer.vm);
      show(outer);
      expect(isTopModal(inner.vm)).toBe(true);
      expect(isHiddenFromAT(outerContent)).toBe(true);
    });

    it.each([
      ['inner', 'outer'],
      ['outer', 'inner'],
    ])(`restores the page when %s closes first`, (first, second) => {
      const app = addFixture();
      app.setAttribute('aria-hidden', 'false');
      const outer = open();
      const outerContent = addFixture(outer.dialog);
      const inner = open(outer.dialog, outer.vm);
      const modals = { outer, inner };

      close(modals[first].vm);
      if (first === 'inner') {
        expect(isHiddenFromAT(outerContent)).toBe(false);
        expect(app).toHaveAttribute('aria-hidden', 'true');
        expect(document.documentElement).toHaveStyle({ overflow: 'hidden' });
      }

      close(modals[second].vm);
      expect(app).toHaveAttribute('aria-hidden', 'false');
      expect(document.querySelectorAll('[aria-hidden]')).toHaveLength(1);
    });

    it(`exposes the remaining modal whichever one closes first`, () => {
      const app = addFixture();
      const first = open();
      const second = open();
      expect(isHiddenFromAT(first.dialog)).toBe(true);
      expect(isHiddenFromAT(second.dialog)).toBe(false);
      close(first.vm);
      expect(isHiddenFromAT(second.dialog)).toBe(false);
      expect(app).toHaveAttribute('aria-hidden', 'true');
      close(second.vm);
      expect(document.querySelector('[aria-hidden]')).toBeNull();
    });

    it(`exposes a modal opened inside content an earlier modal hid`, () => {
      const app = addFixture();
      const first = open();
      const second = open(app);
      expect(isHiddenFromAT(second.dialog)).toBe(false);
      expect(isHiddenFromAT(first.dialog)).toBe(true);
      close(second.vm);
      expect(isHiddenFromAT(first.dialog)).toBe(false);
      expect(app).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('getPopoverContainer', () => {
    it(`returns the dialog of the innermost open modal containing the element`, () => {
      const outer = open();
      const inner = open(outer.dialog, outer.vm);
      const fallback = addFixture();
      expect(getPopoverContainer(addFixture(outer.dialog), fallback)).toBe(outer.dialog);
      expect(getPopoverContainer(addFixture(inner.dialog), fallback)).toBe(inner.dialog);
    });

    it(`returns the fallback for an element in no open modal`, () => {
      const dialog = addFixture();
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      open();
      const fallback = addFixture();
      expect(getPopoverContainer(addFixture(dialog), fallback)).toBe(fallback);
    });
  });
});
