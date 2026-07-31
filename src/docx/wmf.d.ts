declare module "wmf" {
  export interface WmfTextAction {
    t: "text";
    v: string;
    p: [number, number];
    s: Record<string, unknown>;
  }

  export type WmfAction =
    | WmfTextAction
    | {
        t: string;
        [key: string]: unknown;
      };

  export function get_actions(data: ArrayBuffer | Uint8Array): WmfAction[];
  export function image_size(
    data: ArrayBuffer | Uint8Array,
  ): readonly [number, number];
  export function render_canvas(
    actions: readonly WmfAction[],
    canvas: HTMLCanvasElement,
  ): void;
  export function draw_canvas(
    data: ArrayBuffer | Uint8Array,
    canvas: HTMLCanvasElement,
  ): void;
}
