import { useState, FormEvent } from 'react';
import { searchApi } from '../api/client';
import type { SearchResult } from '../types';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await searchApi.search(query.trim());
      setResults(res.data);
      setSearched(true);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Search Knowledge Base</h1>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          className="input"
          placeholder="Type a question or keyword…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      {searched && results.length === 0 && !loading && (
        <p className="text-muted">No results found for &ldquo;{query}&rdquo;</p>
      )}

      {results.map(r => (
        <div key={r.id} className="result-card">
          <div className="result-card-meta">
            <span className={`badge ${r.type === 'qa' ? 'badge-info' : 'badge-success'}`}>
              {r.type === 'qa' ? 'Q&A' : 'Document'}
            </span>
            {r.source_title && <span>{r.source_title}</span>}
            <span className="result-score">{(r.score * 100).toFixed(0)}%</span>
          </div>
          <div className="result-card-content">{r.content}</div>
        </div>
      ))}
    </div>
  );
}
