# Security

## Supported release

Security fixes target the latest published Office Viewer release on GitHub and
in Obsidian Community Plugins.

## Security model

- PPTX packages are inspected before renderer allocation.
- ZIP entry, expanded-size, media, and XML limits bound resource use.
- Macros, VBA, ActiveX, embedded executable content, and external media are
  rejected and never executed or fetched.
- External hyperlinks are not followed automatically.
- Source files are read-only and are never modified by the viewer.
- Rendering is isolated per Obsidian view and cancellation/disposal is scoped
  to the open generation.
- Candidate exceptions are mapped to stable categories before user display or
  diagnostic export.
- Non-blocking compatibility warnings can be disabled by turning off
  **Diagnostic summary**. Security rejections for macros, ActiveX, external
  content, resource limits, and other blocking failures are not controlled by
  that setting.

Office Viewer is a previewer, not a malware scanner or a complete PowerPoint
security boundary. Do not treat a successful preview as proof that a file is
safe to open in another application.

## Reporting a vulnerability

Do not attach confidential presentations or paste presentation content into a
public issue. Use [GitHub's private vulnerability reporting](
https://github.com/jerry4pan/obsidian-office-viewer-plugin/security/advisories/new)
for this repository. Include the Office Viewer version, Obsidian version,
operating system, stable error category, reproducible steps using a
non-confidential fixture, and the content-free diagnostic summary if relevant.
