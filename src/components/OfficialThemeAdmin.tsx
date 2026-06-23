import { useState } from 'react';
import { GitHubAuthService, type TokenPersistence } from '../core/services/admin/GitHubAuthService';
import { GitHubThemePublisher, type PublishResult } from '../core/services/admin/GitHubThemePublisher';
import { readThemeDirectory, isDirectoryPickerSupported } from '../core/services/admin/readThemeDirectory';
import {
  validateThemeForPublish,
  validateCssText,
  type ThemeValidationReport,
} from '../core/services/admin/themeValidation';
import { screenshotToObjectUrl } from '../core/services/themeConfigParser';
import { DEFAULT_PUBLISH_BRANCH } from '../core/services/admin/githubRepo';
import { ThemeRegistry } from '../core/services/ThemeRegistry';

/** Extensiones que se muestran como miniatura en la pestaña "Archivos". */
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'];

function isImagePath(relPath: string): boolean {
  return IMAGE_EXTENSIONS.some((ext) => relPath.toLowerCase().endsWith(ext));
}

function guessMimeType(relPath: string): string {
  const ext = relPath.toLowerCase().slice(relPath.lastIndexOf('.'));
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  return map[ext] ?? 'application/octet-stream';
}

function bytesToObjectUrl(bytes: Uint8Array, relPath: string): string {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return URL.createObjectURL(new Blob([buffer], { type: guessMimeType(relPath) }));
}

/** Agrupa rutas relativas planas ("img/foo.png") por carpeta para el listado. */
function groupFilesByFolder(relPaths: string[]): Array<{ folder: string; files: string[] }> {
  const groups = new Map<string, string[]>();
  for (const relPath of relPaths) {
    const slash = relPath.lastIndexOf('/');
    const folder = slash === -1 ? '' : relPath.slice(0, slash + 1);
    const list = groups.get(folder) ?? [];
    list.push(relPath);
    groups.set(folder, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, files]) => ({ folder, files: files.sort() }));
}

interface ThemeFileEntry {
  relPath: string;
  thumbUrl: string | null;
}

interface LoadedTheme {
  id: string;
  files: Record<string, Uint8Array>;
  report: ThemeValidationReport;
  screenshotUrl: string | null;
  totalBytes: number;
  fileCount: number;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function OfficialThemeAdmin() {
  // ── Auth ──
  const [authed, setAuthed] = useState(() => {
    GitHubAuthService.restore();
    return GitHubAuthService.isAuthenticated();
  });
  const [token, setToken] = useState('');
  const [persistence, setPersistence] = useState<TokenPersistence>('session');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [login, setLogin] = useState<string | null>(null);

  // ── Wizard ──
  const [loaded, setLoaded] = useState<LoadedTheme | null>(null);
  const [name, setName] = useState('');
  const [activity, setActivity] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);

  // ── Opciones avanzadas (desarrollo/pruebas) ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [branch, setBranch] = useState(DEFAULT_PUBLISH_BRANCH);
  const [dryRun, setDryRun] = useState(false);

  // ── Eliminar tema ──
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  // ── Editar metadatos (sin tocar el tema) ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editActivity, setEditActivity] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOriginal, setEditOriginal] = useState({ name: '', activity: '', description: '' });

  // ── Editor rápido de archivos (sin pasar por la carpeta completa) ──
  const [fileEditId, setFileEditId] = useState<string | null>(null);
  const [fileEditTab, setFileEditTab] = useState<'css' | 'files'>('css');
  const [fileOpResult, setFileOpResult] = useState<string | null>(null);

  const [cssText, setCssText] = useState('');
  const [cssOriginal, setCssOriginal] = useState('');
  const [cssWarnings, setCssWarnings] = useState<string[]>([]);
  const [cssLoading, setCssLoading] = useState(false);
  const [cssSaving, setCssSaving] = useState(false);
  const [cssError, setCssError] = useState<string | null>(null);

