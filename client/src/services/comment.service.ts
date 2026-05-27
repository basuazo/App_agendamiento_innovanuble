import api from './api';
import { Comment, CommentTag } from '../types';

export const commentService = {
  getAll: () => api.get<Comment[]>('/comments').then((r) => r.data),

  create: (content: string, tag: CommentTag, imageFile?: File) => {
    if (imageFile) {
      const form = new FormData();
      form.append('content', content);
      form.append('tag', tag);
      form.append('image', imageFile);
      return api
        .post<Comment>('/comments', form, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((r) => r.data);
    }
    return api.post<Comment>('/comments', { content, tag }).then((r) => r.data);
  },
};
