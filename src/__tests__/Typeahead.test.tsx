// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef, StrictMode, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import Typeahead, {
  TypeaheadDataSource,
  TypeaheadDataSourceEntry,
  type TypeaheadControls,
  useTypeahead,
} from '../index.ts';

const createSource = (names = ['Alpha', 'Alpha Bravo', '東京', '大阪']) => {
  const source = new TypeaheadDataSource<string>();
  source.addEntries(names.map((name) => new TypeaheadDataSourceEntry(name, name, name)));
  return source;
};
afterEach(cleanup);

function setup(props: Partial<Parameters<typeof Typeahead<string>>[0]> = {}) {
  const onSelect = vi.fn();
  const view = render(
    <Typeahead dataSource={createSource()} label="Search" onSelect={onSelect} {...props} />,
  );
  const input = screen.getByRole<HTMLInputElement>('combobox');
  act(() => input.focus());
  return { ...view, input, onSelect };
}
const query = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });

test('selects with keyboard, maintains active-descendant, and closes after selection', () => {
  const { input, onSelect } = setup();
  query(input, 'al');
  expect(screen.getAllByRole('option')).toHaveLength(2);
  expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id);
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSelect.mock.calls[0][0].value).toBe('Alpha');
  expect(input.value).toBe('Alpha');
  expect(input.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(input.getAttribute('aria-activedescendant')).toBeNull();
});

test.each([{ isComposing: true }, { keyCode: 229 }])('does not intercept IME keys: %j', (init) => {
  const { input, onSelect } = setup();
  query(input, '東');
  for (const key of ['Enter', 'Escape', 'ArrowUp', 'ArrowDown']) {
    expect(fireEvent.keyDown(input, { ...init, key })).toBe(true);
  }
  expect(input.value).toBe('東');
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input.value).toBe('東京');
});

test('composition lifecycle also guards programmatic input', async () => {
  const controls = createRef<TypeaheadControls>();
  const { input, onSelect } = setup({ controlsRef: controls });
  query(input, '東');
  fireEvent.compositionStart(input);
  expect(controls.current?.dispatch('accept')).toBe(false);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  await act(async () => {
    controls.current?.dispatch('accept');
  });
  expect(input.value).toBe('東京');
});

test('does not consume Enter without an active result or Tab', () => {
  const { input } = setup();
  query(input, 'missing');
  expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true);
  query(input, 'al');
  expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(true);
});

test('Escape dismisses results before clearing and blurring the input', () => {
  const { input } = setup();
  query(input, 'al');
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(input.value).toBe('al');
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(input.value).toBe('');
  expect(document.activeElement).not.toBe(input);
});

test('mouse selection clears and blurs when configured', () => {
  const { input, onSelect } = setup({ blurOnSelect: true, clearOnSelect: true });
  query(input, 'al');
  const option = screen.getAllByRole('option')[1];
  expect(fireEvent.pointerDown(option, { pointerType: 'mouse' })).toBe(false);
  fireEvent.click(option);
  expect(onSelect.mock.calls[0][0].text).toBe('Alpha Bravo');
  expect(input.value).toBe('');
  expect(document.activeElement).not.toBe(input);
});

test('cleans up subscriptions under StrictMode and observes async additions', () => {
  const source = createSource([]);
  const { unmount } = render(
    <StrictMode>
      <Typeahead dataSource={source} label="Async" />
    </StrictMode>,
  );
  const input = screen.getByRole<HTMLInputElement>('combobox');
  act(() => input.focus());
  query(input, 'br');
  act(() => source.addEntries([new TypeaheadDataSourceEntry('Alpha', 'a', 'a')]));
  expect(screen.queryByRole('option')).toBeNull();
  act(() => source.addEntries([new TypeaheadDataSourceEntry('Bravo', 'b', 'b')]));
  expect(screen.getByRole('option').textContent).toBe('Bravo');
  unmount();
  expect(() =>
    source.addEntries([new TypeaheadDataSourceEntry('Charlie', 'c', 'c')]),
  ).not.toThrow();
});

test('switches sources without exposing or selecting old results', () => {
  const { input, rerender } = setup();
  query(input, 'al');
  const onSelect = vi.fn();
  rerender(<Typeahead dataSource={createSource(['Almond'])} label="Search" onSelect={onSelect} />);
  expect(screen.getAllByRole('option').map((entry) => entry.textContent)).toEqual(['Almond']);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSelect.mock.calls[0][0].text).toBe('Almond');
});

test('controlled input responds to both typing and parent resets', () => {
  const source = createSource();
  function Controlled() {
    const [value, setValue] = useState('');
    return (
      <>
        <Typeahead dataSource={source} label="Search" onValueChange={setValue} value={value} />
        <button onClick={() => setValue('東')} type="button">
          Reset
        </button>
      </>
    );
  }
  render(<Controlled />);
  const input = screen.getByRole<HTMLInputElement>('combobox');
  act(() => input.focus());
  query(input, 'al');
  expect(input.value).toBe('al');
  fireEvent.click(screen.getByText('Reset'));
  expect(input.value).toBe('東');
  expect(screen.getByRole('option').textContent).toBe('東京');
});

test('freeform entries are typed, excluded values are hidden, and empty suggestions work', () => {
  const entry = new TypeaheadDataSourceEntry('Suggested', 'suggested', 'suggested');
  const { input, onSelect } = setup({
    createEntry: (text) => new TypeaheadDataSourceEntry(text, text, text),
    emptySuggestions: [entry],
    ignoreList: new Set(['Alpha']),
  });
  expect(screen.getByRole('option').textContent).toBe('Suggested');
  query(input, 'al');
  expect(screen.getAllByRole('option').map((entry) => entry.textContent)).toEqual([
    'al',
    'Alpha Bravo',
  ]);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSelect.mock.calls[0][0].data).toBe('al');
});

