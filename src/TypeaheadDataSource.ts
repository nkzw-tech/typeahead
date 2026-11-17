import parseSearchTokens from './parseSearchTokens.ts';

type QueryCallback<T> = (
  value: string,
  results: ReadonlyArray<TypeaheadDataSourceEntry<T>>,
) => void;
type QueryHandler = (value: string) => void;

const QUERY_DELAY = 100;

export class TypeaheadDataSource<T> {
  private listeners = new Set<() => void>();
  private revision = 0;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      this.cancelPendingQuery();
    };
  };

  readonly getSnapshot = () => this.revision;

  private cancelPendingQuery() {
    if (!this.listeners.size && !this.queryCallbacks.size && this.pendingQuery !== null) {
      clearTimeout(this.pendingQuery);
      this.pendingQuery = null;
    }
  }

  private pendingQuery: ReturnType<typeof setTimeout> | null;
  private queryCallbacks: Set<QueryCallback<T>>;
  private mostRecentQuery: string;
  private entriesSet: Set<string>;
  private entryBuckets: Map<number, Set<TypeaheadDataSourceEntry<T>>>;
  private keywordBuckets: Map<number, Set<TypeaheadDataSourceEntry<T>>>;
  private previousQueries: Set<string>;

  constructor(
    private readonly queryHandler: QueryHandler | null = null,
    private readonly maxResults = 10,
  ) {
    this.pendingQuery = null;
    this.queryCallbacks = new Set();
    this.mostRecentQuery = '';
    this.entriesSet = new Set();
    this.entryBuckets = new Map();
    this.keywordBuckets = new Map();
    this.previousQueries = new Set();
  }

  addEntries(entries: ReadonlyArray<TypeaheadDataSourceEntry<T>>) {
    const uniqueEntries: Array<TypeaheadDataSourceEntry<T>> = [];
    const intermediateEntryBuckets: Array<Array<TypeaheadDataSourceEntry<T>>> = [];

    entries.forEach((entry) => {
      const value = entry.value;
      if (!this.entriesSet.has(value)) {
        uniqueEntries.push(entry);
        this.entriesSet.add(value);
        const index = entry.tokens.length - 1;
        if (index < 0) {
          return;
        }
        if (!intermediateEntryBuckets[index]) {
          intermediateEntryBuckets[index] = [];
        }
        intermediateEntryBuckets[index].push(entry);
      }
    });

    intermediateEntryBuckets.forEach((entryBucket, index) => {
      for (let ii = 0; ii <= index; ii++) {
        for (let jj = 0; jj < entryBucket.length; jj++) {
          const entry = entryBucket[jj];
          this.insertEntry(this.entryBuckets, entry.tokens[ii].codePointAt(0)!, entry);
        }
      }
    });

    for (const entry of uniqueEntries) {
      for (const token of entry.keywordTokens) {
        this.insertEntry(this.keywordBuckets, token.codePointAt(0)!, entry);
      }
    }

    if (uniqueEntries.length) {
      this.revision++;
      for (const listener of this.listeners) {
        listener();
      }
    }
    this.query(this.mostRecentQuery);
  }

  updateEntry(entry: TypeaheadDataSourceEntry<T>) {
    this.entriesSet.delete(entry.value);

    for (const buckets of [this.entryBuckets, this.keywordBuckets]) {
      for (const bucket of buckets.values()) {
        for (const currentEntry of bucket) {
          if (currentEntry.value === entry.value) {
            bucket.delete(currentEntry);
            break;
          }
        }
      }
    }

    this.addEntries([entry]);
  }

  query(value: string) {
    if (this.pendingQuery !== null) {
      clearTimeout(this.pendingQuery);
      this.pendingQuery = null;
    }

    this.mostRecentQuery = value;
    if (!this.queryCallbacks.size && !this.listeners.size) {
      return;
    }

    const results = this.getQueryResults(value);
    for (const callback of this.queryCallbacks) {
      callback(value, results);
    }

    const query = value.trim();
    if (
      this.maxResults > 0 &&
      parseSearchTokens(query).length &&
      this.queryHandler &&
      results.length < this.maxResults &&
      !this.previousQueries.has(query)
    ) {
      this.pendingQuery = setTimeout(() => {
        this.pendingQuery = null;
        this.previousQueries.add(query);
        this.queryHandler?.(query);
      }, QUERY_DELAY);
    }
  }

  getQueryResults(value: string): ReadonlyArray<TypeaheadDataSourceEntry<T>> {
    const results: Set<TypeaheadDataSourceEntry<T>> = new Set();
    const queryTokens = parseSearchTokens(value);
    if (!queryTokens.length || this.maxResults <= 0) {
      return [];
    }
    const firstCharCode = queryTokens[0].codePointAt(0)!;
    const eligibleEntries = this.entryBuckets.get(firstCharCode);

    if (eligibleEntries) {
      for (const entry of eligibleEntries) {
        const entryTokens = entry.tokens;
        if (tokensMatch(queryTokens, entryTokens)) {
          results.add(entry);
        }
        if (results.size === this.maxResults) {
          return Array.from(results);
        }
      }
    }

    if (this.keywordBuckets.size) {
      for (const bucket of [eligibleEntries, this.keywordBuckets.get(firstCharCode)]) {
        if (!bucket) {
          continue;
        }
        for (const entry of bucket) {
          if (
            entry.keywordTokens.length &&
            !results.has(entry) &&
            tokensMatch(queryTokens, [...entry.tokens, ...entry.keywordTokens])
          ) {
            results.add(entry);
          }
          if (results.size === this.maxResults) {
            return Array.from(results);
          }
        }
      }
    }

    return Array.from(results);
  }

  addQueryCallback(callback: QueryCallback<T>) {
    this.queryCallbacks.add(callback);
  }

  removeQueryCallback(callback: QueryCallback<T>) {
    this.queryCallbacks.delete(callback);
    this.cancelPendingQuery();
  }

  clearQueryCache() {
    this.previousQueries.clear();
  }

  private insertEntry(
    buckets: Map<number, Set<TypeaheadDataSourceEntry<T>>>,
    key: number,
    entry: TypeaheadDataSourceEntry<T>,
  ) {
    const bucket = buckets.get(key) ?? new Set();
    if (!buckets.has(key)) {
      buckets.set(key, bucket);
    }
    if (!bucket.has(entry)) {
      bucket.add(entry);
    }
  }
}

function tokensMatch(queryTokens: ReadonlyArray<string>, entryTokens: ReadonlyArray<string>) {
  const numQueryTokens = queryTokens.length;
  const numEntryTokens = entryTokens.length;
  let checked = 0;
  let matched = 0;

  while (matched < numQueryTokens && checked < numEntryTokens) {
    const queryToken = queryTokens[matched];
    const entryToken = entryTokens[checked];
    if (entryToken.startsWith(queryToken) && ++matched === numQueryTokens) {
      return true;
    }
    checked++;
  }

  return matched === numQueryTokens;
}

export class TypeaheadDataSourceEntry<T> {
  public readonly tokens: ReadonlyArray<string>;
  public readonly keywordTokens: ReadonlyArray<string>;

  constructor(
    public readonly text: string,
    public readonly value: string,
    public readonly data: T,
    keywords: ReadonlyArray<string> = [],
  ) {
    this.tokens = parseSearchTokens(text);
    this.keywordTokens = keywords.flatMap(parseSearchTokens);
  }
}
