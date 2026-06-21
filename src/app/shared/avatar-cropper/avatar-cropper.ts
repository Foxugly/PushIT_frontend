import { Component, computed, input, output, signal, viewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FileUploadModule, FileSelectEvent } from 'primeng/fileupload';
import { ImageCropperComponent, ImageCroppedEvent, ImageTransform } from 'ngx-image-cropper';

/** Labels the cropper needs — passed in so the component stays decoupled from
 * any specific i18n copy block (each page hands it its own translated strings). */
export interface AvatarCropperLabels {
  choose: string;
  hint: string;
  cropHint: string;
  zoomIn: string;
  zoomOut: string;
  apply: string;
  change: string;
}

/**
 * Circular avatar editor: pick an image, then zoom (+/-) and drag the round
 * frame to choose the visible area, and emit the cropped square PNG on apply.
 * The round template is purely a guide — the output is a 256px square PNG (the
 * platform masks it to a circle when rendering the notification avatar).
 */
@Component({
  selector: 'app-avatar-cropper',
  imports: [ButtonModule, TooltipModule, FileUploadModule, ImageCropperComponent],
  templateUrl: './avatar-cropper.html',
  styleUrl: './avatar-cropper.scss',
})
export class AvatarCropper {
  private static nextId = 0;

  readonly labels = input.required<AvatarCropperLabels>();
  /** Disables the controls while the parent is uploading the cropped result. */
  readonly pending = input(false);

  readonly cropped = output<File>();

  /** Stable id wiring the visible crop hint to the cropper via aria-describedby. */
  readonly cropHintId = `avatar-cropper-hint-${AvatarCropper.nextId++}`;

  /** The raw image being edited; null shows the file picker instead. */
  readonly sourceFile = signal<File | null>(null);
  readonly scale = signal(1);
  readonly transform = computed<ImageTransform>(() => ({ scale: this.scale() }));

  /** The underlying cropper, present only while an image is being edited.
   * apply() asks it for a *fresh* crop so the emitted PNG reflects the current
   * zoom: ngx-image-cropper applies zoom as a CSS transform and does NOT
   * re-emit imageCropped on a transform change, so any cached blob would be
   * stale (the previous bug left Apply permanently disabled after a zoom). */
  private readonly cropper = viewChild(ImageCropperComponent);

  /** Enables Apply once the cropper has a loaded, croppable image. */
  readonly ready = signal(false);

  /** Guards against re-entrant apply() while a crop/upload is in flight. */
  private applying = false;

  onSelect(event: FileSelectEvent): void {
    const file = event.currentFiles?.[0] ?? event.files?.[0];
    if (file) {
      this.reset();
      this.sourceFile.set(file);
    }
  }

  /** The cropper finished loading the image and can produce a crop. */
  onReady(): void {
    this.ready.set(true);
  }

  zoomIn(): void {
    this.scale.update((s) => Math.min(3, Math.round((s + 0.1) * 10) / 10));
  }

  zoomOut(): void {
    this.scale.update((s) => Math.max(1, Math.round((s - 0.1) * 10) / 10));
  }

  /** Discard the current image and go back to the file picker. */
  changeImage(): void {
    this.sourceFile.set(null);
    this.reset();
  }

  async apply(): Promise<void> {
    const cropper = this.cropper();
    if (this.applying || !this.ready() || !cropper) {
      return;
    }
    this.applying = true;
    try {
      // Recompute now, at the current zoom/frame — returns the cropped event and
      // also re-emits imageCropped. Default output is 'blob' (set on the element).
      const event = (await cropper.crop()) as ImageCroppedEvent | null;
      const blob = event?.blob;
      if (!blob) {
        return;
      }
      const type = blob.type || 'image/png';
      this.cropped.emit(new File([blob], 'logo.png', { type }));
      this.changeImage();
    } finally {
      this.applying = false;
    }
  }

  private reset(): void {
    this.scale.set(1);
    this.ready.set(false);
  }
}
