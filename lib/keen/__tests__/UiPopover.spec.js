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
});
