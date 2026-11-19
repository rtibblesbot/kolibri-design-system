import { renderComponentForVisualTest, takeSnapshot } from '../../../jest.conf/visual.testUtils';

describe.visual('KDropdownMenu Visual Tests', () => {
  const snapshotOptions = {
    widths: [400],
    minHeight: 520,
  };

  it('renders', async () => {
    // set viewport height to a large value to ensure the dropdown fits without flipping
    await page.setViewport({ width: 400, height: 1500 });
    await renderComponentForVisualTest('KDropdownMenuVisualTest');
    await takeSnapshot('KDropdownMenu visual tests', snapshotOptions);
  });

  function measureMenu() {
    return page.$eval('.tippy-popper .ui-popover', popoverEl => {
      const menuEl = popoverEl.querySelector('.ui-menu');
      menuEl.scrollTop = menuEl.scrollHeight;
      const options = popoverEl.querySelectorAll('.ui-menu-option');
      return {
        scrollContainers: [popoverEl, ...popoverEl.querySelectorAll('*')].filter(
          el => el.scrollHeight > el.clientHeight,
        ).length,
        popover: popoverEl.getBoundingClientRect().toJSON(),
        headerParts: [...popoverEl.querySelectorAll('.menu-header')].map(el =>
          el.getBoundingClientRect().toJSON(),
        ),
        lastOption: options[options.length - 1].getBoundingClientRect().toJSON(),
        container: document.querySelector('.scroll-container').getBoundingClientRect().toJSON(),
        viewport: {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        },
      };
    });
  }

  async function openMenu() {
    // The menu is appended to <body>, so re-rendering KDropdownMenuAtViewportEdge leaves
    // #testing-playground unchanged and renderComponentForVisualTest's change-wait times out.
    await renderComponentForVisualTest('div');
    await renderComponentForVisualTest('KDropdownMenuAtViewportEdge');
    await page.waitForSelector('.tippy-popper[x-placement] .ui-menu', { visible: true });
  }

  async function openMenuScrolledToEnd() {
    await openMenu();
    return measureMenu();
  }

  describe('with constrainToScrollParent false, opened at the right viewport edge', () => {
    it.each([
      [375, 700],
      [1024, 700],
      [667, 375],
    ])(
      'stays inside the viewport and extends outside the scroll container at %ix%ipx',
      async (width, height) => {
        await page.setViewport({ width, height });
        const { popover, headerParts, lastOption, container, viewport, scrollContainers } =
          await openMenuScrolledToEnd();

        expect(container.right).toBe(viewport.width);
        expect(popover.left).toBeGreaterThanOrEqual(0);
        expect(popover.top).toBeGreaterThanOrEqual(0);
        expect(popover.right).toBeLessThanOrEqual(viewport.width);
        expect(popover.bottom).toBeLessThanOrEqual(viewport.height);
        expect(popover.top).toBeLessThan(container.top);
        expect(headerParts[0].top).toBeGreaterThanOrEqual(popover.top);
        expect(headerParts[1].top).toBe(headerParts[0].top);
        expect(lastOption.bottom).toBeLessThanOrEqual(popover.bottom);
        expect(scrollContainers).toBeLessThanOrEqual(1);
      },
    );

    it('renders at the right viewport edge in a short viewport', async () => {
      await page.setViewport({ width: 667, height: 375 });
      await openMenuScrolledToEnd();
      await takeSnapshot('KDropdownMenu at the right viewport edge - 667x375px', {
        widths: [667],
        minHeight: 375,
      });
    });

    it('keeps the focused option in the list without scrolling the page', async () => {
      await page.setViewport({ width: 667, height: 375 });
      await openMenu();
      const measureFocus = () =>
        page.evaluate(() => {
          const list = document.querySelector('.tippy-popper .ui-menu');
          const options = [...list.querySelectorAll('[role="menuitem"]')];
          const box = list.getBoundingClientRect();
          const option = document.activeElement.getBoundingClientRect();
          return {
            focusedIndex: options.indexOf(document.activeElement),
            lastIndex: options.length - 1,
            inList: option.top >= box.top && option.bottom <= box.bottom,
            listScrollTop: list.scrollTop,
            maxListScrollTop: list.scrollHeight - list.clientHeight,
            scrollY: window.scrollY,
            expanded: document
              .querySelector('.scroll-content button')
              .getAttribute('aria-expanded'),
          };
        });
      const before = await measureFocus();
      expect(before).toMatchObject({
        focusedIndex: 0,
        inList: true,
        listScrollTop: 0,
        expanded: 'true',
      });

      await page.keyboard.press('End');
      const atEnd = await measureFocus();
      expect(atEnd).toEqual({
        ...before,
        focusedIndex: before.lastIndex,
        listScrollTop: before.maxListScrollTop,
      });

      await page.keyboard.press('Home');
      expect(await measureFocus()).toEqual(before);

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.tippy-popper'));
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.querySelector('.tippy-popper [role="menuitem"]') === document.activeElement,
      );
      const reopened = await measureFocus();
      expect(reopened).toEqual(before);
    });

    it('renders the option focused by ArrowDown', async () => {
      await page.setViewport({ width: 1024, height: 700 });
      await openMenu();
      await page.keyboard.press('ArrowDown');
      await takeSnapshot('KDropdownMenu with the second option focused by keyboard', {
        widths: [1024],
        minHeight: 700,
      });
    });

    it('stays inside the viewport after the viewport shrinks while open', async () => {
      await page.setViewport({ width: 1024, height: 700 });
      await openMenuScrolledToEnd();
      await page.setViewport({ width: 1024, height: 360 });
      await page.waitForFunction(
        () =>
          document.querySelector('.tippy-popper .ui-popover').getBoundingClientRect().bottom <=
          document.documentElement.clientHeight,
      );
      const { popover, lastOption, viewport } = await measureMenu();

      expect(popover.top).toBeGreaterThanOrEqual(0);
      expect(popover.right).toBeLessThanOrEqual(viewport.width);
      expect(popover.bottom).toBeLessThanOrEqual(viewport.height);
      expect(lastOption.bottom).toBeLessThanOrEqual(popover.bottom);
    });
  });

  describe('opened where the menu does not fit in the viewport', () => {
    let pageStyle;

    beforeEach(async () => {
      await page.setViewport({ width: 600, height: 300 });
      await renderComponentForVisualTest(
        'KButton',
        { text: 'Options', hasDropdown: true },
        {
          menu: {
            element: 'KDropdownMenu',
            elementProps: { options: Array.from({ length: 14 }, (_, i) => `Option ${i + 1}`) },
          },
        },
      );
      pageStyle = await page.addStyleTag({
        content: '#testing-playground { padding-top: 600px !important; min-height: 2500px; }',
      });
    });

    afterEach(async () => {
      await pageStyle.evaluate(style => style.remove());
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    });

    async function openAndMeasure(open) {
      const scrollYBefore = await page.evaluate(() => window.scrollY);
      await open();
      await page.waitForFunction(
        () => document.querySelector('.tippy-popper [role="menuitem"]') === document.activeElement,
      );
      const state = await page.evaluate(
        () =>
          new Promise(resolve =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const option = document.activeElement.getBoundingClientRect();
                resolve({
                  firstOptionInView: option.top >= 0 && option.bottom <= window.innerHeight,
                  expanded: document
                    .querySelector('#testing-playground [aria-haspopup="menu"]')
                    .getAttribute('aria-expanded'),
                  scrollY: window.scrollY,
                });
              }),
            ),
          ),
      );
      return { ...state, scrolledPage: state.scrollY !== scrollYBefore };
    }

    it('scrolls the page to the first option and stays open', async () => {
      const expected = { firstOptionInView: true, expanded: 'true', scrolledPage: true };
      await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
      expect(
        await openAndMeasure(() => page.click('#testing-playground [aria-haspopup="menu"]')),
      ).toMatchObject(expected);

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.tippy-popper'));
      await page.evaluate(() => window.scrollTo({ top: 550, behavior: 'instant' }));
      expect(await openAndMeasure(() => page.keyboard.press('Enter'))).toMatchObject(expected);
    });
  });
});
