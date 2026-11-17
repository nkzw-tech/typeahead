# @nkzw/typeahead

**Typeahead** is an autocomplete component for React. It combines typed search results, local and remote data, customizable rendering, and keyboard, pointer, and gamepad integration.

## Features

- **Search Data:** A data source stores entries and matches queries against their text and aliases. Remote results are added to the same searchable cache.
- **Custom Rendering:** Use the component with your own styles, replace its input or result list, or build your own component with `useTypeahead`.
- **Unicode Search:** Search for `cafe` to find `Café`, or `strasse` to find `Straße`. Matching preserves meaningful differences in Japanese and other non-Latin scripts.
- **Input Controls:** Keyboard navigation, pointer selection, and IME composition are handled by the component. Connect a game's input system through the same navigation and selection controls.

Typeahead requires React 18.2+ or 19. React is its only runtime peer dependency. The package includes TypeScript declarations and an optional stylesheet.

## Contents

- [Getting Started](#getting-started)
- [Data Sources](#data-sources)
- [Custom Rendering](#custom-rendering)
- [Input Controls](#input-controls)
- [Development](#development)
- [Acknowledgements](#acknowledgements)

## Getting Started

Install Typeahead in an existing React app. It requires React 18.2+ or 19:

```bash
vp add @nkzw/typeahead
```

You can also install it with `npm add @nkzw/typeahead`, `pnpm add @nkzw/typeahead`, or `yarn add @nkzw/typeahead`.

### Creating a Search Field

Let's build a person search. First, create a data source and add the people that should appear in the results:

```tsx
import Typeahead, { TypeaheadDataSource, TypeaheadDataSourceEntry } from '@nkzw/typeahead';
import { useMemo } from 'react';
import '@nkzw/typeahead/style.css';

type Person = {
  id: string;
  name: string;
  username: string;
};

export function PersonSearch({
  onSelect,
  people,
}: {
  onSelect: (person: Person) => void;
  people: ReadonlyArray<Person>;
}) {
  const source = useMemo(() => {
    const source = new TypeaheadDataSource<Person>();
    source.addEntries(
      people.map(
        (person) => new TypeaheadDataSourceEntry(person.name, person.id, person, [person.username]),
      ),
    );
    return source;
  }, [people]);

  return (
    <Typeahead
      dataSource={source}
      emptyResult="No people found."
      label="Find a person"
      onSelect={(entry) => onSelect(entry.data)}
      placeholder="Search by name or username…"
    />
  );
}
```

The entry's `text` is shown in the result list. Its `value` identifies the person, and `data` holds the original `Person` object. The optional fourth argument adds searchable aliases. In this example, you can search by username while the list displays each person's name.

The source is recreated when `people` changes. For a source that receives incremental updates, keep the same instance and call `addEntries` or `updateEntry`. See [Data Sources](#data-sources).

Import the stylesheet for the default appearance, or supply your own styles. See [Custom Rendering](#custom-rendering).

### Selecting a Result

Selecting a result calls `onSelect`, fills the input with the entry's text, and closes the list. Return a string from `onSelect` to change the text that remains in the field:

```tsx
<Typeahead
  dataSource={source}
  label="Find a person"
  onSelect={(entry) => {
    onSelect(entry.data);
    return '';
  }}
/>
```

Here, selecting a person also clears the field. You can use `clearOnSelect` for the same behavior without returning a string. A string returned by `onSelect` takes precedence over `clearOnSelect`.

Use `blurOnSelect` to release focus after selection, for example when selecting a result opens a person's profile.

### Controlling the Input

`initialValue` sets the text when the component mounts. If another part of your app needs to update or reset the text, use `value` and `onValueChange`:

```tsx
import Typeahead, { type TypeaheadDataSource } from '@nkzw/typeahead';
import { useState } from 'react';

export function Search({ source }: { source: TypeaheadDataSource<string> }) {
  const [query, setQuery] = useState('');

  return (
    <>
      <Typeahead dataSource={source} label="Search" onValueChange={setQuery} value={query} />
      <button onClick={() => setQuery('')} type="button">
        Reset
      </button>
    </>
  );
}
```

`onValueChange` receives changes from typing, selection, and clearing the input. Update the controlled value synchronously, as you would with a regular React input.

### Labels and Forms

Use `label` to display a label connected to the input. For a label supplied elsewhere in the UI, pass `aria-label` or `aria-labelledby` through `inputProps`.

`inputProps` also accepts native input attributes such as `name`, `required`, and `maxLength`. Set `id`, `disabled`, and `readOnly` on `Typeahead` itself. Use `inputInvalid` to mark the field as invalid.

### Keyboard and Focus

The first result is highlighted by default. Arrow keys move through the results and wrap at either end. Set `autoHighlight={false}` to require navigation before Enter can select a result.

Enter selects the highlighted result. When there is no active result, Enter keeps its native behavior, including form submission. Tab moves focus normally. Escape closes the list; pressing it again with text in the field clears the input and releases focus.

Keys used during IME composition are left to the input method, so confirming Japanese text does not also select a search result.

The list closes when focus leaves the component or the user presses outside it. `autoHide={false}` keeps an open list visible in those cases, which is useful for an embedded search panel. Selection and explicit cancellation still close the list.

### Server Rendering

The component supports server rendering. For an app using React Server Components, create the data source inside a client component. The package's React entry point is marked `'use client'`; data-source class instances cannot be passed across the server/client boundary.

Use `@nkzw/typeahead/core` to search data on the server without importing React. See [Using Search Outside React](#using-search-outside-react).

## Data Sources

A data source stores searchable entries and returns matches for a query. The same source can hold data already available in your app and results fetched from a server.

### Defining Entries

Each `TypeaheadDataSourceEntry` has display text, a unique string ID, application data, and optional aliases:

```ts
import { TypeaheadDataSource, TypeaheadDataSourceEntry } from '@nkzw/typeahead';

const person = { id: '1', name: 'Chris', username: 'cpojer' };
const entry = new TypeaheadDataSourceEntry(person.name, person.id, person, [person.username]);
const source = new TypeaheadDataSource<typeof person>();

source.addEntries([entry]);
```

The generic type describes the entry's `data`. When this source is passed to a `Typeahead`, callbacks such as `onSelect` and `renderItem` receive that same type.

`addEntries` ignores entries whose IDs are already in the source. Two people with the same name can still appear as separate results because they have different IDs.

To update a person, pass a replacement entry to `updateEntry`:

```ts
source.updateEntry(
  new TypeaheadDataSourceEntry('Christopher', person.id, { ...person, name: 'Christopher' }, [
    person.username,
  ]),
);
```

This replaces the entry's data and searchable text, including its aliases. Components using the source update when entries change.

### Matching Queries

Search matches the beginning of words in order. For example, `al br` matches `Alpha Bravo`, and `br` also matches `Alpha Bravo`. `br al` does not match that label because the words are in a different order.

Latin text is matched without accents and with common character substitutions: `cafe` finds `Café`, `strasse` finds `Straße`, and `lodz` finds `Łódź`. Other scripts retain meaningful distinctions. For example, `カ` does not match `ガ`.

Aliases provide additional ways to find an entry. A city displayed as `東京` can have `Tokyo` as an alias. Text matches appear before alias matches. Within each batch added to the source, labels with fewer words are indexed first; ties follow insertion order. This ordering does not globally re-sort earlier batches.

The default limit is ten results. Pass a second constructor argument to change it:

```ts
const source = new TypeaheadDataSource<string>(null, 20);
```

Queries without searchable tokens return no results. This includes empty text, whitespace, and punctuation such as `---`. To inspect tokenization directly, use the exported `parseSearchTokens` function.

### Suggestions and Exclusions

Pass `emptySuggestions` to show a specific set of entries when the input is empty. Pass `ignoreList` with a set of entry IDs to hide values already selected, for example in a tag input.

`ignoreList` filters results after the source applies its limit. If several matches are excluded, the visible list can contain fewer items than the limit.

### Fetching Results

Now let's add a server query. Pass a handler to the data source and add the returned entries to that same source:

```tsx
import Typeahead, { TypeaheadDataSource, TypeaheadDataSourceEntry } from '@nkzw/typeahead';
import { useMemo, useState } from 'react';

type User = {
  id: string;
  name: string;
  username: string;
};

export function UserSearch({
  onSelect,
  searchUsers,
}: {
  onSelect: (user: User) => void;
  searchUsers: (query: string) => Promise<ReadonlyArray<User>>;
}) {
  const [error, setError] = useState('');
  const source = useMemo(() => {
    const source = new TypeaheadDataSource<User>((query) => {
      setError('');
      void searchUsers(query)
        .then((users) => {
          source.addEntries(
            users.map(
              (user) => new TypeaheadDataSourceEntry(user.name, user.id, user, [user.username]),
            ),
          );
        })
        .catch(() => {
          source.clearQueryCache();
          setError('Search unavailable. Please try again.');
        });
    });
    return source;
  }, [searchUsers]);

  return (
    <Typeahead
      dataSource={source}
      emptyResult={error || 'No matching users.'}
      label="Find a user"
      onSelect={(entry) => onSelect(entry.data)}
    />
  );
}
```

The component displays cached matches immediately. If they do not fill the result limit, the source waits 100 ms before calling the query handler. A new query during that time replaces the pending query. The handler receives the original text with surrounding whitespace removed.

Keep `searchUsers` stable between renders to retain the source and its cache. The handler starts requests; it does not return entries to the source. Add results through `addEntries`, as shown above.

The source remembers queries when their handlers run and does not request them again. `clearQueryCache()` clears that history so a later query can retry. It does not remove entries or start a request by itself.

Results arriving for an earlier query are added to the cache. The component continues to display matches for the text currently in the input. Each remote search field should have its own source, because a source tracks one pending query. Fields that only search local entries can share a source.

`emptyResult` appears immediately when the open list has no matches, including while a request is pending. Manage loading and error messages in your app if you want to distinguish those states. Unmounting the last subscriber cancels a pending debounce; cancellation of requests already sent to the server belongs in the query handler.

### Using Search Outside React

Import the search API from `@nkzw/typeahead/core` to use it without React or the DOM:

```ts
import { TypeaheadDataSource, TypeaheadDataSourceEntry } from '@nkzw/typeahead/core';

const source = new TypeaheadDataSource<string>();
source.addEntries([new TypeaheadDataSourceEntry('Café', 'cafe', 'cafe')]);

const results = source.getQueryResults('cafe');
```

`getQueryResults` returns cached matches synchronously. It does not change the active query or invoke the remote handler.

For query notifications, register a callback with `addQueryCallback`, then call `query(text)`. The callback receives the query text and its results, including updates when entries are added. Remove the same callback with `removeQueryCallback` when finished. `query` requires a subscriber to notify or start remote work.

For an external-store integration, `subscribe(listener)` notifies the listener when the cache changes and returns an unsubscribe function. `getSnapshot()` returns a revision number for the cache. The React hook uses these methods through `useSyncExternalStore`.

## Custom Rendering

Typeahead handles search and selection while your app controls how the input and results look. Start with the default markup, customize individual parts, or use `useTypeahead` to build a component of your own.

### Styling the Component

Import the optional stylesheet to use the default appearance:

```ts
import '@nkzw/typeahead/style.css';
```

Use `className`, `inputClassName`, and `resultClassName` to style the container, input, and list. For example, pass `className="person-search"` and override the stylesheet's custom properties:

```css
.person-search {
  --typeahead-background: #fff;
  --typeahead-color: #182f2b;
  --typeahead-border: #ccd6c7;
  --typeahead-highlight: #e7efdf;
  --typeahead-radius: 0.5rem;
}
```

The container has `data-open` while the list is open. The active option has `data-highlighted`. These attributes are also available when you use your own stylesheet.

### Rendering Results

Let's say each person has a username that you want to show alongside their name. Use `renderItem` to customize an option's contents:

```tsx
<Typeahead
  dataSource={source}
  label="Find a person"
  renderItem={({ data: person }) => (
    <span>
      <strong>{person.name}</strong>
      <small>@{person.username}</small>
    </span>
  )}
/>
```

The second argument to `renderItem` indicates whether the option is highlighted. Keep option contents non-interactive so focus can stay on the input. A result with its own links or buttons needs a different interaction design from a selectable listbox option.

### Using Your Own Input

Use `renderInput` to connect an existing input component:

```tsx
<Typeahead
  dataSource={source}
  label="Find a person"
  renderInput={(props) => <Input {...props} />}
/>
```

`Input` must forward the supplied props and ref to its native `<input>` element. These include the value, event handlers, and accessibility attributes used by Typeahead. If your input uses a separate validation prop, map `aria-invalid` to that prop in the renderer.

### Rendering a List

`renderList` receives the results and helpers for rendering a custom list. Spread `listProps` on the list and `getOptionProps(index)` on each option:

```tsx
<Typeahead
  dataSource={source}
  label="Find a person"
  renderList={(results, { getOptionProps, listProps }) => (
    <div {...listProps} className="person-results">
      {results.map((entry, index) => (
        <div {...getOptionProps(index)} key={entry.value}>
          {entry.text}
        </div>
      ))}
    </div>
  )}
/>
```

The supplied props connect the input to the list and its active option. They also handle pointer highlighting and selection. Render the entire result list in order so each option's index matches the index passed to `getOptionProps`.

The configuration also includes `isHighlighted(index)`, `onSelect(entry)`, `renderItem(entry, highlighted)`, and `setHighlighted(index)`. Passing `-1` to `setHighlighted` removes the highlight.

### Creating Entries

A tag input often needs to accept values that are not in its data source. `createEntry` turns the text in the input into a selectable entry:

```tsx
import Typeahead, { TypeaheadDataSource, TypeaheadDataSourceEntry } from '@nkzw/typeahead';
import { useMemo } from 'react';

export function TagSearch({
  onAdd,
  tags,
}: {
  onAdd: (tag: string) => void;
  tags: ReadonlyArray<string>;
}) {
  const source = useMemo(() => new TypeaheadDataSource<string>(), []);

  return (
    <Typeahead
      clearOnSelect
      createEntry={(text) => new TypeaheadDataSourceEntry(text, text, text)}
      dataSource={source}
      ignoreList={new Set(tags)}
      label="Add a tag"
      onSelect={(entry) => onAdd(entry.data)}
    />
  );
}
```

The created entry appears before cached matches unless an entry with the same ID is already present or excluded. `createEntry` returns the same data type as the source, so you can create application objects as well as strings.

Use `onBackspace` to remove the previous tag when the input is empty. `emptySuggestions` can provide existing tags for the user to choose from before typing.

### Building a Component with `useTypeahead`

For full control of the markup, use the hook directly:

```tsx
import { useTypeahead, type TypeaheadDataSource } from '@nkzw/typeahead';

export function Search({ source }: { source: TypeaheadDataSource<string> }) {
  const { containerRef, getOptionProps, inputProps, isOpen, listProps, results } = useTypeahead({
    dataSource: source,
  });

  return (
    <div ref={containerRef}>
      <input {...inputProps} aria-label="Search" />
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
```

The hook accepts the component's search and selection options, including `dataSource`, `value`, `onSelect`, and `createEntry`. Attach `containerRef` to the element containing the input and results so outside presses and focus changes can be handled correctly.

It also returns `query`, `highlightedIndex`, `select`, `setHighlighted`, and `controls`. See [Input Controls](#input-controls) for connecting navigation and selection to an application's input system.

## Input Controls

Some apps receive input from a gamepad, a command system, or controls elsewhere in the UI. `controlsRef` lets those inputs use Typeahead's existing navigation and selection behavior.

### Focusing and Clearing

Create a ref and pass it to the component:

```tsx
import Typeahead, { type TypeaheadControls, type TypeaheadDataSource } from '@nkzw/typeahead';
import { useRef } from 'react';

export function Search({ source }: { source: TypeaheadDataSource<string> }) {
  const controls = useRef<TypeaheadControls>(null);

  return (
    <>
      <button onClick={() => controls.current?.focus()} type="button">
        Search
      </button>
      <Typeahead controlsRef={controls} dataSource={source} label="Search" />
    </>
  );
}
```

The controls expose `focus()`, `blur()`, `clear()`, and `hide()`. `clear` clears the text and closes the list. `hide` closes the list while keeping the current text.

Use `inputRef` if you need the native input element instead. It receives `null` when the input unmounts.

### Dispatching Actions

Call `dispatch(action, event?)` to navigate or select a result:

| Action     | Behavior                                                                 |
| ---------- | ------------------------------------------------------------------------ |
| `next`     | Highlight the next result, wrapping to the first.                        |
| `previous` | Highlight the previous result, wrapping to the last.                     |
| `accept`   | Select the highlighted result in an open list.                           |
| `cancel`   | Close the list, or clear and blur an input whose list is already closed. |

Dispatch returns `true` when the action is handled. It acts only on the focused, enabled, editable input and ignores actions during composition. If you pass an event, it must expose `defaultPrevented` and `preventDefault()`. Already-prevented events are ignored; handled events are prevented.

This allows several components to listen to an application's input system while only the focused Typeahead consumes the action.

### Connecting a Game's Input System

For a game with a `useInput` hook, connect each action to the controls. The following code belongs inside your game's Typeahead wrapper, where `useInput` is imported from the game:

```tsx
const controls = useRef<TypeaheadControls>(null);

useInput('accept', (event) => controls.current?.dispatch('accept', event), 'dialog');
useInput('cancel', (event) => controls.current?.dispatch('cancel', event), 'dialog');
useInput('next', (event) => controls.current?.dispatch('next', event), 'dialog');
useInput('previous', (event) => controls.current?.dispatch('previous', event), 'dialog');
useInput(
  'navigate',
  (event) => {
    if (event.detail.y) {
      controls.current?.dispatch(event.detail.y < 0 ? 'previous' : 'next', event);
    }
  },
  'dialog',
);

return <Typeahead controlsRef={controls} dataSource={source} label="Search" />;
```

The game continues to own gamepad detection, event routing, and input layers. Typeahead handles the resulting action without depending on the game's input system.

The [game-input example](example/GameInputTypeahead.tsx) provides a typed adapter factory for this pattern. Create the wrapper at module scope, then use it like the regular component. The local demo exercises it with cancelable custom events.

## Development

Typeahead uses Vite+ for development, testing, formatting, linting, and packaging. Install the dependencies and Chromium for the browser tests:

```bash
vp install
vp exec playwright install chromium
```

### Running the Examples

Start the local development server:

```bash
vp run dev
```

The examples cover local search, creating tags, remote queries, and connecting application input controls. Try searching for `cafe`, `strasse`, or `東` to see how matching works.

### Verifying Changes

Format the code and run lint and type checks with:

```bash
vp check --fix
```

Run the complete validation before submitting a change:

```bash
vpr test:all
```

This runs formatting, linting, type checking, unit tests, the library build, a packed-consumer check, and Chromium tests. The packed-consumer check installs a local tarball into a temporary directory, verifies its exports and declarations, and renders the component on the server.

For a focused test run, use `vp test run` with a test-file path. `vp run test:browser` runs the browser tests separately.

### Building

Build the package with:

```bash
vp pack
```

`vp run build` runs the same command. The build writes ES modules, TypeScript declarations, source maps, and the optional stylesheet to `lib/`. The JavaScript targets ES2022. React remains a peer dependency, and the `core` entry point can be used without it.

### Publishing

Update the version in `package.json`, commit the release changes, and authenticate with npm using an account that can publish `@nkzw/typeahead`. Then run:

```bash
vpr ship
```

`ship` runs the full validation and publishes the package with public access. It leaves the package manager's Git and registry checks enabled. Version changes, commits, and tags are managed separately.

The published package includes the compiled library, stylesheet, README, license, and package metadata. To inspect a tarball locally without publishing, run `vp pm pack`.

## Acknowledgements

Thank you to [Tom Occhino](https://github.com/tomocchino) and [tomocchino/typeahead](https://github.com/tomocchino/typeahead) for the inspiration.

Typeahead was extracted from [Athena Crisis](https://athenacrisis.com). It is maintained by [Nakazawa Tech](https://nakazawa.tech/).

Released under the [MIT License](LICENSE).
