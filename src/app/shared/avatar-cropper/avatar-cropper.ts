import { Component, computed, input, output, signal } from '@angular/core';
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
  /** True once a fresh crop has been received for the current transform. Apply
   * is disabled until then, so we never emit a stale (pre-zoom) or null blob. */
  readonly hasCrop = signal(false);

  private lastBlob: Blob | null = null;

  onSelect(event: FileSelectEvent): void {
    const file = event.currentFiles?.[0] ?? event.files?.[0];
    if (file) {
      this.reset();
      this.sourceFile.set(file);
    }
  }

  onCropped(event: ImageCroppedEvent): void {
    this.lastBlob = event.blob ?? null;
    this.hasCrop.set(this.lastBlob !== null);
  }

  zoomIn(): void {
    this.scale.update((s) => Math.min(3, Math.round((s + 0.1) * 10) / 10));
    this.invalidateCrop();
  }

  zoomOut(): void {
    this.scale.update((s) => Math.max(1, Math.round((s - 0.1) * 10) / 10));
    this.invalidateCrop();
  }

  /** Discard the current image and go back to the file picker. */
  changeImage(): void {
    this.sourceFile.set(null);
    this.reset();
  }

  apply(): void {
    if (!this.hasCrop() || !this.lastBlob) {
      return;
    }
    const type = this.lastBlob.type || 'image/png';
    this.cropped.emit(new File([this.lastBlob], 'logo.png', { type }));
    this.changeImage();
  }

  /** A transform changed: the held blob is now stale until the cropper re-emits. */
  private invalidateCrop(): void {
    this.lastBlob = null;
    this.hasCrop.set(false);
  }

  private reset(): void {
    this.scale.set(1);
    this.invalidateCrop();
  }
}