  const [themeFiles, setThemeFiles] = useState<ThemeFileEntry[] | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [replacingPath, setReplacingPath] = useState<string | null>(null);
  const [newFileFolder, setNewFileFolder] = useState('');

  // Temas oficiales cargados en la app (excluye "base", que no se borra).
  const officialThemes = ThemeRegistry.getAll().filter(
    (t) => t.source === 'builtin' && t.id !== 'base',
  );

  const handleLogin = async () => {
    setAuthBusy(true);
    setAuthError(null);
    const res = await GitHubAuthService.authenticate(token, persistence);
    setAuthBusy(false);
    if (res.ok) {
      setAuthed(true);
      setLogin(res.login ?? null);
      setToken('');
    } else {
      setAuthError(res.error ?? 'No se pudo autenticar.');
    }
  };

  const handleLogout = () => {
    GitHubAuthService.logout();
    setAuthed(false);
    setLogin(null);
    resetWizard();
  };

  const resetWizard = () => {
    setLoaded(null);
    setName('');
    setActivity('');
    setDescription('');
    setError(null);
    setResult(null);
    setEditingId(null);
  };

  const handlePickFolder = async () => {
    setError(null);
    setResult(null);
    try {
      const { id, files } = await readThemeDirectory();
      const report = validateThemeForPublish(files);
      const totalBytes = Object.values(files).reduce((a, b) => a + b.length, 0);
      setLoaded({
        id,
        files,
        report,
        screenshotUrl: screenshotToObjectUrl(files),
        totalBytes,
        fileCount: Object.keys(files).length,
      });
      // El nombre se toma del <title> del config.xml (nombre legible con
      // espacios); si no lo hubiera, se cae al id de la carpeta.
      setName(report.meta.title ?? id.replace(/_/g, ' '));
      setActivity('');
      setDescription('');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // usuario canceló
      setError(err instanceof Error ? err.message : 'Error leyendo la carpeta.');
    }
  };

