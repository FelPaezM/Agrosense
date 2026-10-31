import { Injectable } from '@angular/core';
import { auth } from './firebase';
import { CHAT_URL } from './ai-config';

export interface ModeloIA { id: string; nombre: string }
export interface MensajeChat { rol: 'user' | 'assistant'; texto: string; modelo?: string }

/** Habla con el Worker de Cloudflare, que guarda las claves y reparte la consulta entre varios modelos gratuitos */
@Injectable({ providedIn: 'root' })
export class ChatService {
  configurado() { return !CHAT_URL.includes('TU-WORKER'); }

  async modelos(): Promise<ModeloIA[]> {
    const r = await fetch(CHAT_URL + '/modelos');
    return r.ok ? r.json() : [];
  }

  async preguntar(mensajes: MensajeChat[], modelo: string, contexto: string): Promise<{ respuesta: string; modeloUsado: string }> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Inicia sesión para usar el asistente.');
    let r: Response;
    try {
      r = await fetch(CHAT_URL + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ modelo, contexto, mensajes: mensajes.slice(-10).map(m => ({ role: m.rol, content: m.texto })) })
      });
    } catch { throw new Error('No se pudo contactar al asistente. Revisa tu conexión a internet.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'El asistente no pudo responder (código ' + r.status + ').');
    return d;
  }
}
