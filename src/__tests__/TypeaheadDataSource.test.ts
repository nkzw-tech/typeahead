import { afterEach, describe, expect, test, vi } from 'vitest';
import parseSearchTokens from '../parseSearchTokens.ts';
import { TypeaheadDataSource, TypeaheadDataSourceEntry } from '../TypeaheadDataSource.ts';

function flatten(results: ReadonlyArray<TypeaheadDataSourceEntry<unknown>>) {
  return results.map((entry) => entry.text);
}

function createTestDataSource(entries: Array<string>, maxResults: number = 4) {
  const dataSource = new TypeaheadDataSource<string>(null, maxResults);
  dataSource.addEntries(entries.map((text) => new TypeaheadDataSourceEntry(text, text, text)));
  return dataSource;
}

describe('Alpha Bravo tests', () => {
  const dataSource = createTestDataSource([
    'Alpha Bravo Charlie',
    'Alpha Bravo',
    'Alpha',
    'Bravo Alpha',
    'Bravo',
    'Charlie Bravo Alpha',
    'Alpha Bravo Alpha',
  ]);

  test("should return matches in the right order (query = 'alpha')", () => {
    const results = flatten(dataSource.getQueryResults('alpha'));
    expect(results).toEqual(['Alpha', 'Alpha Bravo', 'Bravo Alpha', 'Alpha Bravo Charlie']);
  });

  test("should return matches in the right order (query = 'bravo')", () => {
    const results = flatten(dataSource.getQueryResults('bravo'));
    expect(results).toEqual(['Bravo', 'Bravo Alpha', 'Alpha Bravo', 'Alpha Bravo Charlie']);
  });

  test("should match multiple instances of the same token (query = 'alpha alpha')", () => {
    const results = flatten(dataSource.getQueryResults('alpha alpha'));
    expect(results).toEqual(['Alpha Bravo Alpha']);
  });

  test("should match multiple instances of the same substring token (query = 'al al')", () => {
    const results = flatten(dataSource.getQueryResults('al al'));
    expect(results).toEqual(['Alpha Bravo Alpha']);
  });
});

describe('Buffalo Creek tests', () => {
  const dataSource = createTestDataSource([
    'Buffalo Creek',
    'Chicago Creek',
    'Chicago',
    'Creek Town',
    'Creekside',
  ]);

  test("should match the correct number of words (query = 'c c')", () => {
    const results = flatten(dataSource.getQueryResults('c c'));
    expect(results).toContain('Chicago Creek');
    expect(results).not.toContain('Chicago');
    expect(results).not.toContain('Creekside');
  });

  test("should return single word matches first (query = 'c')", () => {
    const results = flatten(dataSource.getQueryResults('c'));
    expect(results).toEqual(['Chicago', 'Creekside', 'Chicago Creek', 'Creek Town']);
  });

  test("should return single word matches first (query = 'creek')", () => {
    const results = flatten(dataSource.getQueryResults('creek'));
    expect(results).toEqual(['Creekside', 'Chicago Creek', 'Creek Town', 'Buffalo Creek']);
  });
});

describe('Lake Tahoe tests', () => {
  const dataSource = createTestDataSource([
    'Lake Tahoe',
    'Lake Tahoe',
    'South Lake Tahoe',
    'Tahoe',
  ]);

  test("should not allow duplicate entries to be added (query = 'lake tahoe')", () => {
    const results = dataSource.getQueryResults('lake tahoe');
    expect(results).toHaveLength(2);
  });

  test("should return entries with last word matching the query (query = 'tahoe')", () => {
    const results = flatten(dataSource.getQueryResults('tahoe'));
    expect(results).toEqual(['Tahoe', 'Lake Tahoe', 'South Lake Tahoe']);
  });

  test("should return entries with middle word matching the query (query = 'lake')", () => {
    const results = flatten(dataSource.getQueryResults('lake'));
    expect(results).toEqual(['Lake Tahoe', 'South Lake Tahoe']);
  });

  test("should return entries with two words matching the query (query = 'lake tahoe')", () => {
    const results = flatten(dataSource.getQueryResults('lake tahoe'));
    expect(results).toEqual(['Lake Tahoe', 'South Lake Tahoe']);
  });

  test("should return only entries that have a prefix match (query = 'ake')", () => {
    const results = dataSource.getQueryResults('ake');
    expect(results).toHaveLength(0);
  });
});

