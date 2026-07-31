/**
 * Pezzi comuni alle schede di allenamento e alimentari: hanno la stessa
 * testata (nome, note, periodo di validità) e si spiegano all'utente allo
 * stesso modo, quindi conviene che siano letteralmente lo stesso codice.
 */

/** ISO dal server → valore per <input type="date">, in ora locale. */
export function toDateInput(iso: string | null): string {
  if (!iso) return ''
  // 'sv-SE' formatta come YYYY-MM-DD, che è esattamente ciò che l'input vuole,
  // senza passare da toISOString() che sposterebbe la data in UTC.
  return new Date(iso).toLocaleDateString('sv-SE')
}

export function formatValidity(plan: { validFrom: string; validTo: string | null }): string {
  const from = new Date(plan.validFrom).toLocaleDateString('it-IT')
  if (!plan.validTo) return `dal ${from} — aperta`
  return `${from} → ${new Date(plan.validTo).toLocaleDateString('it-IT')}`
}

export function isActive(plan: { validFrom: string; validTo: string | null }, now = new Date()): boolean {
  if (new Date(plan.validFrom) > now) return false
  return plan.validTo === null || new Date(plan.validTo) >= now
}

export interface PlanWindowValue {
  name: string
  notes: string
  validFrom: string
  /** Stringa vuota = scheda aperta, fino a nuovo ordine. */
  validTo: string
}

export function PlanWindowFields({
  value,
  onChange,
  namePlaceholder,
}: {
  value: PlanWindowValue
  onChange: (next: PlanWindowValue) => void
  namePlaceholder: string
}) {
  const open = value.validTo === ''

  return (
    <>
      <input
        className="hud-input"
        placeholder={namePlaceholder}
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <input
        className="hud-input"
        placeholder="Note (facoltative)"
        value={value.notes}
        onChange={(e) => onChange({ ...value, notes: e.target.value })}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="item-meta" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Valida dal
          <input
            className="hud-input"
            type="date"
            value={value.validFrom}
            onChange={(e) => onChange({ ...value, validFrom: e.target.value })}
          />
        </label>
        <label className="item-meta" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          al
          <input
            className="hud-input"
            type="date"
            value={value.validTo}
            disabled={open}
            onChange={(e) => onChange({ ...value, validTo: e.target.value })}
          />
        </label>
        <label className="item-meta" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 18 }}>
          <input
            type="checkbox"
            checked={open}
            onChange={(e) =>
              onChange({ ...value, validTo: e.target.checked ? '' : toDateInput(new Date().toISOString()) })
            }
          />
          Aperta, fino a nuovo ordine
        </label>
      </div>
    </>
  )
}
