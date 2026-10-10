import { simplifyApiMessage } from './api-messages';
import { api } from './api';

export async function adminApi(...args) {
  try { return await api(...args); }
  catch (error) {
    error.message = simplifyApiMessage(error.message);
    throw error;
  }
}
