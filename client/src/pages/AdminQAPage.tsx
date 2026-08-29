import { useState, useEffect, FormEvent } from 'react';
import { qaApi } from '../api/client';
import type { QAPair } from '../types';

interface FormState {
  question: string;
  answer: string;
}

const EMPTY_FORM: FormState = { question: '', answer: '' };

export function AdminQAPage() {
  const [pairs, setPairs] = useState<QAPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QAPair | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    loadPairs(page);
  }, [page]);

  async function loadPairs(p: number) {
    setLoading(true);
    try {
      const res = await qaApi.list(p, LIMIT);
      setPairs(res.data.data);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  }

  function openEdit(pair: QAPair) {
    setEditing(pair);
    setForm({ question: pair.question, answer: pair.answer });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      setError('Both fields are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const res = await qaApi.update(editing.id, form.question, form.answer);
        setPairs(prev => prev.map(p => (p.id === editing.id ? res.data : p)));
      } else {
        const res = await qaApi.create(form.question, form.answer);
        setPairs(prev => [res.data, ...prev]);
        setTotal(t => t + 1);
      }
      closeModal();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Save failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this Q&A pair?')) return;
    try {
      await qaApi.remove(id);
      setPairs(prev => prev.filter(p => p.id !== id));
      setTotal(t => t - 1);
    } catch {
      alert('Delete failed');
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="section-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Q&amp;A Pairs</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Add pair</button>
      </div>

      {loading ? (
        <div className="page-loader">Loading…</div>
      ) : pairs.length === 0 ? (
        <p className="text-muted">No Q&amp;A pairs yet. Add your first one!</p>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Question</th>
                <th>Answer</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pairs.map(pair => (
                <tr key={pair.id}>
                  <td>{pair.question}</td>
                  <td className="text-muted">{pair.answer}</td>
                  <td className="text-muted text-sm">
                    {new Date(pair.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="gap-row">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(pair)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(pair.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="gap-row mt-4">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <span className="text-muted text-sm">
                Page {page} / {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Edit Q&A Pair' : 'New Q&A Pair'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="question">Question</label>
                <input
                  id="question"
                  type="text"
                  className="input"
                  value={form.question}
                  onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                  maxLength={500}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="answer">Answer</label>
                <textarea
                  id="answer"
                  className="textarea"
                  value={form.answer}
                  onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                  maxLength={2000}
                  required
                  rows={4}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
