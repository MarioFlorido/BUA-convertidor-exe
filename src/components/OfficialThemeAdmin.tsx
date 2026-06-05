import { useState } from 'react';
import { GitHubAuthService, type TokenPersistence } from '../core/services/admin/GitHubAuthService';
import { GitHubThemePublisher, type PublishResult } from '../core/services/admin/GitHubThemePublisher';
import { readThemeDirectory, isDirectoryPickerSupported } from '../core/services/admin/readThemeDirectory';
import { validateThemeForPublish, type ThemeValidationReport } from '../core/services/admin/themeValidation';
import { screenshotToObjectUrl } from '../core/services/themeConfigParser';
import { DEFAULT_PUBLISH_BRANCH } from '../core/services/admin/githubRepo';
import { ThemeRegistry } from '../core/services/ThemeRegistry';

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
      setName(id.replace(/_/g, ' '));
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

  // ── Render: no autenticado ──
  if (!authed) {
    return (
      <div className="admin-panel">
        <h3>Administración de temas oficiales</h3>
        <p className="help-text">
          Zona restringida. Introduce un <strong>token de acceso de GitHub</strong> (fine-grained PAT
          limitado a este repositorio, con permiso <code>Contents: Read and write</code>). El token
          no se guarda en la aplicación.
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

      {/* Resultado de la operación (publicar / actualizar / eliminar) */}
      {result && (
        <div className={`alert ${result.dryRun ? 'alert-info' : 'alert-success'}`}>
          {result.dryRun ? (
            <>
              <strong>Simulación (dry-run)</strong> en <code>{result.branch}</code>: se subirían{' '}
              {result.upserted} archivo(s) y se eliminarían {result.deleted}. No se ha modificado nada.
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
          <button type="button" className="link-button" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? '▲ Ocultar opciones avanzadas' : '▼ Opciones avanzadas'}
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
                  {deletingId === t.id ? (
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
                    <button
                      className="btn-delete"
                      onClick={() => { setDeletingId(t.id); setConfirmText(''); setError(null); }}
                      disabled={busy}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="help-text">
            Para <strong>actualizar</strong> un tema, vuelve a publicar su carpeta con el mismo nombre
            (mismo id) en el asistente de abajo: se reemplazan los archivos y se conservan sus metadatos.
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
