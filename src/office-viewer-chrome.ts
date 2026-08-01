import { setIcon } from "obsidian";

export interface OfficeViewerErrorAction {
  readonly label: string;
  readonly action: string;
  readonly onClick: () => void;
  readonly title?: string;
  readonly ariaLabel?: string;
}

export interface OfficeViewerErrorSurfaceOptions {
  readonly title: string;
  readonly safetyNote: string;
  readonly retry: OfficeViewerErrorAction;
  readonly openExternal?: OfficeViewerErrorAction;
  readonly extraActions?: readonly HTMLElement[];
  readonly classNames?: {
    readonly root?: string;
    readonly status?: string;
    readonly safetyNote?: string;
    readonly actions?: string;
    readonly actionStatus?: string;
  };
}

export interface OfficeViewerErrorSurface {
  readonly panel: HTMLElement;
  readonly actionStatus: HTMLElement;
}

export interface OfficeViewerToolbar {
  readonly root: HTMLElement;
  readonly primary: HTMLElement;
  readonly secondary: HTMLElement;
}

/**
 * Shared Office Viewer recovery card: title, safety note, primary retry,
 * optional external open, and host-supplied extra actions.
 */
export function createOfficeViewerErrorSurface(
  options: OfficeViewerErrorSurfaceOptions,
): OfficeViewerErrorSurface {
  const panel = document.createElement("div");
  panel.className = classNames(
    "office-viewer-error",
    options.classNames?.root,
  );

  const status = document.createElement("div");
  status.className = classNames(
    "office-viewer-error__status",
    options.classNames?.status,
  );
  status.textContent = options.title;
  status.setAttribute("role", "status");

  const safety = document.createElement("p");
  safety.className = classNames(
    "office-viewer-error__safety-note",
    options.classNames?.safetyNote,
  );
  safety.textContent = options.safetyNote;

  const actions = document.createElement("div");
  actions.className = classNames(
    "office-viewer-error__actions",
    options.classNames?.actions,
  );

  const retry = createActionButton(options.retry);
  actions.append(retry);

  for (const extra of options.extraActions ?? []) {
    actions.append(extra);
  }

  if (options.openExternal !== undefined) {
    actions.append(createActionButton(options.openExternal));
  }

  const actionStatus = document.createElement("div");
  actionStatus.className = classNames(
    "office-viewer-error__action-status",
    options.classNames?.actionStatus,
  );
  actionStatus.setAttribute("role", "status");
  actionStatus.setAttribute("aria-live", "polite");

  panel.append(status, safety, actions, actionStatus);
  return { panel, actionStatus };
}

/** Shared chrome row: primary actions left, secondary actions right. */
export function createOfficeViewerToolbar(
  extraClassName?: string,
): OfficeViewerToolbar {
  const root = document.createElement("div");
  root.className = classNames("office-viewer-toolbar", extraClassName);
  const primary = document.createElement("div");
  primary.className = "office-viewer-toolbar__primary";
  const secondary = document.createElement("div");
  secondary.className = "office-viewer-toolbar__secondary";
  root.append(primary, secondary);
  return { root, primary, secondary };
}

/** Apply Obsidian icon + shared hit-target class to a toolbar/icon button. */
export function decorateOfficeViewerIconButton(
  button: HTMLButtonElement,
  iconId: string,
): void {
  button.classList.add("office-viewer-icon-button");
  button.textContent = "";
  setIcon(button, iconId);
}

function createActionButton(
  action: OfficeViewerErrorAction,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = action.label;
  button.setAttribute("data-action", action.action);
  if (action.title !== undefined) button.title = action.title;
  if (action.ariaLabel !== undefined) {
    button.setAttribute("aria-label", action.ariaLabel);
  }
  button.addEventListener("click", action.onClick);
  return button;
}

function classNames(
  ...parts: Array<string | undefined>
): string {
  return parts.filter((part): part is string =>
    part !== undefined && part.length > 0
  ).join(" ");
}
