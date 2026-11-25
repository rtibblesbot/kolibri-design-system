import { nextTick } from 'vue';
import { enableAutoDestroy, shallowMount } from '@vue/test-utils';
import { render, screen, fireEvent } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import KModal from '../KModal';
import KSelect from '../KSelect';
import KDropdownMenu from '../KDropdownMenu';
import KMultiSelect from '../candidate/multiselect/KMultiSelect';
import UiPopover from '../keen/UiPopover';
import UiTooltip from '../keen/UiTooltip';
import { flushMutationObservers, isHiddenFromAT } from '../../jest.conf/testUtils';

enableAutoDestroy(afterEach);

describe('KModal component', () => {
  it(`smoke test`, () => {
    const wrapper = shallowMount(KModal);
    expect(wrapper.exists()).toBe(true);
  });

  describe('props', () => {
    it(`a title should appear`, () => {
      const title = 'test title';
      const wrapper = shallowMount(KModal, {
        propsData: {
          title: title,
        },
      });
      expect(wrapper.find('.title').text()).toEqual(title);
    });
    it(`text should appear on the submit button`, () => {
      const submitText = 'hello';
      const onClick = jest.fn();
      const wrapper = shallowMount(KModal, {
        propsData: {
          submitText: submitText,
        },
        listeners: { submit: onClick },
      });
      expect(wrapper.findComponent({ name: 'KButton' }).props().text).toEqual(submitText);
    });

    it(`text should appear on the close button`, () => {
      const cancelText = 'goodbye';
      const onClick = jest.fn();
      const wrapper = shallowMount(KModal, {
        propsData: {
          cancelText: cancelText,
        },
        listeners: { cancel: onClick },
      });
      expect(wrapper.findComponent({ name: 'KButton' }).props().text).toEqual(cancelText);
    });

    it(`submit button is disabled if submitDisabled is true`, () => {
      const submitText = 'hello';
      const onClick = jest.fn();
      const wrapper = shallowMount(KModal, {
        propsData: {
          submitText: submitText,
          submitDisabled: true,
        },
        listeners: { submit: onClick },
      });
      expect(wrapper.findComponent({ name: 'KButton' }).props().disabled).toBeTruthy();
    });

    it(`cancel button is disabled if cancelDisabled is true`, () => {
      const cancelText = 'goodbye';
      const onClick = jest.fn();
      const wrapper = shallowMount(KModal, {
        propsData: {
          cancelText: cancelText,
          cancelDisabled: true,
        },
        listeners: { cancel: onClick },
      });
      expect(wrapper.findComponent({ name: 'KButton' }).props().disabled).toBeTruthy();
    });

    it(`size of modal can be determined with string prop`, () => {
      const wrapper = shallowMount(KModal, {
        propsData: {
          size: 'large',
        },
      });
      expect(wrapper.find('.modal').element).toHaveStyle({ width: '100%' });
    });

    it(`size of modal can be determined by integer prop`, () => {
      const wrapper = shallowMount(KModal, {
        propsData: {
          size: 789,
        },
      });
      expect(wrapper.find('.modal').element).toHaveStyle({ width: '789px' });
    });

    it(`error message is in a visually hidden span if hasError is true`, () => {
      const error = 'watch out for the error';
      const wrapper = shallowMount(KModal, {
        propsData: {
          hasError: true,
          errorMessage: error,
        },
      });
      expect(wrapper.find('.visuallyhidden').element).toBeTruthy();
      expect(wrapper.find('.visuallyhidden').text()).toContain(error);
    });
  });
  describe('slots', () => {
    it(`content is displayed in default <slot>`, () => {
      const slot = '<div><p>main content appears here</p></div>';
      const wrapper = shallowMount(KModal, {
        slots: {
          default: slot,
        },
      });
      expect(wrapper.find('.content').text()).toContain('main content appears here');
    });
    it(`alternative content is displayed below main content if actions <slot> is used`, () => {
      const slot = '<div><p>main content appears here</p></div>';
      const actionsSlot = '<div><p class="actionsSlot">actions content</p></div>';
      const wrapper = shallowMount(KModal, {
        slots: {
          default: slot,
          actions: actionsSlot,
        },
      });
      expect(wrapper.find('.content').text()).toContain('main content appears here');
      expect(wrapper.find('.actions').text()).toContain('actions content');
    });
  });

  describe('modal semantics', () => {
    const OPTIONS = [{ label: 'Apple', value: 'apple' }];
    const ENTER = { key: 'Enter', code: 'Enter', keyCode: 13 };
    const ESCAPE = { key: 'Escape', code: 'Escape', keyCode: 27 };
    const MULTISELECT_MESSAGES = Object.fromEntries(
      [
        'clearText',
        'open',
        'close',
        'clickable',
        'allOptionsSelected',
        'allOptionsDeselected',
        'optionDeselected',
      ].map(key => [key, () => key]),
    );
    let app;

    function getDialog(title = 'Modal') {
      return screen.getByRole('dialog', { name: title, hidden: true });
    }

    function renderModal(props = {}, slot = 'modal content') {
      return render(KModal, { props: { title: 'Modal', ...props }, slots: { default: slot } });
    }

    function renderInModal(components, content) {
      return render({
        components: { KModal, ...components },
        data: () => ({ options: OPTIONS, messages: MULTISELECT_MESSAGES }),
        template: `<KModal title="Modal" @submit="$emit('submit')" @cancel="$emit('cancel')">
            ${content}
          </KModal>`,
      });
    }

    beforeEach(() => {
      app = document.createElement('div');
      document.body.appendChild(app);
    });

    afterEach(() => {
      app.remove();
    });

    it.each([false, true])(
      `is an aria-modal dialog named by its title that hides the page until closed (appendToOverlay: %s)`,
      appendToOverlay => {
        const { unmount } = renderModal({ appendToOverlay });
        const dialog = getDialog();
        expect(document.getElementById('k-overlay').contains(dialog)).toBe(appendToOverlay);
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(isHiddenFromAT(dialog)).toBe(false);
        expect(app).toHaveAttribute('aria-hidden', 'true');
        expect(document.documentElement).toHaveStyle({ overflow: 'hidden' });
        unmount();
        expect(document.querySelector('[aria-hidden]')).toBeNull();
        expect(document.documentElement).not.toHaveStyle({ overflow: 'hidden' });
      },
    );

    it(`focuses the dialog on open`, async () => {
      renderModal();
      await flushMutationObservers();
      expect(getDialog()).toHaveFocus();
    });

    it(`restores the page while kept alive and inactive, and hides it and takes focus again on reactivation`, async () => {
      const Inner = { components: { KModal }, template: '<KModal title="Modal" />' };
      const Other = { template: '<div>Other</div>' };
      const { updateProps } = render(
        {
          components: { Inner, Other },
          props: ['showModal'],
          template: `<div><button>Header</button>
            <keep-alive><Inner v-if="showModal" /><Other v-else /></keep-alive></div>`,
        },
        { props: { showModal: true } },
      );
      expect(isHiddenFromAT(screen.getByText('Header'))).toBe(true);
      await updateProps({ showModal: false });
      expect(isHiddenFromAT(screen.getByText('Header'))).toBe(false);
      expect(document.documentElement).not.toHaveStyle({ overflow: 'hidden' });
      screen.getByText('Header').focus();
      await updateProps({ showModal: true });
      await nextTick();
      expect(isHiddenFromAT(screen.getByText('Header'))).toBe(true);
      expect(document.documentElement).toHaveStyle({ overflow: 'hidden' });
      expect(getDialog()).toHaveFocus();
    });

    it.each([
      [
        'KSelect',
        { KSelect },
        `<KSelect label="Fruit" :options="options" :value="{}" />`,
        () => fireEvent.click(screen.getByText('Fruit')),
        'Apple',
      ],
      [
        'KDropdownMenu',
        { KDropdownMenu },
        `<button type="button">Menu<KDropdownMenu :options="options" /></button>`,
        () => fireEvent.click(screen.getByText('Menu')),
        'Apple',
      ],
      [
        'UiPopover',
        { UiPopover },
        `<button type="button">Open<UiPopover>Popover content</UiPopover></button>`,
        () => fireEvent.click(screen.getByText('Open')),
        'Popover content',
      ],
      [
        'UiTooltip',
        { UiTooltip },
        `<button type="button">Open<UiTooltip>Popover content</UiTooltip></button>`,
        () => fireEvent.focus(screen.getByText('Open')),
        'Popover content',
      ],
    ])(
      `exposes a %s opened from the modal inside the dialog`,
      async (name, components, content, open, text) => {
        renderInModal(components, content);
        await flushMutationObservers();
        await open();
        await flushMutationObservers();
        const popover = screen.getByText(text);
        expect(getDialog()).toContainElement(popover);
        expect(isHiddenFromAT(popover)).toBe(false);
      },
    );

    describe('keys', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      async function press(el, key) {
        await fireEvent.keyDown(el, key);
        await fireEvent.keyUp(el, key);
      }

      async function renderReadyInModal(components, content) {
        const result = renderInModal(components, content);
        jest.advanceTimersByTime(500);
        await nextTick();
        return result;
      }

      it.each([
        ['Escape', 'cancel', 'the content'],
        ['Escape', 'cancel', 'the dialog itself'],
        ['Enter', 'submit', 'the content'],
        ['Enter', 'submit', 'the dialog itself'],
      ])(`on %s emits %s from %s`, async (key, event, from) => {
        const { emitted } = await renderReadyInModal({}, '<p>modal content</p>');
        const target =
          from === 'the content' ? screen.getByRole('heading', { name: 'Modal' }) : getDialog();
        await press(target, { Escape: ESCAPE, Enter: ENTER }[key]);
        expect(emitted()[event]).toHaveLength(1);
      });

      it.each([
        ['', () => {}],
        [
          ` after an Escape whose keyup a control stopped`,
          () => press(screen.getByLabelText('Search'), ESCAPE),
        ],
      ])(
        `does not cancel on Escape whose keydown a control stopped%s`,
        async (description, pressEarlierEscape) => {
          const { emitted } = await renderReadyInModal(
            {},
            `<input aria-label="Search" @keyup.esc.stop><input aria-label="Stopper" @keydown.esc.stop>`,
          );
          await pressEarlierEscape();
          await press(screen.getByLabelText('Stopper'), ESCAPE);
          expect(emitted().cancel).toBeUndefined();
        },
      );

      it(`cancels on Escape whose keydown a control only default-prevented`, async () => {
        const { emitted } = await renderReadyInModal(
          {},
          `<input aria-label="Preventer" @keydown.esc.prevent>`,
        );
        await press(screen.getByLabelText('Preventer'), ESCAPE);
        expect(emitted().cancel).toHaveLength(1);
      });

      it(`cancels on Escape from a select's clear button`, async () => {
        const { emitted } = await renderReadyInModal(
          { KSelect },
          `<KSelect label="Fruit" :options="options" :value="options[0]" clearable clearText="Clear it" />`,
        );
        await press(screen.getByRole('button', { name: 'Clear it' }), ESCAPE);
        expect(emitted().cancel).toHaveLength(1);
      });

      it(`does not cancel on a keyup after a nested modal handled Escape`, async () => {
        const { emitted } = render({
          components: { KModal },
          data: () => ({ inner: true }),
          template: `<KModal title="Outer" @cancel="$emit('cancel')">
            <input aria-label="Name" @keydown.esc.stop>
            <KModal v-if="inner" title="Inner" @cancel="inner = false" />
          </KModal>`,
        });
        jest.advanceTimersByTime(500);
        await nextTick();
        await press(getDialog('Inner'), ESCAPE);
        expect(
          screen.queryByRole('dialog', { name: 'Inner', hidden: true }),
        ).not.toBeInTheDocument();
        await press(screen.getByLabelText('Name'), ESCAPE);
        expect(emitted().cancel).toBeUndefined();
      });

      async function openMenuInReadyModal() {
        const result = await renderReadyInModal(
          { KDropdownMenu },
          `<button type="button">Menu<KDropdownMenu :options="options" @select="$emit('select')" /></button>`,
        );
        await fireEvent.click(screen.getByText('Menu'));
        jest.runAllTimers();
        return result;
      }

      it(`selects a dropdown menu item on Enter without submitting`, async () => {
        const { emitted } = await openMenuInReadyModal();
        await press(screen.getByText('Apple'), ENTER);
        expect(emitted().select).toHaveLength(1);
        expect(emitted().submit).toBeUndefined();
      });

      it(`closes a dropdown menu on Escape without cancelling`, async () => {
        const { emitted } = await openMenuInReadyModal();
        const trigger = screen.getByText('Menu');
        await fireEvent.keyDown(screen.getByText('Apple'), ESCAPE);
        await fireEvent.keyUp(trigger, ESCAPE);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(emitted().cancel).toBeUndefined();
        await press(trigger, ESCAPE);
        expect(emitted().cancel).toHaveLength(1);
      });

      it.each([
        [
          'select dropdown',
          { KSelect },
          `<KSelect label="Fruit" :options="options" :value="{}" />`,
          user => user.click(screen.getByText('Fruit')),
        ],
        [
          'multiple select dropdown after an option is clicked',
          { KSelect },
          `<KSelect label="Fruit" :options="options" :value="[]" multiple />`,
          async user => {
            await user.click(screen.getByText('Fruit'));
            jest.runAllTimers();
            await user.click(screen.getByText('Apple'));
          },
        ],
        [
          'multiselect dropdown',
          { KMultiSelect },
          `<KMultiSelect label="Fruit" :options="options" :value="[]" :messages="messages" />`,
          user => user.click(screen.getByRole('button', { name: 'open' })),
        ],
      ])(`closes a %s on Escape without cancelling`, async (name, components, content, open) => {
        const { emitted } = await renderReadyInModal(components, content);
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await open(user);
        jest.runAllTimers();
        await user.keyboard('{Escape}');
        jest.runAllTimers();
        expect(emitted().cancel).toBeUndefined();
        await user.keyboard('{Escape}');
        expect(emitted().cancel).toHaveLength(1);
      });
    });

    describe('focus wrapping', () => {
      const radios = checked => `
        <input type="radio" name="g" value="a" aria-label="a">
        <input type="radio" name="g" value="b" aria-label="b"${checked ? ' checked' : ''}>
        <input type="radio" name="g" value="c" aria-label="c">
      `;
      const FIRST = '<button type="button">First</button>';
      const LAST = '<button type="button">Last</button>';

      async function tab(options) {
        await userEvent.setup().tab(options);
        await flushMutationObservers();
      }

      function renderWithContent(content, props = {}) {
        render({
          components: { KModal },
          data: () => ({ props }),
          template: `<KModal title="Modal" v-bind="props">${content}</KModal>`,
        });
        return flushMutationObservers();
      }

      it.each([
        ['from the dialog to its last control', FIRST + LAST, {}, null, true, 'Last'],
        ['from the first control to the last', FIRST + LAST, {}, 'First', true, 'Last'],
        [
          'to a last control that is not a form control',
          FIRST + '<details><summary>More</summary></details>',
          {},
          null,
          true,
          'More',
        ],
        [
          'past disabled controls to the last one',
          FIRST,
          { submitText: 'Submit', submitDisabled: true, cancelText: 'Cancel' },
          null,
          true,
          'Cancel',
        ],
        [
          'past controls that refuse focus to the first one',
          FIRST + '<fieldset disabled><button type="button">Inside</button></fieldset>',
          {},
          null,
          true,
          'First',
        ],
        ['to the checked radio of a trailing group', FIRST + radios(true), {}, null, true, 'b'],
        ['to the checked radio of a leading group', radios(true) + LAST, {}, 'Last', false, 'b'],
        [
          'to the last radio of a trailing group with none checked',
          FIRST + radios(false),
          {},
          null,
          true,
          'c',
        ],
        [
          'to the first radio of a leading group with none checked',
          radios(false) + LAST,
          {},
          'Last',
          false,
          'a',
        ],
      ])(`moves focus %s`, async (description, content, props, from, shift, to) => {
        await renderWithContent(content, props);
        if (from) {
          screen.getByText(from).focus();
        }
        await tab({ shift });
        expect(
          screen.queryByLabelText(to) ||
            screen.queryByRole('button', { name: to }) ||
            screen.getByText(to),
        ).toHaveFocus();
      });

      it(`moves focus from the last control to the first before the next key press`, async () => {
        await renderWithContent(FIRST + LAST);
        screen.getByText('Last').focus();
        await userEvent.setup({ delay: null }).tab();
        expect(screen.getByText('First')).toHaveFocus();
      });

      it.each([
        ['Shift+Tab', { shift: true }],
        ['Tab', {}],
      ])(`keeps focus on a dialog with no controls on %s`, async (key, options) => {
        renderModal();
        await flushMutationObservers();
        await tab(options);
        expect(getDialog()).toHaveFocus();
      });

      it(`moves focus leaving a control for the background to the dialog`, async () => {
        app.tabIndex = 0;
        await renderWithContent(FIRST + LAST);
        screen.getByText('Last').focus();
        app.focus();
        await flushMutationObservers();
        expect(getDialog()).toHaveFocus();
      });

      it(`moves focus arriving on the first edge from outside the dialog to the dialog`, async () => {
        await renderWithContent(FIRST + LAST, { appendToOverlay: true, submitText: 'Delete' });
        document.activeElement.blur();
        await tab();
        expect(getDialog()).toHaveFocus();
      });
    });

    describe('stacked modals', () => {
      function renderStack(template, props = {}) {
        return render({ components: { KModal }, props: Object.keys(props), template }, { props });
      }

      it.each([
        `<KModal title="Outer"><KModal title="Inner" /></KModal>`,
        `<KModal title="Outer"><KModal title="Inner" appendToOverlay /></KModal>`,
        `<div><KModal title="Outer" /><KModal title="Inner" /></div>`,
      ])(`focuses the top dialog of %s`, async template => {
        renderStack(template);
        await flushMutationObservers();
        expect(getDialog('Inner')).toHaveFocus();
      });

      it.each([false, true])(
        `exposes a nested modal, not its parent, and keeps the page hidden until the parent closes (appendToOverlay: %s)`,
        async appendToOverlay => {
          const { updateProps } = renderStack(
            `<KModal v-if="outer" title="Outer">
              <p>outer content</p>
              <KModal v-if="inner" title="Inner" :appendToOverlay="${appendToOverlay}" />
            </KModal>`,
            { outer: true, inner: true },
          );
          expect(isHiddenFromAT(getDialog('Inner'))).toBe(false);
          expect(isHiddenFromAT(screen.getByText('outer content'))).toBe(true);
          await updateProps({ inner: false });
          expect(isHiddenFromAT(screen.getByText('outer content'))).toBe(false);
          expect(app).toHaveAttribute('aria-hidden', 'true');
          expect(document.documentElement).toHaveStyle({ overflow: 'hidden' });
          await updateProps({ outer: false });
          expect(document.querySelector('[aria-hidden]')).toBeNull();
        },
      );
    });
  });
});
