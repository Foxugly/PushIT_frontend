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
  loadError: string;
}

/** Longest-side cap for the source image handed to the cropper. A 256px avatar
 * never needs more; downscaling keeps the editor fast and dodges the cropper's
 * size-measuring retries that can otherwise time out on very large photos. */
const MAX_SOURCE_PX = 1024;

/**
 * Circular avatar editor: pick an image, then zoom (+/-) and drag the round
 * frame to choose the visible area, and emit the cropped square PNG on apply.
 * The round template is purely a guide — the output is a 256px square PNG (the
 * platform masks it to a circle when rendering the notification avatar).
 *
 * The picked file is decoded with the browser's native decoder and re-encoded
 * as a normalized PNG data URL before being handed to ngx-image-cropper (via
 * imageBase64). This means: (1) anything the browser can actually display loads
 * reliably — we bypass the cropper's fragile file-load + size-retry path that
 * could fail on otherwise-valid images; (2) genuinely undecodable files (HEIC,
 * corrupt) are caught up front with a clear message instead of a blank editor.
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

  /** The normalized image (a PNG data URL) handed to the cropper via
   * imageBase64; null shows the file picker instead. */
  readonly sourceImage = signal<string | null>(null);
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

  /** True when the last picked file couldn't be decoded by the browser
   * (unsupported format such as HEIC, a CMYK/progressive JPEG, or a corrupt
   * file). Drives a visible message instead of a silent blank cropper. */
  readonly loadFailed = signal(false);

  /** Guards against re-entrant apply() while a crop/upload is in flight. */
  private applying = false;

  async onSelect(event: FileSelectEvent): Promise<void> {
    const file = event.currentFiles?.[0] ?? event.files?.[0];
    if (!file) {
      return;
    }
    this.reset();
    this.sourceImage.set(null);
    try {
      const dataUrl = await this.normalizeImage(file);
      this.loadFailed.set(false);
      this.sourceImage.set(dataUrl);
    } catch {
      // The browser couldn't decode the file (HEIC, corrupt, truly unsupported).
      // Surface a clear message instead of opening a blank cropper.
      this.loadFailed.set(true);
    }
  }

  /** Decode the file with the browser's native decoder and re-encode it as a
   * (downscaled) PNG data URL. Throws if the file can't be decoded. */
  private async normalizeImage(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const longest = Math.max(bitmap.width, bitmap.height);
      const scale = longest > MAX_SOURCE_PX ? MAX_SOURCE_PX / longest : 1;
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('2D canvas context unavailable');
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
      return canvas.toDataURL('image/png');
    } finally {
      bitmap.close();
    }
  }

  /** The cropper finished loading the image and can produce a crop. */
  onReady(): void {
    this.ready.set(true);
  }

  /** Safety net: the cropper failed even for a pre-decoded image — drop back to
   * the picker and surface the error rather than leaving a blank editor. */
  onLoadFailed(): void {
    this.sourceImage.set(null);
    this.scale.set(1);
    this.ready.set(false);
    this.loadFailed.set(true);
  }

  zoomIn(): void {
    this.scale.update((s) => Math.min(3, Math.round((s + 0.1) * 10) / 10));
  }

  zoomOut(): void {
    this.scale.update((s) => Math.max(1, Math.round((s - 0.1) * 10) / 10));
  }

  /** Discard the current image and go back to the file picker. */
  changeImage(): void {
    this.sourceImage.set(null);
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
