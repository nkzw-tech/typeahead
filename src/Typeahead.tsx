import {
  type CompositionEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import type { TypeaheadDataSourceEntry } from './TypeaheadDataSource.ts';
import useTypeahead, { type TypeaheadOptions } from './useTypeahead.ts';

type TypeaheadState<T> = ReturnType<typeof useTypeahead<T>>;
export type TypeaheadListConfig<T> = {
  getOptionProps: TypeaheadState<T>['getOptionProps'];
  isHighlighted: (index: number) => boolean;
  listProps: TypeaheadState<T>['listProps'];
  onSelect: TypeaheadState<T>['select'];
  renderItem: (entry: TypeaheadDataSourceEntry<T>, highlighted: boolean) => ReactNode;
  setHighlighted: TypeaheadState<T>['setHighlighted'];
};
export type TypeaheadProps<T> = TypeaheadOptions<T> & {
  autoFocus?: boolean;
  className?: string;
  emptyResult?: ReactNode;
  inputClassName?: string;
  inputInvalid?: boolean;
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'defaultValue' | 'value' | 'disabled' | 'readOnly' | 'id'
  >;
  label?: ReactNode;
  placeholder?: string;
  renderInput?: (
    props: InputHTMLAttributes<HTMLInputElement> & { ref: Ref<HTMLInputElement> },
  ) => ReactNode;
  renderItem?: (entry: TypeaheadDataSourceEntry<T>, highlighted: boolean) => ReactNode;
  renderList?: (
    results: ReadonlyArray<TypeaheadDataSourceEntry<T>>,
    config: TypeaheadListConfig<T>,
  ) => ReactNode;
  resultClassName?: string;
};

const join = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');
const defaultRenderItem = (entry: TypeaheadDataSourceEntry<unknown>) => entry.text;

export default function Typeahead<T>({
  autoFocus,
  className,
  emptyResult,
  inputClassName,
  inputInvalid,
  inputProps: customInputProps,
  label,
  placeholder,
  renderInput,
  renderItem = defaultRenderItem,
  renderList,
  resultClassName,
  ...options
}: TypeaheadProps<T>) {
  const {
    containerRef,
    getOptionProps,
    highlightedIndex,
    inputProps,
    isOpen,
    listProps,
    results,
    select,
    setHighlighted,
  } = useTypeahead(options);
  const props = {
    ...customInputProps,
    ...inputProps,
    'aria-invalid': inputInvalid || customInputProps?.['aria-invalid'],
    autoFocus,
    className: join('nkzw-typeahead__input', inputClassName, customInputProps?.className),
    onBlur: (event: Parameters<typeof inputProps.onBlur>[0]) => {
      customInputProps?.onBlur?.(event);
      inputProps.onBlur(event);
    },
    onChange: (event: Parameters<typeof inputProps.onChange>[0]) => {
      customInputProps?.onChange?.(event);
      if (!event.defaultPrevented) {
        inputProps.onChange(event);
      }
    },
    onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => {
      inputProps.onCompositionEnd();
      customInputProps?.onCompositionEnd?.(event);
    },
    onCompositionStart: (event: CompositionEvent<HTMLInputElement>) => {
      inputProps.onCompositionStart();
      customInputProps?.onCompositionStart?.(event);
    },
    onFocus: (event: FocusEvent<HTMLInputElement>) => {
      customInputProps?.onFocus?.(event);
      inputProps.onFocus();
    },
    onKeyDown: (event: Parameters<typeof inputProps.onKeyDown>[0]) => {
      customInputProps?.onKeyDown?.(event);
      inputProps.onKeyDown(event);
    },
    placeholder: placeholder ?? customInputProps?.placeholder,
  };
  return (
    <div
      className={join('nkzw-typeahead', className)}
      data-open={isOpen ? '' : undefined}
      ref={containerRef}
    >
      {label && (
        <label className="nkzw-typeahead__label" htmlFor={inputProps.id}>
          {label}
        </label>
      )}
      {renderInput ? renderInput(props) : <input {...props} />}
      {isOpen &&
        (renderList && results.length ? (
          renderList(results, {
            getOptionProps,
            isHighlighted: (index) => index === highlightedIndex,
            listProps,
            onSelect: select,
            renderItem,
            setHighlighted,
          })
        ) : (
          <ul
            {...listProps}
            aria-label={customInputProps?.['aria-label']}
            className={join('nkzw-typeahead__results', resultClassName)}
          >
            {results.map((entry, index) => (
              <li {...getOptionProps(index)} className="nkzw-typeahead__option" key={entry.value}>
                {renderItem(entry, index === highlightedIndex)}
              </li>
            ))}
          </ul>
        ))}
      {isOpen && !results.length && emptyResult && (
        <div className="nkzw-typeahead__empty" role="status">
          {emptyResult}
        </div>
      )}
    </div>
  );
}
