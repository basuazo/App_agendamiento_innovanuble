import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useBrandingStore } from '../../store/brandingStore';
import { spaceService } from '../../services/space.service';
import { notificationService } from '../../services/notification.service';
import type { Space } from '../../types';

export default function Navbar() {
  const { user, logout, currentSpaceId, setCurrentSpace } = useAuthStore();
  const { logoUrl } = useBrandingStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const adminRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Cargar conteo de notificaciones no leídas
  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    const load = () => {
      notificationService.getAll().then(({ unreadCount: c }) => setUnreadCount(c)).catch(() => {});
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      spaceService.getAll().then((data) => {
        setSpaces(data);
        // Auto-seleccionar el primer espacio si no hay ninguno seleccionado
        if (!currentSpaceId && data.length > 0) {
          setCurrentSpace(data[0].id);
        }
      }).catch(() => {});
    }
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar el menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
      if (spaceRef.current && !spaceRef.current.contains(e.target as Node)) {
        setSpaceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cerrar el menú al cambiar de ruta; refrescar notificaciones al salir de /notifications
  useEffect(() => {
    setAdminOpen(false);
    setMobileMenuOpen(false);
    setMobileAdminOpen(false);
    setSpaceOpen(false);
    if (location.pathname !== '/notifications' && user) {
      notificationService.getAll().then(({ unreadCount: c }) => setUnreadCount(c)).catch(() => {});
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSpace = spaces.find((s) => s.id === currentSpaceId);

  // Helpers de permisos por rol
  const role = user?.role;
  const isElevated       = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'LIDER_COMUNITARIA';
  const canManageCerts   = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'LIDER_COMUNITARIA';
  const canManageTrainings = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const canManageCategories = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'LIDER_COMUNITARIA';
  const canManageUsers   = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'LIDER_COMUNITARIA';
  const canManageBookings = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'LIDER_COMUNITARIA';
  const canManageSettings = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) =>
    location.pathname === path ? 'text-brand-600 font-semibold' : 'text-gray-600 hover:text-brand-600';

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo + Nombre */}
          <Link to="/calendar" className="flex items-center gap-2.5">
            <img
              src={logoUrl ?? '/logo.png'}
              alt="Logo"
              className="h-9 w-9 object-contain rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            {/* Iniciales de fallback */}
            <div
              style={{ display: 'none' }}
              className="w-9 h-9 bg-brand-600 rounded-lg items-center justify-center flex-shrink-0"
            >
              <span className="text-white text-xs font-bold">ECT</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-gray-900 text-base leading-tight block">
                Espacio Colaborativo
              </span>
              <span className="font-bold text-brand-600 text-base leading-tight block">
                Textil
              </span>
            </div>
          </Link>

          {/* Links de navegación — solo desktop */}
          <div className="hidden md:flex items-center gap-5">
            <Link to="/calendar" className={`text-sm transition-colors ${isActive('/calendar')}`}>
              Calendario
            </Link>
            <Link to="/my-bookings" className={`text-sm transition-colors ${isActive('/my-bookings')}`}>
              Mis Reservas
            </Link>
            <Link to="/community" className={`text-sm transition-colors ${isActive('/community')}`}>
              Comunidad
            </Link>
            <Link to="/my-certifications" className={`text-sm transition-colors ${isActive('/my-certifications')}`}>
              Certificaciones
            </Link>

            {/* Selector de espacio — solo SUPER_ADMIN */}
            {user?.role === 'SUPER_ADMIN' && (
              <div className="relative" ref={spaceRef}>
                <button
                  onClick={() => setSpaceOpen((prev) => !prev)}
                  className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {currentSpace?.name ?? 'Todos los espacios'}
                  <svg className={`w-3.5 h-3.5 transition-transform ${spaceOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {spaceOpen && spaces.length > 0 && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    {spaces.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setCurrentSpace(s.id); setSpaceOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${currentSpaceId === s.id ? 'text-purple-700 font-semibold bg-purple-50' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Menú Super Admin */}
            {user?.role === 'SUPER_ADMIN' && (
              <Link
                to="/superadmin/spaces"
                className={`text-sm transition-colors ${isActive('/superadmin/spaces')}`}
              >
                Espacios
              </Link>
            )}

            {/* Menú Admin — visible a todos los roles elevados */}
            {isElevated && (
              <div className="relative" ref={adminRef}>
                <button
                  onClick={() => setAdminOpen((prev) => !prev)}
                  className={`text-sm flex items-center gap-1 transition-colors ${
                    location.pathname.startsWith('/admin')
                      ? 'text-brand-600 font-semibold'
                      : 'text-gray-600 hover:text-brand-600'
                  }`}
                >
                  Admin
                  <svg
                    className={`w-4 h-4 transition-transform duration-150 ${adminOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {adminOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    {canManageCategories && (
                      <Link to="/admin/categories" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Categorías
                      </Link>
                    )}
                    <Link to="/admin/resources" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Recursos
                    </Link>
                    {canManageUsers && (
                      <Link to="/admin/users" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Usuarios
                      </Link>
                    )}
                    {canManageBookings && (
                      <Link to="/admin/bookings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Todas las Reservas
                      </Link>
                    )}
                    {canManageCerts && (
                      <Link to="/admin/certifications" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                        Certificaciones
                      </Link>
                    )}
                    {canManageTrainings && (
                      <Link to="/admin/trainings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Capacitaciones
                      </Link>
                    )}
                    {canManageSettings && (
                      <Link to="/admin/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Horarios
                      </Link>
                    )}
                    {canManageSettings && (
                      <Link to="/admin/customization" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        Personalización
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Campana de notificaciones — desktop */}
          <div className="hidden md:flex items-center">
            <Link to="/notifications" className="relative p-2 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          </div>

          {/* Usuario + Salir — solo desktop */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/profile" className="text-right group">
              <p className="text-sm font-medium text-gray-900 group-hover:text-brand-600 transition-colors">{user?.name}</p>
              <p className="text-xs text-gray-500">
                {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role === 'ADMIN' ? 'Administrador' : user?.role === 'LIDER_COMUNITARIA' ? 'Líder Comunitaria' : 'Usuario'}
              </p>
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              Salir
            </button>
          </div>

          {/* Botón hamburguesa — solo móvil */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

        </div>
      </div>

      {/* Menú móvil desplegable */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white shadow-lg max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <div className="px-4 py-3 space-y-1">
            <Link to="/calendar" className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/calendar' ? 'bg-brand-50 text-brand-600' : 'text-gray-700 hover:bg-gray-50'
            }`}>
              Calendario
            </Link>
            <Link to="/my-bookings" className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/my-bookings' ? 'bg-brand-50 text-brand-600' : 'text-gray-700 hover:bg-gray-50'
            }`}>
              Mis Reservas
            </Link>
            <Link to="/community" className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/community' ? 'bg-brand-50 text-brand-600' : 'text-gray-700 hover:bg-gray-50'
            }`}>
              Comunidad
            </Link>
            <Link to="/my-certifications" className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/my-certifications' ? 'bg-brand-50 text-brand-600' : 'text-gray-700 hover:bg-gray-50'
            }`}>
              Certificaciones
            </Link>
            <Link to="/notifications" className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/notifications' ? 'bg-brand-50 text-brand-600' : 'text-gray-700 hover:bg-gray-50'
            }`}>
              Notificaciones
              {unreadCount > 0 && (
                <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Selector de espacio móvil — solo SUPER_ADMIN */}
            {user?.role === 'SUPER_ADMIN' && spaces.length > 0 && (
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Espacio activo</p>
                <div className="space-y-1">
                  {spaces.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setCurrentSpace(s.id); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        currentSpaceId === s.id
                          ? 'bg-purple-50 text-purple-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {s.name}
                      {currentSpaceId === s.id && (
                        <svg className="w-3.5 h-3.5 ml-auto text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {user?.role === 'SUPER_ADMIN' && (
              <Link
                to="/superadmin/spaces"
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/superadmin/spaces' ? 'bg-brand-50 text-brand-600' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Espacios
              </Link>
            )}

            {isElevated && (
              <div>
                <button
                  onClick={() => setMobileAdminOpen((prev) => !prev)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname.startsWith('/admin') ? 'bg-brand-50 text-brand-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Admin
                  <svg
                    className={`w-4 h-4 transition-transform duration-150 ${mobileAdminOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mobileAdminOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-3">
                    {canManageCategories && (
                      <Link to="/admin/categories" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        Categorías
                      </Link>
                    )}
                    <Link to="/admin/resources" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      Recursos
                    </Link>
                    {canManageUsers && (
                      <Link to="/admin/users" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        Usuarios
                      </Link>
                    )}
                    {canManageBookings && (
                      <Link to="/admin/bookings" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        Todas las Reservas
                      </Link>
                    )}
                    {canManageCerts && (
                      <Link to="/admin/certifications" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        Certificaciones
                      </Link>
                    )}
                    {canManageTrainings && (
                      <Link to="/admin/trainings" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        Capacitaciones
                      </Link>
                    )}
                    {canManageSettings && (
                      <Link to="/admin/settings" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        Horarios
                      </Link>
                    )}
                    {canManageSettings && (
                      <Link to="/admin/customization" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        Personalización
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <Link to="/profile" className="group" onClick={() => setMobileMenuOpen(false)}>
              <p className="text-sm font-medium text-gray-900 group-hover:text-brand-600 transition-colors">{user?.name}</p>
              <p className="text-xs text-gray-500">
                {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role === 'ADMIN' ? 'Administrador' : user?.role === 'LIDER_COMUNITARIA' ? 'Líder Comunitaria' : 'Usuario'}
              </p>
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
