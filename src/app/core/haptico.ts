import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/** Vibraciones suaves de confirmación; en navegador o sin vibrador simplemente no hacen nada */
export async function toque() { try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* sin vibrador */ } }
export async function exito() { try { await Haptics.notification({ type: NotificationType.Success }); } catch { /* sin vibrador */ } }
