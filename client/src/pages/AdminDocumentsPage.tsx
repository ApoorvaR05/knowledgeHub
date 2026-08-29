import { useState, useEffect, useRef, DragEvent, ChangeEvent } from 'react';
import { documentsApi } from '../api/client';
import type { Document } from '../types';

function statusBadge(status: Document['status']) {
  const map = { ready: 'badge-success', processing: 'badge-warn', failed: 'badge-danger' } as const;
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

export function AdminDocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  // Poll documents every 3 s to catch status changes (processing → ready)
  useEffect(() => {
    const id = setInterval(loadDocuments, 3000);
    return () => clearInterval(id);
  }, []);

  async function loadDocuments() {
    try {
      const res = await documentsApi.list();
      setDocs(res.data);
    } catch {
      // ignore polling errors
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file: File) {
    setError('');
    setSuccess('');
    setUploading(true);
    try {
      await documentsApi.upload(file, file.name.replace(/\.[^.]+$/, ''));
      setSuccess(`"${file.name}" uploaded — processing started.`);
      await loadDocuments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Upload failed';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    try {
      await documentsApi.remove(id);
      setDocs(prev => prev.filter(d => d.id !== id));
    } catch {
      setError('Delete failed');
    }
  }

  return (
    <div>
      <div className="section-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Documents</h1>
      </div>

      {/* Dropzone */}
      <div
        className={`dropzone${dragActive ? ' active' : ''}`}
        style={{ marginBottom: 24 }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
      >
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={onFileChange} />
        {uploading
          ? '⏳ Uploading…'
          : 'Click or drag a file here to upload (.pdf, .docx, .txt)'}
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}
      {success && <div className="alert alert-success mb-4">{success}</div>}

      {loading ? (
        <div className="page-loader">Loading…</div>
      ) : docs.length === 0 ? (
        <p className="text-muted">No documents uploaded yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>File</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map(doc => (
              <tr key={doc.id}>
                <td>{doc.title}</td>
                <td className="text-muted text-sm">{doc.file_name}</td>
                <td>{statusBadge(doc.status)}</td>
                <td className="text-muted text-sm">
                  {new Date(doc.created_at).toLocaleString()}
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(doc.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
