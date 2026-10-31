import { Component, OnInit, signal } from '@angular/core';
import { SPLASH_IMG } from './core/splash-img';
import { TemaService } from './core/tema.service';

@Component({
  standalone: false,
  selector: 'app-root',
  template: `
  <ion-app>
    <div class="sky">
      <div class="stars"></div>
      <div class="astro" [class.moon]="!tema.dia()" [style.left]="tema.ax() + '%'" [style.top]="tema.ay() + '%'"></div>
      <div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>
      <svg class="land" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden="true">
        <path class="l1" d="M0 60 Q100 10 200 52 T400 40 V140 H0Z"/><path class="l2" d="M0 98 Q120 58 240 92 T400 80 V140 H0Z"/>
      </svg>
    </div>
    <ion-router-outlet />
    @if (splash()) {
      <div class="splash" [class.out]="saliendo()" [style.background-image]="'url(' + img + ')'">
        <div class="shade"></div><div class="bar"><span></span></div>
      </div>
    }
  </ion-app>`,
  styles: [`
    .sky{position:absolute;inset:0;overflow:hidden;background:var(--sky);transition:background 2s}
    .astro{position:absolute;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;transition:left 60s linear,top 60s linear;
      background:radial-gradient(circle,#fffbe0,#ffd35a 60%,#ffb347);box-shadow:0 0 70px 24px rgba(255,200,90,.55)}
    .astro.moon{background:radial-gradient(circle at 35% 35%,#fff,#e1e7ff 60%,#b9c4ee);box-shadow:0 0 56px 14px rgba(160,180,255,.4)}
    .stars{position:absolute;inset:0;opacity:var(--stars);transition:opacity 3s;animation:tw 4s ease-in-out infinite alternate;
      background-image:radial-gradient(1.6px 1.6px at 12% 14%,#fff,transparent),radial-gradient(1.2px 1.2px at 28% 32%,#fff,transparent),
      radial-gradient(1.8px 1.8px at 46% 10%,#fff,transparent),radial-gradient(1.2px 1.2px at 63% 26%,#fff,transparent),
      radial-gradient(1.6px 1.6px at 82% 12%,#fff,transparent),radial-gradient(1.2px 1.2px at 90% 38%,#fff,transparent),
      radial-gradient(1.4px 1.4px at 8% 46%,#fff,transparent),radial-gradient(1.2px 1.2px at 72% 48%,#fff,transparent)}
    .cloud{position:absolute;height:34px;border-radius:40px;background:rgba(255,255,255,.7);filter:blur(1px);opacity:var(--clouds);animation:drift linear infinite}
    .cloud::before{content:'';position:absolute;left:18%;top:-16px;width:46%;height:34px;border-radius:50%;background:inherit}
    .c1{width:110px;top:14%;left:-140px;animation-duration:70s}.c2{width:80px;top:30%;left:-120px;animation-duration:95s;animation-delay:-30s}
    .c3{width:130px;top:46%;left:-150px;animation-duration:120s;animation-delay:-70s}
    .land{position:absolute;left:0;bottom:0;width:100%;height:24%}
    .l1{fill:var(--land1)}.l2{fill:var(--land2)}
    @keyframes drift{to{transform:translateX(130vw)}}@keyframes tw{from{filter:brightness(.7)}to{filter:brightness(1.3)}}
    .splash{position:fixed;inset:0;z-index:99999;background:#1a0d05 center/cover no-repeat;transition:opacity .6s}
    .splash.out{opacity:0;pointer-events:none}
    .shade{position:absolute;inset:auto 0 0 0;height:30%;background:linear-gradient(transparent,rgba(0,0,0,.45))}
    .bar{position:absolute;left:50%;bottom:calc(46px + env(safe-area-inset-bottom,0px));width:150px;height:5px;margin-left:-75px;border-radius:5px;background:rgba(255,255,255,.3);overflow:hidden}
    .bar span{display:block;height:100%;width:40%;background:#fff;border-radius:5px;animation:load 1.2s infinite ease-in-out}
    @keyframes load{0%{margin-left:-40%}100%{margin-left:100%}}
  `]
})
export class AppComponent implements OnInit {
  img = SPLASH_IMG; splash = signal(true); saliendo = signal(false);
  constructor(public tema: TemaService) {}
  ngOnInit() {
    setTimeout(() => this.saliendo.set(true), 2000);
    setTimeout(() => this.splash.set(false), 2600);
  }
}
