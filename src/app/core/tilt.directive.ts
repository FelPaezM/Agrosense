import { Directive, ElementRef, HostListener } from '@angular/core';

/** Inclinación 3D suave según el dedo / puntero */
@Directive({ selector: '[appTilt]', standalone: false })
export class TiltDirective {
  constructor(private el: ElementRef<HTMLElement>) { el.nativeElement.style.transition = 'transform .2s ease-out'; }
  @HostListener('pointermove', ['$event']) mover(e: PointerEvent) {
    const n = this.el.nativeElement, r = n.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    n.style.transform = `perspective(700px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg)`;
  }
  @HostListener('pointerleave') @HostListener('pointerup') salir() { this.el.nativeElement.style.transform = ''; }
}