  const handlePublish = async () => {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    try {
      const res = await GitHubThemePublisher.publishTheme(
        { id: loaded.id, name, activity, description, language: loaded.report.meta.language ?? undefined },
        loaded.files,
        { branch, dryRun },
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error publicando el tema.');
    } finally {
      setBusy(false);
    }
  };

  const cancelDelete = () => {
    setDeletingId(null);
    setConfirmText('');
  };

  const startEdit = (t: { id: string; name: string; metadata?: { name?: string; activity?: string; description?: string } }) => {
    const name = t.metadata?.name ?? t.name;
    const activity = t.metadata?.activity ?? '';
    const description = t.metadata?.description ?? '';
    setEditingId(t.id);
    setEditName(name);
    setEditActivity(activity);
    setEditDescription(description);
    setEditOriginal({ name, activity, description });
    setDeletingId(null);
    setFileEditId(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveMetadata = async () => {
    if (!editingId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await GitHubThemePublisher.updateThemeMetadata(
        { id: editingId, name: editName, activity: editActivity, description: editDescription },
        { branch, dryRun },
      );
      setResult(res);
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando los metadatos.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId || confirmText !== deletingId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await GitHubThemePublisher.deleteTheme(deletingId, { branch, dryRun });
      setResult(res);
      cancelDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando el tema.');
    } finally {
      setBusy(false);
    }
  };

  // ── Editor rápido de archivos ──────────────────────────────────────────────

  const startEditFiles = async (themeId: string) => {
    setFileEditId(themeId);
    setFileEditTab('css');
    setEditingId(null);
    setDeletingId(null);
    setError(null);
    setFileOpResult(null);
    setThemeFiles(null);
    setFilesError(null);
    setCssError(null);
    setCssLoading(true);
    try {
      const text = await GitHubThemePublisher.fetchThemeFileText(themeId, 'style.css', branch);
      setCssText(text);
      setCssOriginal(text);
      setCssWarnings(validateCssText(text).warnings);
    } catch (err) {
      setCssError(err instanceof Error ? err.message : 'Error leyendo style.css.');
    } finally {
      setCssLoading(false);
    }
  };

  const cancelEditFiles = () => {
    setFileEditId(null);
    setThemeFiles(null);
  };

  const handleCssTextChange = (value: string) => {
    setCssText(value);
    setCssWarnings(validateCssText(value).warnings);
  };

  const handleSaveCss = async () => {
    if (!fileEditId) return;
    setCssSaving(true);
    setCssError(null);
    setFileOpResult(null);
    try {
      const res = await GitHubThemePublisher.updateThemeFile(
        fileEditId,
        'style.css',
        new TextEncoder().encode(cssText),
        { branch, dryRun },
      );
      setCssOriginal(cssText);
      setFileOpResult(
        dryRun
          ? 'Simulación: se actualizaría style.css y la versión del tema.'
          : `✓ style.css actualizado (commit ${res.commitSha?.slice(0, 7)}).`,
      );
    } catch (err) {
      setCssError(err instanceof Error ? err.message : 'Error guardando style.css.');
    } finally {
      setCssSaving(false);
    }
  };

  const loadThemeFiles = async (themeId: string) => {
    setFilesLoading(true);
    setFilesError(null);
    try {
      const relPaths = await GitHubThemePublisher.listThemeFiles(themeId, branch);
      const entries = await Promise.all(
        relPaths
          .filter((p) => p !== 'config.xml') // estructural: solo editable vía carpeta completa
          .map(async (relPath): Promise<ThemeFileEntry> => {
            if (!isImagePath(relPath)) return { relPath, thumbUrl: null };
            try {
              const bytes = await GitHubThemePublisher.fetchThemeFileBytes(themeId, relPath, branch);
              return { relPath, thumbUrl: bytesToObjectUrl(bytes, relPath) };
            } catch {
              return { relPath, thumbUrl: null }; // sin miniatura si falla la lectura; el archivo sigue listado
            }
          }),
      );
      setThemeFiles(entries);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'Error listando los archivos del tema.');
    } finally {
      setFilesLoading(false);
    }
  };

  const handleOpenFilesTab = () => {
    setFileEditTab('files');
    if (fileEditId && themeFiles === null && !filesLoading) {
      loadThemeFiles(fileEditId);
    }
  };

  const handleReplaceFile = async (relPath: string, file: File) => {
    if (!fileEditId) return;
    setReplacingPath(relPath);
    setFilesError(null);
    setFileOpResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = await GitHubThemePublisher.updateThemeFile(fileEditId, relPath, bytes, { branch, dryRun });
      setFileOpResult(
        dryRun
          ? `Simulación: se sustituiría ${relPath}.`
          : `✓ ${relPath} sustituido (commit ${res.commitSha?.slice(0, 7)}).`,
      );
      if (!dryRun && isImagePath(relPath)) {
        const thumbUrl = URL.createObjectURL(file);
        setThemeFiles((prev) => prev?.map((f) => (f.relPath === relPath ? { ...f, thumbUrl } : f)) ?? null);
      }
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : `Error sustituyendo ${relPath}.`);
    } finally {
      setReplacingPath(null);
    }
  };

