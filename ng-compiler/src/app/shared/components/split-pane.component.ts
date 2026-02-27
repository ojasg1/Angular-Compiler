import { Component, input, ElementRef, viewChild, signal } from '@angular/core';

@Component({
  selector: 'app-split-pane',
  standalone: true,
  template: `
    <div class="split-container" [class.horizontal]="direction() === 'horizontal'"
         [class.vertical]="direction() === 'vertical'">
      <div class="split-pane first" [style]="firstPaneStyle()">
        <ng-content select="[first-pane]" />
      </div>
      <div class="split-divider"
           (mousedown)="startDrag($event)"
           [class.dragging]="isDragging()">
        <div class="divider-handle"></div>
      </div>
      <div class="split-pane second" [style]="secondPaneStyle()">
        <ng-content select="[second-pane]" />
      </div>
    </div>
  `,
  styles: [`
    .split-container {
      display: flex;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .split-container.horizontal { flex-direction: row; }
    .split-container.vertical { flex-direction: column; }
    .split-pane { overflow: auto; min-width: 100px; min-height: 100px; }
    .split-divider {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .horizontal > .split-divider {
      width: 5px; cursor: col-resize;
      background: #2d2d2d;
    }
    .vertical > .split-divider {
      height: 5px; cursor: row-resize;
      background: #2d2d2d;
    }
    .split-divider:hover, .split-divider.dragging { background: #007acc; }
    .divider-handle { width: 1px; height: 20px; background: #555; }
    .vertical .divider-handle { width: 20px; height: 1px; }
  `],
  host: {
    '(document:mousemove)': 'onDrag($event)',
    '(document:mouseup)': 'stopDrag()',
  },
})
export class SplitPaneComponent {
  direction = input<'horizontal' | 'vertical'>('horizontal');
  initialSplit = input(50); // percentage for first pane

  splitPercent = signal(50);
  isDragging = signal(false);

  private hostEl?: HTMLElement;

  constructor(private elRef: ElementRef) {}

  ngOnInit(): void {
    this.splitPercent.set(this.initialSplit());
    this.hostEl = this.elRef.nativeElement;
  }

  firstPaneStyle() {
    const prop = this.direction() === 'horizontal' ? 'width' : 'height';
    return `${prop}: ${this.splitPercent()}%; flex-shrink: 0;`;
  }

  secondPaneStyle() {
    return 'flex: 1; overflow: auto;';
  }

  startDrag(event: MouseEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrag(event: MouseEvent): void {
    if (!this.isDragging() || !this.hostEl) return;

    const container = this.hostEl.querySelector('.split-container') as HTMLElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    let percent: number;

    if (this.direction() === 'horizontal') {
      percent = ((event.clientX - rect.left) / rect.width) * 100;
    } else {
      percent = ((event.clientY - rect.top) / rect.height) * 100;
    }

    this.splitPercent.set(Math.max(10, Math.min(90, percent)));
  }

  stopDrag(): void {
    this.isDragging.set(false);
  }
}