describe('Duplicates tests', () => {
  const dataSource = new TypeaheadDataSource<null>();
  dataSource.addEntries([
    new TypeaheadDataSourceEntry('A Star Is Born', 'asib2018', null),
    new TypeaheadDataSourceEntry('A Star Is Born', 'asib1954', null),
    new TypeaheadDataSourceEntry('A Star Is Born', 'asib1976', null),
    new TypeaheadDataSourceEntry('A Star Is Born', 'asib1937', null),
    new TypeaheadDataSourceEntry('A Star Is Born', 'asib2010', null),
    new TypeaheadDataSourceEntry('Stars Are Nice', 'asib2018', null),
    new TypeaheadDataSourceEntry('Hey Look At Me', 'asib2018', null),
  ]);

  test("should allow duplicate entries with unique values (query = 'A Star Is Born')", () => {
    const results = flatten(dataSource.getQueryResults('A Star Is Born'));
    expect(results).toHaveLength(5);
  });

  test("should only accept the first entry for a given value (query = 'star')", () => {
    const results = flatten(dataSource.getQueryResults('star'));
    expect(results).toHaveLength(5);
  });

  test("should only accept the first entry for a particular value (query = 'look')", () => {
    const results = flatten(dataSource.getQueryResults('look'));
    expect(results).toHaveLength(0);
  });
});

describe('Keywords tests', () => {
  const dataSource = new TypeaheadDataSource<null>(null, 4);
  dataSource.addEntries([
    new TypeaheadDataSourceEntry('one', 'one', null, ['first', 'worst']),
    new TypeaheadDataSourceEntry('two', 'two', null, ['second', 'best']),
    new TypeaheadDataSourceEntry('three', 'three', null, ['third']),
    new TypeaheadDataSourceEntry('four', 'four', null, ['fourth']),
    new TypeaheadDataSourceEntry('five', 'five', null, ['fifth']),
  ]);

  test("should return matches based on keywords (query = 'worst')", () => {
    const results = flatten(dataSource.getQueryResults('worst'));
    expect(results).toEqual(['one']);
  });

  test("should return matches based on keywords (query = 'best')", () => {
    const results = flatten(dataSource.getQueryResults('best'));
    expect(results).toEqual(['two']);
  });

  test("should return only one instance of each match (query = 't')", () => {
    const results = flatten(dataSource.getQueryResults('t'));
    expect(results).toEqual(['two', 'three']);
  });

  test("should return text matches before keyword matches (query = 'f')", () => {
    const results = flatten(dataSource.getQueryResults('f'));
    expect(results).toEqual(['four', 'five', 'one']);
  });
});

describe('Titan Movie tests', () => {
  const dataSource = createTestDataSource([
    'Titan',
    'The Titan',
    'Two Titans',
    'Attack on Titan II: The Roar of Awakening Some Long Thing',
  ]);

  test("should return all matching entries for the query 'titan'", () => {
    const results = dataSource.getQueryResults('titan');
    expect(results).toHaveLength(4);
  });
});

