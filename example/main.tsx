import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Typeahead, { TypeaheadDataSource, TypeaheadDataSourceEntry } from '../src/index.ts';
import { createGameInputTypeahead, type UseGameInput } from './GameInputTypeahead.tsx';
import '../src/style.css';
import './style.css';

const cities = ['東京', '大阪', 'Café Paris', 'Straße Berlin', 'Łódź', 'Ærø', 'Αθήνα', '한국어'];
function createSource() {
  const source = new TypeaheadDataSource<string>();
  source.addEntries(cities.map((city) => new TypeaheadDataSourceEntry(city, city, city)));
  return source;
}
const useDemoInput: UseGameInput = (action, handler) => {
  useEffect(() => {
    const listener = (event: Event) => handler(event as Parameters<typeof handler>[0]);
    window.addEventListener(`game:${action}`, listener);
    return () => window.removeEventListener(`game:${action}`, listener);
  }, [action, handler]);
};
const GameTypeahead = createGameInputTypeahead(useDemoInput);
const preventBlur = (event: { preventDefault: () => void }) => event.preventDefault();
function App() {
  const source = useMemo(() => createSource(), []);
  const tagSource = useMemo(() => createSource(), []);
  const gameSource = useMemo(() => createSource(), []);
  const [selected, setSelected] = useState('');
  const [tags, setTags] = useState<ReadonlyArray<string>>([]);
  const [error, setError] = useState('');
  const remote = useMemo(() => {
    const result = new TypeaheadDataSource<string>((query) => {
      void Promise.resolve(
        cities.filter((city) => city.toLowerCase().includes(query.toLowerCase())),
      )
        .then((matches) =>
          result.addEntries(matches.map((city) => new TypeaheadDataSourceEntry(city, city, city))),
        )
        .catch(() => {
          result.clearQueryCache();
          setError('Search unavailable. Try again.');
        });
    });
    return result;
  }, []);
  return (
    <main>
      <header>
        <h1>@nkzw/typeahead</h1>
      </header>
      <div className="grid">
        <section>
          <h2>Search</h2>
          <Typeahead
            dataSource={source}
            emptyResult="No places found."
            inputProps={{ 'aria-label': 'Find a place' }}
            onSelect={(entry) => {
              setSelected(entry.text);
            }}
            placeholder="Try cafe, strasse, lodz, or 東…"
          />
          {selected && <output data-testid="selection">{selected}</output>}
        </section>
        <section>
          <h2>Tags</h2>
          <Typeahead
            clearOnSelect
            createEntry={(text) => new TypeaheadDataSourceEntry(text, text, text)}
            dataSource={tagSource}
            ignoreList={new Set(tags)}
            inputProps={{ 'aria-label': 'Add a tag' }}
            onBackspace={() => setTags(tags.slice(0, -1))}
            onSelect={(entry) => {
              setTags([...tags, entry.text]);
            }}
            placeholder="Choose or create a tag…"
          />
          <div className="tags">
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTags(tags.filter((value) => value !== tag))}
                type="button"
              >
                {tag} ×
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2>Game controls</h2>
          <div className="controls">
            {(['previous', 'next', 'accept', 'cancel'] as const).map((action) => (
              <button
                key={action}
                onClick={() =>
                  window.dispatchEvent(new CustomEvent(`game:${action}`, { cancelable: true }))
                }
                onPointerDown={preventBlur}
                type="button"
              >
                {action}
              </button>
            ))}
          </div>
          <GameTypeahead
            dataSource={gameSource}
            inputProps={{ 'aria-label': 'Game search' }}
            onSelect={(entry) => {
              setSelected(entry.text);
            }}
            placeholder="Type a, then use the controls…"
          />
        </section>
        <section>
          <h2>Remote search</h2>
          <Typeahead
            dataSource={remote}
            emptyResult={error || 'No matches.'}
            inputProps={{ 'aria-label': 'Remote search' }}
            placeholder="Search 東京…"
          />
        </section>
      </div>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
