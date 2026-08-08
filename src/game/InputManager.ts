import type { InputMethod } from '../data/types';

interface InputHandlers {
  onHoldStart(method: InputMethod, timestamp: number): void;
  onRelease(method: InputMethod, timestamp: number): void;
}

export class InputManager {
  private isHolding = false;
  private handlers: InputHandlers;

  constructor(handlers: InputHandlers) {
    this.handlers = handlers;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  attachTouchButton(button: HTMLElement): void {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      this.beginHold('touch', performance.now());
    });
    button.addEventListener('pointerup', (event) => {
      event.preventDefault();
      this.endHold('touch', performance.now());
    });
    button.addEventListener('pointercancel', () => this.endHold('touch', performance.now()));
    button.addEventListener('pointerleave', (event) => {
      if (event.buttons === 0) this.endHold('touch', performance.now());
    });
  }

  reset(): void {
    this.isHolding = false;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (event.repeat) return;
    this.beginHold('keyboard', performance.now());
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    this.endHold('keyboard', performance.now());
  };

  private beginHold(method: InputMethod, timestamp: number): void {
    if (this.isHolding) return;
    this.isHolding = true;
    this.handlers.onHoldStart(method, timestamp);
  }

  private endHold(method: InputMethod, timestamp: number): void {
    if (!this.isHolding) return;
    this.isHolding = false;
    this.handlers.onRelease(method, timestamp);
  }
}