  const handleAddNewFile = async (file: File) => {
    if (!fileEditId) return;
    const folder = newFileFolder.replace(/^\/+/, '');
    const relPath = `${folder}${file.name}`;
    if (relPath.includes('..')) {
      setFilesError('Ruta de archivo no válida.');
      return;
    }
    setReplacingPath(relPath);
    setFilesError(null);
    setFileOpResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = await GitHubThemePublisher.updateThemeFile(fileEditId, relPath, bytes, { branch, dryRun });
      setFileOpResult(
        dryRun
          ? `Simulación: se añadiría ${relPath}.`
          : `✓ ${relPath} añadido (commit ${res.commitSha?.slice(0, 7)}).`,
      );
      if (!dryRun) {
        const thumbUrl = isImagePath(relPath) ? URL.createObjectURL(file) : null;
        setThemeFiles((prev) => (prev ? [...prev, { relPath, thumbUrl }] : [{ relPath, thumbUrl }]));
      }
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : `Error añadiendo ${relPath}.`);
    } finally {
      setReplacingPath(null);
    }
  };

  // ── Render: no autenticado ──
  if (!authed) {
    return (
      <div className="admin-panel">
        <h3>Administración de temas oficiales</h3>
        <p className="help-text">
          Zona restringida. Introduce un <strong>token de acceso de GitHub</strong> (fine-grained PAT
          limitado a este repositorio, con permiso <code>Contents: Read and write</code>). El token
          se usa solo desde tu navegador para llamar a GitHub; abajo eliges si se recuerda y dónde.
        </p>

        {authError && <div className="alert alert-error">{authError}</div>}

        <div className="admin-login">
          <input
            type="password"
            placeholder="github_pat_..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="admin-token-input"
            autoComplete="off"
          />
          <label className="admin-field-label">
            Recordar el token
            <select
              value={persistence}
              onChange={(e) => setPersistence(e.target.value as TokenPersistence)}
              className="admin-select"
            >
              <option value="none">No (solo hasta recargar)</option>
              <option value="session">Esta sesión del navegador</option>
              <option value="device">En este dispositivo (hasta que caduque)</option>
            </select>
          </label>
          <button className="btn-confirm" onClick={handleLogin} disabled={authBusy || !token.trim()}>
            {authBusy ? 'Verificando…' : 'Entrar'}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: autenticado ──
  const report = loaded?.report;
  const hasErrors = (report?.errors.length ?? 0) > 0;
  const hasExisting = loaded ? officialThemes.some((t) => t.id === loaded.id) : false;
  const editChanged =
    editName !== editOriginal.name ||
    editActivity !== editOriginal.activity ||
    editDescription !== editOriginal.description;

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h3>Administración de temas oficiales</h3>
        <span className="admin-session">
          {login ? `Conectado como ${login}` : 'Conectado'} ·{' '}
          <button className="link-button" onClick={handleLogout}>Cerrar sesión</button>
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Resultado de la operación (publicar / actualizar / eliminar / metadatos) */}
      {result && (
        <div className={`alert ${result.dryRun ? 'alert-info' : 'alert-success'}`}>
          {result.dryRun ? (
            result.metadataOnly ? (
              <>
                <strong>Simulación (dry-run)</strong> en <code>{result.branch}</code>: se actualizarían
                {' '}los metadatos del catálogo. No se ha modificado nada.
              </>
            ) : (
              <>
                <strong>Simulación (dry-run)</strong> en <code>{result.branch}</code>: se subirían{' '}
                {result.upserted} archivo(s) y se eliminarían {result.deleted}. No se ha modificado nada.
              </>
            )
          ) : result.metadataOnly ? (
            <>
              <strong>✓ Metadatos actualizados</strong> en <code>{result.branch}</code>. Commit{' '}
              <code>{result.commitSha?.slice(0, 7)}</code>.
              {result.branch === DEFAULT_PUBLISH_BRANCH && ' El despliegue se actualiza en 1-2 minutos.'}
            </>
          ) : (
            <>
              <strong>✓ Hecho</strong> en <code>{result.branch}</code>: {result.upserted} archivo(s)
              {' '}subido(s), {result.deleted} eliminado(s). Commit <code>{result.commitSha?.slice(0, 7)}</code>.
              {result.branch === DEFAULT_PUBLISH_BRANCH && ' El despliegue se actualiza en 1-2 minutos.'}
            </>
          )}
          <div style={{ marginTop: '0.6rem' }}>
            <button className="btn-cancel" onClick={resetWizard}>Hacer otra operación</button>
          </div>
        </div>
      )}

      {/* Opciones avanzadas (rama destino + dry-run) — aplican a todas las operaciones */}
      {!result && (
        <div className="admin-wizard-step" style={{ borderTop: 'none', paddingTop: 0 }}>
          <button type="button" className="link-button link-button--toggle" onClick={() => setShowAdvanced((v) => !v)}>
            <svg
              className={`chevron${showAdvanced ? ' chevron--open' : ''}`}
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <polyline points="4 6 8 10 12 6" />
            </svg>
            {showAdvanced ? 'Ocultar opciones avanzadas' : 'Opciones avanzadas'}
          </button>
          {showAdvanced && (
            <div className="admin-advanced">
              <label>
                Rama destino
                <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} />
              </label>
              <label className="admin-checkbox">
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                Simular (dry-run): no modifica nada
              </label>
            </div>
          )}
          {branch !== DEFAULT_PUBLISH_BRANCH && (
            <p className="help-text">Operando sobre la rama <code>{branch}</code> (no en producción).</p>
          )}
        </div>
      )}

      {/* Temas oficiales existentes */}
      {!result && (
        <div className="admin-wizard-step">
          <h4>Temas oficiales existentes ({officialThemes.length})</h4>
          {officialThemes.length === 0 ? (
            <p className="help-text">No hay temas oficiales cargados.</p>
          ) : (
            <div className="admin-theme-list">
              {officialThemes.map((t) => (
                <div key={t.id} className="admin-theme-row">
                  <span className="admin-theme-name">
                    <strong>{t.metadata?.name ?? t.name}</strong>
                    <span className="theme-id">({t.id})</span>
                  </span>
                  {fileEditId === t.id ? (
                    <div className="admin-file-edit">
                      <div className="admin-file-tabs">
                        <button
                          type="button"
                          className={`admin-file-tab${fileEditTab === 'css' ? ' admin-file-tab--active' : ''}`}
                          onClick={() => setFileEditTab('css')}
                        >
                          CSS
                        </button>
                        <button
                          type="button"
                          className={`admin-file-tab${fileEditTab === 'files' ? ' admin-file-tab--active' : ''}`}
                          onClick={handleOpenFilesTab}
                        >
                          Imágenes y otros archivos
                        </button>
                        <button type="button" className="link-button admin-file-edit-close" onClick={cancelEditFiles}>
                          Cerrar
                        </button>
                      </div>

                      {fileOpResult && <div className="alert alert-success">{fileOpResult}</div>}

                      {fileEditTab === 'css' ? (
                        <div className="admin-css-editor">
                          {cssLoading ? (
                            <p className="help-text">Cargando style.css…</p>
                          ) : cssError ? (
                            <div className="alert alert-error">{cssError}</div>
                          ) : (
                            <>
                              <p className="help-text">
                                Editando <code>style.css</code> directamente: se publica solo este
                                archivo, sin tocar el resto del tema.
                              </p>
                              <textarea
                                className="admin-css-textarea"
                                value={cssText}
                                onChange={(e) => handleCssTextChange(e.target.value)}
                                spellCheck={false}
                                rows={14}
                              />
                              {cssWarnings.map((w, i) => (
                                <div key={i} className="alert alert-warning">{w}</div>
                              ))}
                              <div className="admin-css-actions">
                                <span className="help-text">
                                  Sube la <code>&lt;version&gt;</code> del tema automáticamente.
                                </span>
                                <button
                                  className="btn-confirm"
                                  onClick={handleSaveCss}
                                  disabled={cssSaving || cssText === cssOriginal}
                                  title={cssText === cssOriginal ? 'No has cambiado el CSS' : undefined}
                                >
                                  {cssSaving ? 'Guardando…' : dryRun ? 'Simular' : 'Guardar cambios CSS'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="admin-file-list">
                          {filesLoading ? (
                            <p className="help-text">Cargando archivos…</p>
                          ) : filesError ? (
                            <div className="alert alert-error">{filesError}</div>
                          ) : themeFiles && themeFiles.length > 0 ? (
                            groupFilesByFolder(themeFiles.map((f) => f.relPath)).map(({ folder, files }) => (
                              <div key={folder || '(raíz)'} className="admin-file-group">
                                <div className="admin-file-group-label">{folder || 'Raíz'}</div>
                                {files.map((relPath) => {
                                  const entry = themeFiles.find((f) => f.relPath === relPath);
                                  return (
                                    <div key={relPath} className="admin-file-row">
                                      <span className="admin-file-row-info">
                                        {entry?.thumbUrl && (
                                          <img src={entry.thumbUrl} alt="" className="admin-file-thumb" />
                                        )}
                                        {relPath.slice(folder.length)}
                                      </span>
                                      <label
                                        className={`btn-edit admin-file-replace-btn${replacingPath ? ' btn-edit--disabled' : ''}`}
                                      >
                                        {replacingPath === relPath ? '…' : 'Sustituir'}
                                        <input
                                          type="file"
                                          hidden
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleReplaceFile(relPath, file);
                                            e.target.value = '';
                                          }}
                                        />
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            ))
                          ) : (
                            <p className="help-text">No se encontraron archivos.</p>
                          )}

                          <div className="admin-file-add-row">
                            <select
                              value={newFileFolder}
                              onChange={(e) => setNewFileFolder(e.target.value)}
                              className="admin-select"
                            >
                              <option value="">raíz</option>
                              <option value="img/">img/</option>
                              <option value="icons/">icons/</option>
                              <option value="fonts/">fonts/</option>
                            </select>
                            <label
                              className={`admin-file-add-label${replacingPath ? ' btn-edit--disabled' : ''}`}
                            >
                              + Añadir archivo nuevo en esta carpeta…
                              <input
                                type="file"
                                hidden
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleAddNewFile(file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : editingId === t.id ? (
                    <div className="admin-meta-edit">
                      <label>
                        Nombre
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </label>
                      <label>
                        Actividad
                        <input type="text" value={editActivity} onChange={(e) => setEditActivity(e.target.value)} />
                      </label>
                      <label>
                        Descripción
                        <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                      </label>
                      <p className="help-text">
                        El idioma (<strong>{t.metadata?.language ?? '—'}</strong>) se toma del{' '}
                        <code>config.xml</code> del tema; no se edita aquí. Para que este tema se agrupe
                        con sus otros idiomas, el nombre debe coincidir exactamente con el de las demás
                        variantes fuera del paréntesis de idioma.
                      </p>
                      <div className="admin-meta-edit-actions">
                        <button
                          className="btn-confirm"
                          onClick={handleSaveMetadata}
                          disabled={busy || !editChanged}
                          title={!editChanged ? 'No has cambiado ningún metadato' : undefined}
                        >
                          {busy ? 'Guardando…' : dryRun ? 'Simular' : 'Guardar metadatos'}
                        </button>
                        <button className="link-button" onClick={cancelEdit} disabled={busy}>Cancelar</button>
                      </div>
                    </div>
                  ) : deletingId === t.id ? (
                    <span className="admin-delete-confirm">
                      <input
                        type="text"
                        placeholder={`Escribe "${t.id}"`}
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className="admin-confirm-input"
                      />
                      <button
                        className="btn-delete"
                        onClick={handleDelete}
                        disabled={busy || confirmText !== t.id}
                      >
                        {busy ? '…' : dryRun ? 'Simular' : 'Eliminar def.'}
                      </button>
                      <button className="link-button" onClick={cancelDelete} disabled={busy}>Cancelar</button>
                    </span>
                  ) : (
                    <span className="admin-theme-actions">
                      <button
                        className="btn-edit"
                        onClick={() => startEditFiles(t.id)}
                        disabled={busy}
                      >
                        Editar archivos
                      </button>
                      <button
                        className="btn-edit"
                        onClick={() => startEdit(t)}
                        disabled={busy}
                      >
                        Editar metadatos
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => { setDeletingId(t.id); setConfirmText(''); setError(null); setFileEditId(null); }}
                        disabled={busy}
                      >
                        Eliminar
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="help-text">
            Para corregir solo el <strong>nombre, actividad o descripción</strong> usa «Editar metadatos».
            Para un retoque puntual (un atributo CSS, sustituir una imagen) usa «Editar archivos»: publica
            solo ese archivo, sin tocar el resto. Para cambios estructurales o de varios archivos a la vez
            (incluido <code>config.xml</code>), vuelve a publicar la carpeta completa (mismo id) en el
            asistente de abajo.
          </p>
        </div>
      )}

      {/* Asistente: crear / actualizar */}
      {!result && (
        <>
          <div className="admin-wizard-step">
            <h4>Nuevo tema oficial (o actualizar uno existente)</h4>
          </div>
          <div className="admin-wizard-step">
            <h4>1. Selecciona la carpeta del tema</h4>
            {!isDirectoryPickerSupported() ? (
              <div className="alert alert-error">
                Tu navegador no permite seleccionar carpetas. Usa Chrome o Edge.
              </div>
            ) : (
              <button className="btn-confirm" onClick={handlePickFolder} disabled={busy}>
                {loaded ? 'Elegir otra carpeta' : 'Seleccionar carpeta…'}
              </button>
            )}
          </div>

          {loaded && report && (
            <>
              <div className="admin-wizard-step">
                <h4>2. Validación</h4>
                {report.errors.length === 0 && report.warnings.length === 0 && (
                  <div className="alert alert-success">Sin problemas detectados.</div>
                )}
                {report.errors.map((e, i) => (
                  <div key={`e${i}`} className="alert alert-error">{e}</div>
                ))}
                {report.warnings.map((w, i) => (
                  <div key={`w${i}`} className="alert alert-warning">{w}</div>
                ))}
              </div>

              <div className="admin-wizard-step">
                <h4>3. Previsualización</h4>
                <div className="admin-preview">
                  {loaded.screenshotUrl && (
                    <img src={loaded.screenshotUrl} alt="Vista previa del tema" className="admin-preview-img" />
                  )}
                  <div className="admin-preview-fields">
                    <label>
                      ID (carpeta)
                      <input type="text" value={loaded.id} disabled />
                    </label>
                    <label>
                      Nombre
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                      <small className="help-text">
                        Tomado del &lt;title&gt; del config.xml. Edítalo solo si quieres otro nombre.
                        Si es el mismo curso en varios idiomas, usa el mismo texto en todas las variantes
                        y cambia solo el idioma entre paréntesis (p. ej. <code>CURSO 26-27 (CASTELLANO)</code>,
                        <code>(VALENCIANO)</code>, <code>(INGLÉS)</code>) para que se agrupen en una familia.
                      </small>
                    </label>
                    <label>
                      Actividad
                      <input type="text" value={activity} onChange={(e) => setActivity(e.target.value)} />
                    </label>
                    <label>
                      Descripción
                      <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
                    </label>
                    <div className="admin-preview-meta">
                      <span>Idioma: <strong>{report.meta.language ?? 'es (por defecto)'}</strong></span>
                      <span>{loaded.fileCount} archivos · {humanSize(loaded.totalBytes)}</span>
                    </div>
                    {report.meta.palette.length > 0 && (
                      <div className="admin-palette">
                        Paleta:
                        {report.meta.palette.map((c) => (
                          <span key={c} className="admin-swatch" style={{ background: c }} title={c} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-wizard-step">
                <h4>4. Publicar</h4>
                {hasExisting && (
                  <div className="alert alert-warning">
                    Ya existe un tema oficial con id <code>{loaded.id}</code>: se <strong>actualizará</strong>
                    {' '}(se reemplazan sus archivos y se eliminan los que ya no estén en la carpeta).
                  </div>
                )}
                <button
                  className="btn-confirm"
                  onClick={handlePublish}
                  disabled={busy || hasErrors}
                  title={hasErrors ? 'Corrige los errores antes de publicar' : undefined}
                >
                  {busy ? 'Publicando…' : dryRun ? 'Simular publicación' : hasExisting ? 'Actualizar tema oficial' : 'Publicar tema oficial'}
                </button>
                {hasErrors && <p className="help-text">Hay errores que impiden publicar.</p>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
