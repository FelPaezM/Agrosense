import { Injectable, signal } from '@angular/core';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut,
  deleteUser, sendPasswordResetEmail, User, GoogleAuthProvider, signInWithPopup, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, db } from './firebase';

export const VERSION_POLITICA = '1.0';
export interface Perfil { nombre: string; cultivo: string; email: string; consentimiento?: { version: string; fecha: string } }

/** Traduce errores de Firestore a un mensaje útil */
export function mensajeFirestore(e: any): string {
  const c = e?.code ?? '';
  if (c === 'permission-denied')
    return 'Firestore rechazó la operación (permission-denied). Publica las reglas de firestore.rules y revisa que App Check no esté en modo «Enforced».';
  if (c === 'unavailable' || c === 'failed-precondition') return 'Sin conexión con Firestore. Revisa tu internet e inténtalo de nuevo.';
  return 'No se pudo guardar el perfil: ' + (c || e?.message || 'error');
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<User | null>(null);
  perfil = signal<Perfil | null>(null);
  listo = signal(false);
  cargandoPerfil = signal(false);
  errorPerfil = signal('');   // último error al leer/guardar el perfil (para mostrarlo en pantalla)

  constructor() {
    onAuthStateChanged(auth, async u => {
      this.user.set(u);
      this.perfil.set(null);
      if (u) {
        this.cargandoPerfil.set(true);
        this.errorPerfil.set('');
        try {
          const s = await getDoc(doc(db, 'perfiles', u.uid));
          if (s.exists()) this.perfil.set(s.data() as Perfil);
        } catch (e) { this.errorPerfil.set(mensajeFirestore(e)); }
        this.cargandoPerfil.set(false);
      }
      this.listo.set(true);
    });
  }

  private consentimiento() { return { version: VERSION_POLITICA, fecha: new Date().toISOString() }; }

  /** Registro con correo: solo se llama después de que la persona aceptó la política */
  async registrar(nombre: string, cultivo: string, email: string, pass: string) {
    const c = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(c.user, { displayName: nombre });
    const p: Perfil = { nombre, cultivo, email, consentimiento: this.consentimiento() };
    try {
      await setDoc(doc(db, 'perfiles', c.user.uid), p);
      this.perfil.set(p);
    } catch (e) {
      // La cuenta ya se creó: la persona queda dentro y la pantalla «completar perfil» reintenta el guardado.
      this.errorPerfil.set(mensajeFirestore(e));
      throw e;
    }
  }
  login(email: string, pass: string) { return signInWithEmailAndPassword(auth, email, pass); }

  /** Google: no se guarda ningún perfil hasta que la persona acepte la política */
  async loginGoogle() {
    if (Capacitor.isNativePlatform()) {
      const r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
      const idToken = r.credential?.idToken;
      if (!idToken) throw { code: 'auth/missing-id-token' };
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    } else {
      await signInWithPopup(auth, new GoogleAuthProvider());
    }
  }

  recuperar(email: string) { return sendPasswordResetEmail(auth, email.trim()); }

  async completarPerfil(cultivo: string, nuevoConsentimiento: boolean) {
    const u = this.user(); if (!u) return;
    const p: Perfil = { ...(this.perfil() ?? {}), nombre: this.perfil()?.nombre || u.displayName || '', cultivo, email: u.email ?? '' };
    if (nuevoConsentimiento) p.consentimiento = this.consentimiento();
    this.errorPerfil.set('');
    try { await setDoc(doc(db, 'perfiles', u.uid), p, { merge: true }); }
    catch (e) { this.errorPerfil.set(mensajeFirestore(e)); throw e; }
    this.perfil.set(p);
  }

  /** Derecho de supresión: borra perfil, cuenta y datos locales */
  async eliminarCuenta() {
    const u = this.user(); if (!u) return;
    try { await deleteDoc(doc(db, 'perfiles', u.uid)); } catch { /* puede no existir */ }
    await deleteUser(u);
    await Preferences.clear();
  }

  exportar() {
    const u = this.user();
    return JSON.stringify({ cuenta: { uid: u?.uid, correo: u?.email, nombre: u?.displayName, acceso: u?.providerData.map(p => p.providerId) }, perfil: this.perfil() }, null, 2);
  }
  logout() { return signOut(auth); }
}