test.each<[string, ReadonlyArray<string>]>([
  ['Hello', ['hello']],
  ['HELLO', ['hello']],
  ['HeLlO', ['hello']],
  ['Ḣéļḹö Ⱳôȑĺȡ', ['hello', 'world']],
  ['Les Misérable', ['les', 'miserable']],
  ['ỆᶍǍᶆṔƚÉ áéíóúýčďěňřšťžů', ['example', 'aeiouycdenrstzu']],
  ['Æon Flux', ['aeon', 'flux']],
  ['ŒUVRE œuf', ['oeuvre', 'oeuf']],
  ['Straße STRAẞE', ['strasse', 'strasse']],
  ['Łódź Smør Đorđe Þór', ['lodz', 'smor', 'dorde', 'thor']],
  ['ﬀ ﬁ ﬂ ﬃ ﬄ ﬆ', ['ff', 'fi', 'fl', 'ffi', 'ffl', 'st']],
  ['ᴬᴮ', ['ab']],
  ['Ǆ Ĳ', ['dz', 'ij']],
  ['８½ ١٢٣', ['８½', '١٢٣']],
  ['İSTANBUL', ['istanbul']],
  ['  Alpha\tBravo\n ', ['alpha', 'bravo']],
  ['Hello-World', ['hello', 'world']],
  ['Hello·World', ['hello', 'world']],
  ['Hello•World', ['hello', 'world']],
  ['Hello_World', ['hello', 'world']],
  ['Hello…World', ['hello', 'world']],
  ['Hello(World)', ['hello', 'world']],
  ['Hello<World>', ['hello', 'world']],
  ['Hello:  World', ['hello', 'world']],
  ['Hello---World', ['hello', 'world']],
  ['¡Hello World!', ['hello', 'world']],
  ['Hello #1 World', ['hello', '1', 'world']],
  ['Hello #@$%! World', ['hello', 'world']],
  ['Hello…...^-There-^...…World', ['hello', 'there', 'world']],
  ['A$B$C$D$E$F$G$H', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']],
  ["Can't", ['cant']],
  ["The Smith's", ['the', 'smiths']],
  ['This won’t work, will it?', ['this', 'wont', 'work', 'will', 'it']],
  ['Hello“World”', ['hello', 'world']],
  ['"Hello\'World\'"', ['helloworld']],
  ['He+llo', ['he', '+', 'llo']],
  ['Hello +', ['hello', '+']],
  ['Hello+World', ['hello', '+', 'world']],
  ['Hello & World', ['hello', '&', 'world']],
  ['Hello&World', ['hello', '&', 'world']],
  ['WALL·E', ['wall', 'e']],
  ['61*', ['61']],
  ['Bigger Stronger Faster*', ['bigger', 'stronger', 'faster']],
  ['Blood+', ['blood', '+']],
  ['Patti Cake$', ['patti', 'cake']],
  ['*batteries not included', ['batteries', 'not', 'included']],
  ['Bat*21', ['bat', '21']],
  ['$5 a Day', ['5', 'a', 'day']],
  ['M*A*S*H', ['m', 'a', 's', 'h']],
  ['What the #$*! Do We (K)now!?', ['what', 'the', 'do', 'we', 'k', 'now']],
  ['Totally F***ed Up', ['totally', 'f', 'ed', 'up']],
  ['東京、大阪。', ['東京', '大阪']],
  ['がっこう ガンダム', ['がっこう', 'ガンダム']],
  ['中文地图', ['中文地图']],
  ['한국어', ['한국어']],
  ['МОСКВА Йошкар-Ола', ['москва', 'йошкар', 'ола']],
  ['Αθήνα', ['αθήνα']],
  ['العَرَبِيَّة', ['العَرَبِيَّة']],
  ['हिन्दी', ['हिन्दी']],
  ['שָׁלוֹם', ['שָׁלוֹם']],
  ['ภาษาไทย', ['ภาษาไทย']],
  ['می‌روم', ['می‌روم']],
  ['𠮷野家', ['𠮷野家']],
  ['Cafe\u0301 東京', ['cafe', '東京']],
  ['', []],
  [' \t\n ', []],
  ['---…!?', []],
  ['\u0301\u3099', []],
  ['🎮🚀', []],
])('tokenizes %j as %j', (value, tokens) => {
  expect(parseSearchTokens(value)).toEqual(tokens);
  expect(parseSearchTokens(tokens.join(' '))).toEqual(tokens);
});

test.each([
  ['cafe', 'Café'],
  ['café', 'Cafe\u0301'],
  ['strasse', 'Straße'],
  ['aeon', 'Æon'],
  ['oeuvre', 'Œuvre'],
  ['lodz', 'Łódź'],
  ['smor', 'Smør'],
  ['fiction', 'ﬁction'],
  [' alpha', 'Alpha'],
  ['alpha ', 'Alpha'],
  ['bravo', 'Alpha-Bravo'],
  ['cant', "Can't"],
  ['東京', '東京タワー'],
  ['ガ', 'カ\u3099ンダム'],
  ['カ\u3099', 'ガンダム'],
  ['한국', '한국어'],
  ['한국'.normalize('NFD'), '한국어'],
  ['моск', 'Москва'],
  ['中文', '中文地图'],
  ['αθή', 'Αθήνα'],
  ['हिन', 'हिन्दी'],
  ['العَرَ', 'العَرَبِيَّة'],
  ['שָׁ', 'שָׁלוֹם'],
  ['ภาษา', 'ภาษาไทย'],
  ['𠮷', '𠮷野家'],
])('matches %j against %j', (query, text) => {
  const dataSource = createTestDataSource([text]);
  expect(flatten(dataSource.getQueryResults(query))).toEqual([text]);
});

test.each([
  ['東京', '大阪'],
  ['Москва', 'Киев'],
  ['カ', 'ガンダム'],
  ['は', 'ば'],
  ['й', 'и'],
  ['ё', 'е'],
  ['α', 'ά'],
  ['हिंद', 'हिन्दी'],
  ['東京', 'Tokyo'],
  ['𠮷', '𠮸'],
  ['', 'Alpha'],
  [' ', 'Alpha'],
  ['---', 'Alpha'],
  ['🎮', 'Alpha'],
  ['---', '!!!'],
  ['\u0301', '\u0301'],
])('does not match %j against %j', (query, text) => {
  expect(createTestDataSource([text]).getQueryResults(query)).toEqual([]);
});

test('preserves original entry text, value, and data', () => {
  const data = { name: 'Café 東京' };
  const entry = new TypeaheadDataSourceEntry(data.name, 'Original-ID', data, ['Æon']);
  const dataSource = new TypeaheadDataSource<typeof data>();
  dataSource.addEntries([entry]);
  expect(dataSource.getQueryResults('aeon')).toEqual([entry]);
  expect(entry.text).toBe('Café 東京');
  expect(entry.value).toBe('Original-ID');
  expect(entry.data).toBe(data);
});

test('finds a server-returned user by username or display name', () => {
  const user = { displayName: 'Chris', id: 'user-1', username: 'Cpojer' };
  const entry = new TypeaheadDataSourceEntry(user.displayName, user.id, user, [user.username]);
  const dataSource = new TypeaheadDataSource<typeof user>();
  dataSource.addEntries([entry]);
  expect(dataSource.getQueryResults('cpojer')).toEqual([entry]);
  expect(dataSource.getQueryResults('chris')).toEqual([entry]);
});

test('normalizes multiword aliases and supports text followed by alias tokens', () => {
  const entry = new TypeaheadDataSourceEntry('Chris', '1', null, ['Café-東京']);
  const dataSource = new TypeaheadDataSource<null>();
  dataSource.addEntries([entry]);
  for (const query of ['cafe 東京', '東京', 'chris cafe']) {
    expect(dataSource.getQueryResults(query)).toEqual([entry]);
  }
});

test('ranks text matches before aliases even across separate batches', () => {
  const dataSource = new TypeaheadDataSource<null>(null, 2);
  const alias = new TypeaheadDataSourceEntry('First', '1', null, ['Alpha']);
  const text = new TypeaheadDataSourceEntry('Alpha', '2', null, ['Alpha']);
  const otherText = new TypeaheadDataSourceEntry('Alpha Bravo', '3', null);
  dataSource.addEntries([alias]);
  dataSource.addEntries([text, otherText]);
  expect(dataSource.getQueryResults('al')).toEqual([text, otherText]);
});

test('does not count a text and alias match twice toward the limit', () => {
  const dataSource = new TypeaheadDataSource<null>(null, 2);
  const text = new TypeaheadDataSourceEntry('Alpha', '1', null, ['Alpha', 'Alpha']);
  const alias = new TypeaheadDataSourceEntry('Bravo', '2', null, ['Alpha']);
  dataSource.addEntries([text, alias]);
  expect(dataSource.getQueryResults('al')).toEqual([text, alias]);
});

test('deduplicates by original ID, not normalized text', () => {
  const dataSource = new TypeaheadDataSource<null>();
  const first = new TypeaheadDataSourceEntry('Café', '1', null, ['first']);
  const second = new TypeaheadDataSourceEntry('Cafe', '2', null);
  dataSource.addEntries([first, second]);
  dataSource.addEntries([new TypeaheadDataSourceEntry('Changed', '1', null, ['other'])]);
  expect(dataSource.getQueryResults('cafe')).toEqual([first, second]);
  expect(dataSource.getQueryResults('first')).toEqual([first]);
  expect(dataSource.getQueryResults('other')).toEqual([]);
});

test('updating an entry removes old text and aliases and keeps its new data', () => {
  const dataSource = new TypeaheadDataSource<number>();
  dataSource.addEntries([new TypeaheadDataSourceEntry('Old Map', '1', 1, ['old-alias'])]);
  const entry = new TypeaheadDataSourceEntry('New Map', '1', 2, ['new-alias']);
  dataSource.updateEntry(entry);
  expect(dataSource.getQueryResults('old')).toEqual([]);
  expect(dataSource.getQueryResults('old alias')).toEqual([]);
  expect(dataSource.getQueryResults('new')).toEqual([entry]);
  expect(dataSource.getQueryResults('new alias')).toEqual([entry]);
});

test('indexes aliases even when the label has no searchable tokens', () => {
  const entry = new TypeaheadDataSourceEntry('🎮', '1', null, ['game']);
  const dataSource = new TypeaheadDataSource<null>();
  dataSource.addEntries([entry, new TypeaheadDataSourceEntry('', '2', null)]);
  expect(dataSource.getQueryResults('game')).toEqual([entry]);
  expect(dataSource.getQueryResults('🎮')).toEqual([]);
});

test.each([0, -1])('returns no results when the limit is %i', (limit) => {
  expect(createTestDataSource(['Alpha'], limit).getQueryResults('a')).toEqual([]);
});

afterEach(() => vi.useRealTimers());

test('notifies every subscriber and preserves other subscribers on cleanup', () => {
  const dataSource = createTestDataSource(['Alpha']);
  const first = vi.fn();
  const second = vi.fn();
  dataSource.addQueryCallback(first);
  dataSource.addQueryCallback(second);
  dataSource.query('a');
  expect(first).toHaveBeenCalledWith('a', dataSource.getQueryResults('a'));
  expect(second).toHaveBeenCalledWith('a', dataSource.getQueryResults('a'));
  dataSource.removeQueryCallback(first);
  dataSource.query('al');
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(2);
});

test('adding async entries reruns the latest query, not an older request', () => {
  const dataSource = createTestDataSource([]);
  const callback = vi.fn();
  dataSource.addQueryCallback(callback);
  dataSource.query('alpha');
  dataSource.query('bravo');
  dataSource.addEntries([new TypeaheadDataSourceEntry('Alpha', 'a', 'a')]);
  expect(callback).toHaveBeenLastCalledWith('bravo', []);
  const entry = new TypeaheadDataSourceEntry('Bravo', 'b', 'b');
  dataSource.addEntries([entry]);
  expect(callback).toHaveBeenLastCalledWith('bravo', [entry]);
});

test('debounces remote requests while returning cached matches immediately', () => {
  vi.useFakeTimers();
  const handler = vi.fn();
  const callback = vi.fn();
  const dataSource = new TypeaheadDataSource<string>(handler);
  const entry = new TypeaheadDataSourceEntry('Café', '1', '1');
  dataSource.addEntries([entry]);
  dataSource.addQueryCallback(callback);
  dataSource.query('c');
  vi.advanceTimersByTime(50);
  dataSource.query(' cafe ');
  expect(callback).toHaveBeenLastCalledWith(' cafe ', [entry]);
  vi.advanceTimersByTime(99);
  expect(handler).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(handler).toHaveBeenCalledExactlyOnceWith('cafe');
  dataSource.query('cafe');
  vi.runAllTimers();
  expect(handler).toHaveBeenCalledTimes(1);
});

test.each(['', '   ', '---', '🎮', '\u0301'])(
  'cancels a pending request for empty query %j',
  (value) => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const callback = vi.fn();
    const dataSource = new TypeaheadDataSource<string>(handler);
    dataSource.addQueryCallback(callback);
    dataSource.query('alpha');
    dataSource.query(value);
    vi.runAllTimers();
    expect(handler).not.toHaveBeenCalled();
    expect(callback).toHaveBeenLastCalledWith(value, []);
  },
);

