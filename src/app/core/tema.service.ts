import { Injectable, signal, computed } from '@angular/core';

export type Fase = 'amanecer' | 'dia' | 'tarde' | 'atardecer' | 'noche';

const P: Record<Fase, Record<string, string>> = {
  amanecer: { '--sky': 'linear-gradient(180deg,#ffd9b0 0%,#ff9fa0 55%,#b78bd9 100%)', '--text': '#3b1f45', '--muted': '#7d5a85',
    '--card': 'rgba(255,255,255,.58)', '--border': 'rgba(255,255,255,.75)', '--accent': '#ff6b6b', '--accent2': '#ffb347',
    '--tabbg': 'rgba(255,255,255,.72)', '--shadow': '0 12px 32px rgba(120,50,100,.22)', '--land1': '#9a64a3', '--land2': '#7a4688', '--stars': '0', '--clouds': '.8' },
  dia: { '--sky': 'linear-gradient(180deg,#7cc8ff 0%,#b9e6ff 60%,#eaf8ff 100%)', '--text': '#0f2a3d', '--muted': '#4f7087',
    '--card': 'rgba(255,255,255,.66)', '--border': 'rgba(255,255,255,.85)', '--accent': '#0a9bb0', '--accent2': '#ff9f1c',
    '--tabbg': 'rgba(255,255,255,.78)', '--shadow': '0 12px 32px rgba(20,90,140,.2)', '--land1': '#35b58a', '--land2': '#1f8f6a', '--stars': '0', '--clouds': '1' },
  tarde: { '--sky': 'linear-gradient(180deg,#58a6e8 0%,#ffd08a 58%,#ff9f6b 100%)', '--text': '#3d2410', '--muted': '#865a38',
    '--card': 'rgba(255,255,255,.6)', '--border': 'rgba(255,255,255,.8)', '--accent': '#e8590c', '--accent2': '#1c9bb3',
    '--tabbg': 'rgba(255,255,255,.76)', '--shadow': '0 12px 32px rgba(140,70,20,.22)', '--land1': '#d98e48', '--land2': '#b86b2e', '--stars': '0', '--clouds': '.85' },
  atardecer: { '--sky': 'linear-gradient(180deg,#4b2f8f 0%,#d9548a 55%,#ff9a5a 100%)', '--text': '#fff7f0', '--muted': '#f2cfe0',
    '--card': 'rgba(35,16,70,.42)', '--border': 'rgba(255,255,255,.22)', '--accent': '#ffb347', '--accent2': '#ff6fa5',
    '--tabbg': 'rgba(40,18,76,.62)', '--shadow': '0 12px 32px rgba(20,5,50,.45)', '--land1': '#3b2260', '--land2': '#2a1648', '--stars': '.35', '--clouds': '.5' },
  noche: { '--sky': 'linear-gradient(180deg,#070b2b 0%,#1a1f66 60%,#3b2a86 100%)', '--text': '#eef1ff', '--muted': '#a9b3e6',
    '--card': 'rgba(255,255,255,.09)', '--border': 'rgba(255,255,255,.16)', '--accent': '#8aa4ff', '--accent2': '#c084fc',
    '--tabbg': 'rgba(20,24,80,.7)', '--shadow': '0 12px 32px rgba(0,0,20,.55)', '--land1': '#0f1440', '--land2': '#0a0e30', '--stars': '1', '--clouds': '.12' }
};
const HORA: Record<Fase, number> = { amanecer: 6, dia: 10, tarde: 14, atardecer: 18, noche: 22 };

@Injectable({ providedIn: 'root' })
export class TemaService {
  fase = signal<Fase>('dia');
  hora = signal(12);
  /** Posición del astro: sol de 4:00 a 18:59, luna de 19:00 a 3:59 */
  dia = computed(() => this.hora() >= 4 && this.hora() < 19);
  private t = computed(() => { const h = this.hora(); return h >= 4 && h < 19 ? (h - 4) / 15 : (h >= 19 ? h - 19 : h + 5) / 9; });
  ax = computed(() => Math.round(10 + this.t() * 80));
  ay = computed(() => Math.round(40 - Math.sin(Math.PI * this.t()) * 14));
  accent = computed(() => P[this.fase()]['--accent']);
  /** Buen día 4:00–11:59 · Buenas tardes 12:00–18:59 · Buenas noches 19:00–3:59 */
  saludo = computed(() => ({ amanecer: 'Buen día', dia: 'Buen día', tarde: 'Buenas tardes', atardecer: 'Buenas tardes', noche: 'Buenas noches' }[this.fase()]));

  constructor() {
    this.aplicar();
    setInterval(() => this.aplicar(), 60000);
  }

  private aplicar() {
    const d = new Date(); let h = d.getHours() + d.getMinutes() / 60;
    let f: Fase = h >= 4 && h < 8 ? 'amanecer' : h >= 8 && h < 12 ? 'dia' : h >= 12 && h < 17 ? 'tarde' : h >= 17 && h < 19 ? 'atardecer' : 'noche';
    const forzar = new URLSearchParams(location.search).get('fase') as Fase | null; // prueba: /?fase=noche
    if (forzar && P[forzar]) { f = forzar; h = HORA[forzar]; }
    this.fase.set(f); this.hora.set(h);
    const st = document.documentElement.style;
    for (const k in P[f]) st.setProperty(k, P[f][k]);
    const a = P[f]['--accent'];
    st.setProperty('--ion-color-primary', a); st.setProperty('--ion-color-primary-shade', a); st.setProperty('--ion-color-primary-tint', a);
    st.setProperty('--ion-color-primary-rgb', [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)).join(','));
    st.setProperty('--ion-text-color', P[f]['--text']);
    document.documentElement.dataset['fase'] = f;
  }
}
