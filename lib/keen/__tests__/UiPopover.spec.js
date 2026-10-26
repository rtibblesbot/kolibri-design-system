import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import UiPopover from '../UiPopover.vue';

const flush = ms => new Promise(resolve => setTimeout(resolve, ms));
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

describe('UiPopover', () => {
  it('opened on focus, lets Tab move focus off its trigger', async () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();
    render({
      components: { UiPopover },
      methods: { onOpen, onClose },
      template: `
        <div>
          <button>Trigger<UiPopover openOn="focus" @open="onOpen" @close="onClose">Content</UiPopover></button>
          <button>After</button>
        </div>
      `,
    });
    await user.tab();
    await waitFor(() => expect(onOpen).toHaveBeenCalled());
    await user.tab();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('opened on hover, returns focus from its content to the element focused before it opened', async () => {
    const user = userEvent.setup();
    render({
      components: { UiPopover },
      template: `
        <div>
          <input aria-label="Field">
          <button>Trigger<UiPopover openOn="hover"><button>Inside</button></UiPopover></button>
        </div>
      `,
    });
    const field = screen.getByRole('textbox', { name: 'Field' });
    const trigger = screen.getByRole('button', { name: /Trigger/ });
    field.focus();
    await user.hover(trigger);
    const inside = await screen.findByRole('button', { name: 'Inside' });
    inside.focus();
    await user.unhover(trigger);
    await user.pointer({ coords: { x: 500, y: 500 }, target: document.body });
    await waitFor(() => expect(field).toHaveFocus());
  });

  it.each([
    ['a right-click', (user, target) => user.pointer({ keys: '[MouseRight]', target })],
    ['a drag', (_, target) => fireEvent.dragStart(target)],
  ])('closes on %s outside it', async (_, act) => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();
    render({
      components: { UiPopover },
      methods: { onOpen, onClose },
      template: `
        <div>
          <button>Trigger<UiPopover @open="onOpen" @close="onClose">Content</UiPopover></button>
          <a href="#outside">Outside</a>
        </div>
      `,
    });
    await user.click(screen.getByRole('button', { name: /Trigger/ }));
    await waitFor(() => expect(onOpen).toHaveBeenCalled());
    await flush();
    await act(user, screen.getByRole('link', { name: 'Outside' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('stays open while scrolls keep following focus into its content', async () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();
    render({
      components: { UiPopover },
      methods: { onOpen, onClose },
      template: `<button>Trigger<UiPopover @open="onOpen" @close="onClose"><button>Inside</button></UiPopover></button>`,
    });
    await user.click(screen.getByRole('button', { name: /Trigger/ }));
    await waitFor(() => expect(onOpen).toHaveBeenCalled());
    await flush();
    screen.getByRole('button', { name: 'Inside' }).focus();
    for (let i = 0; i < 4; i++) {
      await nextFrame();
      fireEvent.scroll(document);
    }
    expect(onClose).not.toHaveBeenCalled();
    await nextFrame();
    await nextFrame();
    fireEvent.scroll(document);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('opened on click, stays open on a right-click on its trigger', async () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();
    render({
      components: { UiPopover },
      methods: { onOpen, onClose },
      template: `<button>Trigger<UiPopover @open="onOpen" @close="onClose">Content</UiPopover></button>`,
    });
    const trigger = screen.getByRole('button', { name: /Trigger/ });
    await user.click(trigger);
    await waitFor(() => expect(onOpen).toHaveBeenCalled());
    await flush();
    await user.pointer({ keys: '[MouseRight]', target: trigger });
    await flush(50);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opened manually, closes on a click on its trigger', async () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();
    render({
      components: { UiPopover },
      methods: { onOpen, onClose },
      template: `
        <button>Trigger<UiPopover ref="popover" openOn="manual" @open="onOpen" @close="onClose">Content</UiPopover></button>
      `,
      mounted() {
        this.$refs.popover.open();
      },
    });
    await waitFor(() => expect(onOpen).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /Trigger/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