test('keeps original Unicode in remote requests', () => {
  vi.useFakeTimers();
  const handler = vi.fn();
  const dataSource = new TypeaheadDataSource<string>(handler);
  dataSource.addQueryCallback(vi.fn());
  dataSource.query('  がっこう Café  ');
  vi.runAllTimers();
  expect(handler).toHaveBeenCalledExactlyOnceWith('がっこう Café');
});

test('does not fetch when cached results fill the limit, including aliases', () => {
  vi.useFakeTimers();
  const handler = vi.fn();
  const dataSource = new TypeaheadDataSource<null>(handler, 1);
  dataSource.addEntries([new TypeaheadDataSourceEntry('Chris', '1', null, ['cpojer'])]);
  dataSource.addQueryCallback(vi.fn());
  dataSource.query('pending');
  dataSource.query('cpojer');
  vi.runAllTimers();
  expect(handler).not.toHaveBeenCalled();
});

test('cancels pending work only when the last subscriber is removed', () => {
  vi.useFakeTimers();
  const handler = vi.fn();
  const dataSource = new TypeaheadDataSource<null>(handler);
  const first = vi.fn();
  const second = vi.fn();
  dataSource.addQueryCallback(first);
  dataSource.addQueryCallback(second);
  dataSource.query('alpha');
  dataSource.removeQueryCallback(first);
  vi.runAllTimers();
  expect(handler).toHaveBeenCalledExactlyOnceWith('alpha');
  dataSource.query('bravo');
  dataSource.removeQueryCallback(second);
  vi.runAllTimers();
  expect(handler).toHaveBeenCalledTimes(1);
});

