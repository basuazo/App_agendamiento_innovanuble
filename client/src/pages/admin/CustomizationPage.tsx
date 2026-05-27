import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useBrandingStore } from '../../store/brandingStore';
import { settingsService } from '../../services/settings.service';
import { applyBrandColors, generateBrandPalette } from '../../utils/colorHelpers';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function CustomizationPage() {
  const { user, currentSpaceId } = useAuthStore();
  const { logoUrl, primaryColor, set: setBranding } = useBrandingStore();

  const [isLoading, setIsLoading] = useState(true);
  const [colorInput, setColorInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const role = user?.role;
  const canManageSettings = role === 'ADMIN' || role === 'SUPER_ADMIN';

  if (!canManageSettings) return <Navigate to="/calendar" replace />;

  const isSuperAdminWithoutSpace = role === 'SUPER_ADMIN' && !currentSpaceId;

  useEffect(() => {
    setIsLoading(true);
    settingsService.getCustomization()
      .then((data) => {
        setBranding(data);
        setColorInput(data.primaryColor ?? '');
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [currentSpaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setColorInput(primaryColor ?? '');
  }, [primaryColor, currentSpaceId]);

  const handleColorChange = (val: string) => {
    setColorInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) applyBrandColors(val);
  };

  const handleSaveColor = async () => {
    const color = colorInput.trim() || null;
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      toast.error('El color debe estar en formato #RRGGBB');
      return;
    }
    setIsSaving(true);
    try {
      const data = await settingsService.updateColors(color);
      setBranding(data);
      applyBrandColors(data.primaryColor);
      toast.success('Color guardado');
    } catch {
      toast.error('Error al guardar el color');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetColor = async () => {
    setIsSaving(true);
    try {
      const data = await settingsService.updateColors(null);
      setBranding(data);
      setColorInput('');
      applyBrandColors(null);
      toast.success('Color restablecido');
    } catch {
      toast.error('Error al restablecer el color');
    } finally {
      setIsSaving(false);
    }
  };

  const previewPalette = (() => {
    const hex = colorInput.trim();
    return /^#[0-9a-fA-F]{6}$/.test(hex) ? generateBrandPalette(hex) : null;
  })();

  if (isSuperAdminWithoutSpace) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Selecciona un espacio en la barra superior para ver su personalización.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Personalización del espacio</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configura el color principal de la interfaz para este espacio.
        </p>
      </div>

      {/* Logo informativo */}
      {logoUrl && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-800">Logo del espacio</h2>
          <div className="flex items-center gap-4">
            <img
              src={logoUrl}
              alt="Logo del espacio"
              className="h-14 w-14 object-contain rounded-lg border border-gray-100"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <p className="text-sm text-gray-500">
              Archivo: <code className="font-mono text-gray-700">{logoUrl}</code>
              <br />
              <span className="text-xs text-gray-400">
                Para cambiarlo, reemplaza el archivo en <code className="font-mono">client/public/</code> y vuelve a desplegar.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Color primario */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Color principal</h2>
        <p className="text-sm text-gray-500">
          Define el color de botones, enlaces e indicadores activos. Se generan automáticamente los tonos necesarios.
        </p>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={colorInput || '#0284c7'}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={colorInput}
            onChange={(e) => handleColorChange(e.target.value)}
            placeholder="#0284c7"
            maxLength={7}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {previewPalette && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Vista previa de tonos</p>
            <div className="flex gap-2">
              {Object.entries(previewPalette).map(([key, color]) => (
                <div key={key} className="flex flex-col items-center gap-1">
                  <div
                    className="w-8 h-8 rounded-lg shadow-sm border border-black/5"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-400">{key.replace('--brand-', '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSaveColor}
            disabled={isSaving}
            className="px-5 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60"
          >
            {isSaving ? 'Guardando...' : 'Guardar color'}
          </button>
          {primaryColor && (
            <button
              onClick={handleResetColor}
              disabled={isSaving}
              className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Restablecer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
