import useKLiveRegion from '../index.js';

const { _moveLiveRegion, sendPoliteMessage, sendAssertiveMessage } = useKLiveRegion();

describe('useKLiveRegion', () => {
  // this is taken care of by KThemePlugin.js that is already registered
  // in the global jest setup
  it(`document body contains live regions upon the KDS plugin initialization`, () => {
    expect(`
      <div id="k-live-region" class="visuallyhidden">
        <div aria-live="polite">
        </div>
        <div aria-live="assertive">
        </div>
      </div>
    `).toBeInDom();
  });

  it(`'sendPoliteMessage' updates the live region with the message`, async () => {
    expect(`
      <div id="k-live-region" class="visuallyhidden">
        <div aria-live="polite">
        </div>
        <div aria-live="assertive">
        </div>
      </div>
    `).toBeInDom();

    sendPoliteMessage('Polite message');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(`
      <div id="k-live-region" class="visuallyhidden">
        <div aria-live="polite">
          Polite message
        </div>
        <div aria-live="assertive">
        </div>
      </div>
    `).toBeInDom();

    // cleanup
    sendPoliteMessage('');
  });

  it(`'sendAssertiveMessage' updates the live region with the message`, async () => {
    expect(`
      <div id="k-live-region" class="visuallyhidden">
        <div aria-live="polite">
        </div>
        <div aria-live="assertive">
        </div>
      </div>
    `).toBeInDom();

    sendAssertiveMessage('Assertive message');
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(`
      <div id="k-live-region" class="visuallyhidden">
        <div aria-live="polite">
        </div>
        <div aria-live="assertive">
          Assertive message
        </div>
      </div>
    `).toBeInDom();

    // cleanup
    sendAssertiveMessage('');
  });

  it.each([
    ['sendPoliteMessage', 'politeRegionEl', sendPoliteMessage],
    ['sendAssertiveMessage', 'assertiveRegionEl', sendAssertiveMessage],
  ])(`'%s' does not throw without a live region`, (name, regionKey, send) => {
    const regionEl = window[regionKey];
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    window[regionKey] = undefined;
    jest.useFakeTimers();
    try {
      expect(() => send('Message')).not.toThrow();
      expect(() => jest.advanceTimersByTime(350)).not.toThrow();
      expect(consoleError).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      window[regionKey] = regionEl;
      consoleError.mockRestore();
    }
  });

  describe('_moveLiveRegion', () => {
    let container;

    function getPoliteRegion() {
      return document.querySelector('#k-live-region [aria-live="polite"]');
    }

    beforeEach(() => {
      jest.useFakeTimers();
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      _moveLiveRegion(document.body);
      container.remove();
      getPoliteRegion().textContent = '';
      jest.useRealTimers();
    });

    it(`rewrites a message sent in the same task after moving, then clears it`, () => {
      sendPoliteMessage('Moved to trash');
      _moveLiveRegion(container);
      expect(getPoliteRegion()).toBeEmptyDOMElement();
      jest.advanceTimersByTime(100);
      expect(getPoliteRegion()).toHaveTextContent(/^Moved to trash$/);
      jest.advanceTimersByTime(349);
      expect(getPoliteRegion()).toHaveTextContent(/^Moved to trash$/);
      jest.advanceTimersByTime(1);
      expect(getPoliteRegion()).toBeEmptyDOMElement();
      _moveLiveRegion(document.body);
      jest.advanceTimersByTime(200);
      expect(getPoliteRegion()).toBeEmptyDOMElement();
    });

    it(`does not rewrite a message once a later task has run`, () => {
      sendPoliteMessage('Moved to trash');
      jest.advanceTimersByTime(300);
      _moveLiveRegion(container);
      expect(getPoliteRegion()).toHaveTextContent(/^Moved to trash$/);
      jest.advanceTimersByTime(50);
      expect(getPoliteRegion()).toBeEmptyDOMElement();
      jest.advanceTimersByTime(500);
      expect(getPoliteRegion()).toBeEmptyDOMElement();
    });
  });
});