test('pure lookups do not change the outstanding remote query', () => {
  const source = createTestDataSource([]);
  const callback = vi.fn();
  source.addQueryCallback(callback);
  source.query('bravo');
  source.getQueryResults('alpha');
  source.addEntries([new TypeaheadDataSourceEntry('Bravo', 'bravo', 'bravo')]);
  expect(callback).toHaveBeenLastCalledWith('bravo', source.getQueryResults('bravo'));
});

test('external store snapshots change only when entries change', () => {
  const source = createTestDataSource([]);
  const listener = vi.fn();
  const unsubscribe = source.subscribe(listener);
  const initial = source.getSnapshot();
  const entry = new TypeaheadDataSourceEntry('Alpha', '1', '1');
  source.query('a');
  expect(source.getSnapshot()).toBe(initial);
  source.addEntries([entry]);
  expect(source.getSnapshot()).toBe(initial + 1);
  source.addEntries([entry]);
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  source.updateEntry(new TypeaheadDataSourceEntry('Bravo', '1', '1'));
  expect(listener).toHaveBeenCalledTimes(1);
});

test('a failed remote lookup can be retried after clearing the query cache', () => {
  vi.useFakeTimers();
  const handler = vi.fn();
  const source = new TypeaheadDataSource(handler);
  source.addQueryCallback(vi.fn());
  source.query('alpha');
  vi.runAllTimers();
  source.clearQueryCache();
  source.query('alpha');
  vi.runAllTimers();
  expect(handler).toHaveBeenCalledTimes(2);
});

test('unmounting the last external store subscriber cancels pending queries', () => {
  vi.useFakeTimers();
  const handler = vi.fn();
  const source = new TypeaheadDataSource(handler);
  const unsubscribe = source.subscribe(vi.fn());
  source.query('alpha');
  unsubscribe();
  vi.runAllTimers();
  expect(handler).not.toHaveBeenCalled();
});
