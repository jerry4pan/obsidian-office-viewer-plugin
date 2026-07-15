# M3 Message Review Record

- Status: Pending human approval
- Source revision: final M3 branch diff from `f4b5440`
- Catalogs: Simplified Chinese (`zh-Hans`) and Traditional Chinese (`zh-Hant`)

## Review scope

Human reviewers must compare the English source and both Chinese values in
`src/i18n.ts` for these M3 keys:

- `compatibility.unsupportedContent`
- `compatibility.fontSubstitution`
- `diagnostics.copy`
- `diagnostics.copied`
- `diagnostics.copyFailure`
- `error.unsupportedLegacy`
- `error.resourceExhausted`
- `error.cancelled`
- `error.sourceUnmodifiedLegacy`
- `settings.localProcessing`
- `settings.localProcessingDescription`
- `settings.compatibility`
- `settings.compatibilityDescription`
- `settings.diagnostics`
- `settings.diagnosticsDescription`

Automated catalog completeness, placeholder checks, three-locale DOM coverage,
and installed locale smoke tests do not replace the approvals below.

## Approval

- [ ] Simplified Chinese reviewed by a proficient human; reviewer, date, and
  reviewed commit recorded here or in the linked GitHub review.
- [ ] Traditional Chinese reviewed by a proficient human; reviewer, date, and
  reviewed commit recorded here or in the linked GitHub review.

M3 release readiness remains pending until both boxes have durable evidence.