test('selection callback can clear the field for tag entry', () => {
  const { input } = setup({ onSelect: () => '' });
  query(input, 'al');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input.value).toBe('');
});

test('external navigation only consumes events for the focused enabled input', async () => {
  const first = createRef<TypeaheadControls>();
  const second = createRef<TypeaheadControls>();
  const source = createSource();
  const { rerender } = render(
    <>
      <Typeahead controlsRef={first} dataSource={source} label="First" />
      <Typeahead controlsRef={second} dataSource={source} label="Second" />
    </>,
  );
  const input = screen.getByLabelText<HTMLInputElement>('First');
  act(() => input.focus());
  query(input, 'al');
  const event = { defaultPrevented: false, preventDefault: vi.fn() };
  expect(second.current?.dispatch('next', event)).toBe(false);
  act(() => expect(first.current?.dispatch('next', event)).toBe(true));
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  await act(async () => {
    first.current?.dispatch('accept');
  });
  expect(input.value).toBe('Alpha Bravo');
  rerender(<Typeahead controlsRef={first} dataSource={source} disabled label="First" />);
  expect(first.current?.dispatch('accept')).toBe(false);
});

test('supports custom list markup with valid accessibility relationships', () => {
  const { input } = setup({
    renderList: (results, { getOptionProps, listProps }) => (
      <div {...listProps}>
        {results.map((entry, index) => (
          <div {...getOptionProps(index)} key={entry.value}>
            {entry.text}
          </div>
        ))}
      </div>
    ),
  });
  query(input, 'al');
  expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toBe(
    screen.getAllByRole('option')[0],
  );
  expect(document.getElementById(input.getAttribute('aria-controls')!)).toBe(
    screen.getByRole('listbox'),
  );
});

test('respects a custom key handler that prevents default', () => {
  const { input, onSelect } = setup({
    inputProps: { onKeyDown: (event) => event.preventDefault() },
  });
  query(input, 'al');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSelect).not.toHaveBeenCalled();
});

test('dismisses on outside pointer and blur, even when multiple instances exist', () => {
  const { input } = setup();
  query(input, 'al');
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(screen.getByRole('listbox')).toBeTruthy();
  act(() => input.blur());
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('read-only fields do not open or select', () => {
  const { input, onSelect } = setup({ initialValue: 'al', readOnly: true });
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSelect).not.toHaveBeenCalled();
});

test('renders on the server without browser globals or duplicate IDs', () => {
  const source = createSource();
  const html = renderToString(
    <>
      <Typeahead dataSource={source} label="First" />
      <Typeahead dataSource={source} label="Second" />
    </>,
  );
  const ids = [...html.matchAll(/<input[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(2);
});

test('headless hook supplies keyboard and selection behavior', () => {
  const source = createSource();
  function Headless() {
    const { containerRef, getOptionProps, inputProps, isOpen, listProps, results } = useTypeahead({
      dataSource: source,
    });
    return (
      <div ref={containerRef}>
        <input {...inputProps} aria-label="Headless" />
        {isOpen && (
          <ul {...listProps}>
            {results.map((entry, index) => (
              <li {...getOptionProps(index)} key={entry.value}>
                {entry.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  render(<Headless />);
  const input = screen.getByRole<HTMLInputElement>('combobox');
  act(() => input.focus());
  query(input, 'al');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input.value).toBe('Alpha');
});

test('preserves focus during a touch selection', () => {
  const { input, onSelect } = setup();
  query(input, 'al');
  const option = screen.getAllByRole('option')[0];
  expect(fireEvent.pointerDown(option, { pointerType: 'touch' })).toBe(false);
  fireEvent.click(option);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(input);
});

test('focus-preserving external controls do not dismiss the list', () => {
  const { input } = setup();
  query(input, 'al');
  const button = document.createElement('button');
  button.addEventListener('pointerdown', (event) => event.preventDefault());
  document.body.append(button);
  fireEvent.pointerDown(button);
  expect(screen.getByRole('listbox')).toBeTruthy();
  button.remove();
});

test('selection cancels pending remote work without fetching the selected label', async () => {
  vi.useFakeTimers();
  try {
    const handler = vi.fn();
    const source = new TypeaheadDataSource<string>(handler);
    source.addEntries([new TypeaheadDataSourceEntry('Alpha', 'alpha', 'alpha')]);
    const { input } = setup({ dataSource: source });
    query(input, 'al');
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(handler).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

test('input refs follow custom input replacements and clear on unmount', () => {
  const inputRef = createRef<HTMLInputElement>();
  const source = createSource();
  const { rerender, unmount } = render(
    <Typeahead dataSource={source} inputRef={inputRef} label="Search" />,
  );
  const first = inputRef.current;
  rerender(
    <Typeahead
      dataSource={source}
      inputRef={inputRef}
      label="Search"
      renderInput={(props) => <input {...props} key="replacement" />}
    />,
  );
  expect(inputRef.current).toBe(screen.getByRole('combobox'));
  expect(inputRef.current).not.toBe(first);
  unmount();
  expect(inputRef.current).toBeNull();
});

test('persistent result panels stay open on blur but still close on selection', () => {
  const { input } = setup({ autoHide: false });
  query(input, 'al');
  act(() => input.blur());
  fireEvent.pointerDown(document.body);
  expect(screen.getByRole('listbox')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('option')[0]);
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(input.value).toBe('Alpha');
});
