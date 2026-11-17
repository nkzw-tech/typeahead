import {
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { TypeaheadDataSource, type TypeaheadDataSourceEntry } from './TypeaheadDataSource.ts';

export type TypeaheadAction = 'next' | 'previous' | 'accept' | 'cancel';
type InputEvent = { defaultPrevented: boolean; preventDefault: () => void };
export type TypeaheadControls = {
  blur: () => void;
  clear: () => void;
  dispatch: (action: TypeaheadAction, event?: InputEvent) => boolean;
  focus: () => void;
  hide: () => void;
};

export type TypeaheadOptions<T> = {
  autoHide?: boolean;
  autoHighlight?: boolean;
  blurOnSelect?: boolean;
  clearOnSelect?: boolean;
  controlsRef?: Ref<TypeaheadControls>;
  createEntry?: (value: string) => TypeaheadDataSourceEntry<T>;
  dataSource: TypeaheadDataSource<T>;
  disabled?: boolean;
  emptySuggestions?: ReadonlyArray<TypeaheadDataSourceEntry<T>>;
  id?: string;
  ignoreList?: ReadonlySet<string>;
  initialValue?: string;
  inputRef?: Ref<HTMLInputElement>;
  onBackspace?: () => void;
  onSelect?: (result: TypeaheadDataSourceEntry<T>) => string | void;
  onValueChange?: (value: string) => void;
  readOnly?: boolean;
  value?: string;
};

export default function useTypeahead<T>({
  autoHide = true,
  autoHighlight = true,
  blurOnSelect = false,
  clearOnSelect = false,
  controlsRef,
  createEntry,
  dataSource,
  disabled = false,
  emptySuggestions,
  id,
  ignoreList,
  initialValue = '',
  inputRef,
  onBackspace,
  onSelect,
  onValueChange,
  readOnly = false,
  value,
}: TypeaheadOptions<T>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-listbox`;
  const input = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const composing = useRef(false);
  const [localValue, setLocalValue] = useState(initialValue);
  const query = value ?? localValue;
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState({ dataSource, index: autoHighlight ? 0 : -1, query });
  useSyncExternalStore(dataSource.subscribe, dataSource.getSnapshot, dataSource.getSnapshot);
  const results = (() => {
    let entries = query ? dataSource.getQueryResults(query) : (emptySuggestions ?? []);
    if (
      createEntry &&
      query.trim() &&
      !ignoreList?.has(query) &&
      !entries.some(({ value }) => value === query)
    ) {
      entries = [createEntry(query), ...entries];
    }
    return entries.filter(({ value }) => !ignoreList?.has(value));
  })();
  const isOpen = open && !disabled && !readOnly;
  const highlightedIndex = Math.min(
    highlight.query === query && highlight.dataSource === dataSource
      ? highlight.index
      : autoHighlight
        ? 0
        : -1,
    results.length - 1,
  );

  const setQuery = useCallback(
    (next: string) => {
      setLocalValue(next);
      onValueChange?.(next);
    },
    [onValueChange],
  );

  const hide = useCallback(() => setOpen(false), []);
  const focus = useCallback(() => input.current?.focus(), []);
  const blur = useCallback(() => input.current?.blur(), []);
  const clear = useCallback(() => {
    setQuery('');
    setOpen(false);
    dataSource.query('');
  }, [dataSource, setQuery]);
  const setHighlighted = useCallback(
    (index: number) => {
      setHighlight({ dataSource, index, query });
    },
    [dataSource, query],
  );

  const select = useCallback(
    (entry: TypeaheadDataSourceEntry<T>) => {
      if (disabled || readOnly) {
        return;
      }
      const next = onSelect?.(entry);
      setQuery(typeof next === 'string' ? next : clearOnSelect ? '' : entry.text);
      setOpen(false);
      dataSource.query('');
      if (blurOnSelect) {
        blur();
      }
    },
    [blur, blurOnSelect, clearOnSelect, dataSource, disabled, onSelect, readOnly, setQuery],
  );

  const dispatch = useCallback(
    (action: TypeaheadAction, event?: InputEvent) => {
      if (
        event?.defaultPrevented ||
        disabled ||
        readOnly ||
        composing.current ||
        !input.current ||
        input.current.ownerDocument.activeElement !== input.current
      ) {
        return false;
      }
      switch (action) {
        case 'next':
        case 'previous': {
          if (!results.length) {
            return false;
          }
          setOpen(true);
          const index = !isOpen
            ? action === 'next'
              ? 0
              : results.length - 1
            : action === 'next'
              ? (highlightedIndex + 1) % results.length
              : highlightedIndex <= 0
                ? results.length - 1
                : highlightedIndex - 1;
          setHighlighted(index);
          break;
        }
        case 'accept': {
          const entry = isOpen ? results[highlightedIndex] : undefined;
          if (!entry) {
            return false;
          }
          select(entry);
          break;
        }
        case 'cancel': {
          if (isOpen) {
            hide();
          } else if (query) {
            clear();
            blur();
          } else {
            return false;
          }
          break;
        }
      }
      event?.preventDefault();
      return true;
    },
    [
      blur,
      clear,
      disabled,
      hide,
      highlightedIndex,
      isOpen,
      query,
      readOnly,
      results,
      select,
      setHighlighted,
    ],
  );

  const controls = useMemo(
    () => ({ blur, clear, dispatch, focus, hide }),
    [blur, clear, dispatch, focus, hide],
  );
  useImperativeHandle(controlsRef, () => controls, [controls]);

  useImperativeHandle(inputRef, () => input.current!);
  const ref = input;

  useEffect(() => {
    if (focused && isOpen) {
      dataSource.query(query);
    }
  }, [dataSource, focused, isOpen, query]);

  useEffect(() => {
    if (!autoHide || !isOpen) {
      return;
    }
    const doc = input.current?.ownerDocument;
    const onPointerDown = (event: PointerEvent) => {
      if (!event.defaultPrevented && !containerRef.current?.contains(event.target as Node)) {
        hide();
      }
    };
    doc?.addEventListener('pointerdown', onPointerDown);
    return () => doc?.removeEventListener('pointerdown', onPointerDown);
  }, [autoHide, hide, isOpen]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0) {
      input.current?.ownerDocument
        .getElementById(`${listId}-${highlightedIndex}`)
        ?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen, listId]);

  const inputProps = {
    'aria-activedescendant':
      isOpen && focused && results[highlightedIndex] ? `${listId}-${highlightedIndex}` : undefined,
    'aria-autocomplete': 'list' as const,
    'aria-controls': isOpen ? listId : undefined,
    'aria-expanded': isOpen,
    autoCapitalize: 'off',
    autoComplete: 'off',
    autoCorrect: 'off',
    disabled,
    id: inputId,
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      if (autoHide && !containerRef.current?.contains(event.relatedTarget as Node | null)) {
        hide();
      }
    },
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
      setHighlighted(autoHighlight ? 0 : -1);
      setOpen(true);
    },
    onCompositionEnd: () => {
      composing.current = false;
    },
    onCompositionStart: () => {
      composing.current = true;
    },
    onFocus: () => {
      setFocused(true);
      setOpen(true);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (
        event.defaultPrevented ||
        event.nativeEvent.isComposing ||
        event.nativeEvent.keyCode === 229 ||
        composing.current
      ) {
        return;
      }
      if (event.key === 'Backspace' && !query) {
        onBackspace?.();
      }
      const action = (
        { ArrowDown: 'next', ArrowUp: 'previous', Enter: 'accept', Escape: 'cancel' } as const
      )[event.key as 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape'];
      if (action && dispatch(action, event) && event.key === 'Escape') {
        event.stopPropagation();
      }
    },
    readOnly,
    ref,
    role: 'combobox',
    spellCheck: false,
    type: 'text',
    value: query,
  } satisfies InputHTMLAttributes<HTMLInputElement> & { ref: typeof ref };

  const getOptionProps = (index: number) => ({
    'aria-selected': index === highlightedIndex,
    'data-highlighted': index === highlightedIndex ? '' : undefined,
    id: `${listId}-${index}`,
    onClick: () => {
      if (results[index]) {
        select(results[index]);
      }
    },
    onPointerDown: (event: { preventDefault: () => void }) => event.preventDefault(),
    onPointerMove: () => setHighlighted(index),
    role: 'option',
  });

  return {
    containerRef,
    controls,
    getOptionProps,
    highlightedIndex,
    inputProps,
    isOpen,
    listProps: { id: listId, role: 'listbox' },
    query,
    results,
    select,
    setHighlighted,
  };
}
