import { useEffect, useState } from 'react';
import { Certification, Category } from '../types';
import { certificationService } from '../services/certification.service';
import { useResourceStore } from '../store/resourceStore';
import { formatDateTime } from '../utils/dateHelpers';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

export default function MyCertificationsPage() {
  const { resources, fetchAll: fetchResources } = useResourceStore();
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Derivar categorías únicas desde los recursos
  const categoryMap = new Map<string, Category>();
  for (const r of resources) {
    if (!categoryMap.has(r.categoryId)) categoryMap.set(r.categoryId, r.category);
  }
  const allCategories = Array.from(categoryMap.values()).sort((a, b) => a.order - b.order);

  // Categorías que requieren certificación
  const certRequiredSet = new Set(
    resources.filter((r) => r.requiresCertification).map((r) => r.categoryId),
  );

  const load = async () => {
    try {
      setIsLoading(true);
      const certs = await certificationService.getMyCertifications();
      setCertifications(certs);
    } catch {
      toast.error('Error al cargar certificaciones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Mis Certificaciones</h1>
      <p className="text-gray-500 text-sm mb-6">
        Las certificaciones te permiten reservar máquinas directamente sin esperar aprobación del administrador.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allCategories.map((cat) => {
          const cert = certifications.find((c) => c.categoryId === cat.id);
          const requiresCert = certRequiredSet.has(cat.id);

          return (
            <div
              key={cat.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
              style={{ borderLeftColor: cat.color, borderLeftWidth: 4 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <h3 className="font-semibold text-gray-900 text-sm">{cat.name}</h3>
              </div>

              {!requiresCert ? (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-emerald-500 text-base">✓</span>
                    <span className="text-sm font-medium text-emerald-600">No requiere certificación</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Puedes reservar directamente sin pasar por este proceso.
                  </p>
                </div>
              ) : cert ? (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-emerald-600 text-lg">✓</span>
                    <span className="text-sm font-medium text-emerald-700">Certificada</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Desde {formatDateTime(cert.certifiedAt)}
                  </p>
                  {cert.certifier && (
                    <p className="text-xs text-gray-400">Por {cert.certifier.name}</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-gray-400 text-base">○</span>
                    <span className="text-sm font-medium text-gray-500">Sin certificación</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Las reservas quedarán pendientes de aprobación hasta que una administradora te certifique.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
