import { useRef } from 'react';
import Typeahead, { type TypeaheadControls, type TypeaheadProps } from '../src/index.ts';

export type GameInputEvents = {
  accept: undefined;
  cancel: { isEscape: boolean } | null;
  navigate: { x: -1 | 0 | 1; y: -1 | 0 | 1 };
  next: undefined;
  previous: undefined;
};
export type UseGameInput = <T extends keyof GameInputEvents>(
  action: T,
  handler: (event: CustomEvent<GameInputEvents[T]>) => void,
  layer: 'dialog',
) => void;

export function createGameInputTypeahead(useInput: UseGameInput) {
  return function GameInputTypeahead<T>(props: TypeaheadProps<T>) {
    const controls = useRef<TypeaheadControls>(null);
    useInput(
      'accept',
      (event) => {
        controls.current?.dispatch('accept', event);
      },
      'dialog',
    );
    useInput(
      'cancel',
      (event) => {
        controls.current?.dispatch('cancel', event);
      },
      'dialog',
    );
    useInput(
      'next',
      (event) => {
        controls.current?.dispatch('next', event);
      },
      'dialog',
    );
    useInput(
      'previous',
      (event) => {
        controls.current?.dispatch('previous', event);
      },
      'dialog',
    );
    useInput(
      'navigate',
      (event) => {
        if (event.detail.y) {
          controls.current?.dispatch(event.detail.y < 0 ? 'previous' : 'next', event);
        }
      },
      'dialog',
    );
    return <Typeahead {...props} controlsRef={controls} />;
  };
}
