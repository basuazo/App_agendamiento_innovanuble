import { useEffect, useRef, useState } from 'react';
import { Comment, CommentTag } from '../types';
import { commentService } from '../services/comment.service';
import { useAuthStore } from '../store/authStore';
import { formatDateTime } from '../utils/dateHelpers';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const TAG_OPTIONS: { value: CommentTag; label: string; color: string }[] = [
  { value: 'GENERAL', label: 'Comentario General', color: 'bg-gray-100 text-gray-700' },
  { value: 'MACHINE_ISSUE', label: 'Máquina en Mal Estado', color: 'bg-red-100 text-red-700' },
  { value: 'ORDER', label: 'Orden', color: 'bg-blue-100 text-blue-700' },
  { value: 'CLEANING', label: 'Limpieza', color: 'bg-green-100 text-green-700' },
];

const TAG_ACTIVE: Record<CommentTag, string> = {
  GENERAL: 'bg-gray-600 text-white',
  MACHINE_ISSUE: 'bg-red-600 text-white',
  ORDER: 'bg-blue-600 text-white',
  CLEANING: 'bg-green-600 text-white',
};

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export default function CommunityPage() {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [tag, setTag] = useState<CommentTag>('GENERAL');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadComments = async () => {
    try {
      const data = await commentService.getAll();
      setComments(data);
    } catch {
      toast.error('Error al cargar comentarios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      await commentService.create(content.trim(), tag, imageFile ?? undefined);
      setContent('');
      setTag('GENERAL');
      clearImage();
      loadComments();
    } catch {
      toast.error('Error al publicar comentario');
    } finally {
      setPosting(false);
    }
  };

  const getTagOption = (t: CommentTag) => TAG_OPTIONS.find((o) => o.value === t)!;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Comunidad</h1>
      <p className="text-gray-500 text-sm mb-6">Feed compartido del espacio colaborativo</p>

      {/* Formulario */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <form onSubmit={handleSubmit}>
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {TAG_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTag(opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  tag === opt.value ? TAG_ACTIVE[opt.value] : opt.color + ' hover:opacity-80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Comparte algo con la comunidad..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />

          {/* Imagen preview */}
          {imagePreview && (
            <div className="relative mt-2 w-fit">
              <img
                src={imagePreview}
                alt="preview"
                className="h-24 rounded-lg object-cover border border-gray-200"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{content.length}/500</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-gray-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Foto
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="px-4 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {posting ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de comentarios */}
      {isLoading ? (
        <LoadingSpinner />
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Sé el primero en publicar en la comunidad</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const tagOpt = getTagOption(c.tag);
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-700 text-sm font-semibold">
                      {c.user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{c.user.name}</span>
                      {c.user.id === user?.id && (
                        <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">Tú</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagOpt.color}`}>
                        {tagOpt.label}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                    {c.imageUrl && (
                      <img
                        src={`${API_BASE}/uploads/comments/${c.imageUrl}`}
                        alt="adjunto"
                        className="mt-2 max-h-48 rounded-lg object-contain border border-gray-100"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
