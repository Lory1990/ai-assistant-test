import { useState } from 'react'
import { usePortfolio, useAddHolding, useRemoveHolding } from '../queries'

function InvestmentsSection() {
  const { data: portfolio, error } = usePortfolio()
  const addHoldingMutation = useAddHolding()
  const removeHoldingMutation = useRemoveHolding()
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [costBasis, setCostBasis] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const qty = Number(quantity.replace(',', '.'))
    if (!symbol.trim() || !qty || qty <= 0) return
    addHoldingMutation.mutate(
      { symbol: symbol.trim(), quantity: qty, costBasis: costBasis ? Number(costBasis.replace(',', '.')) : undefined },
      {
        onSuccess: () => {
          setSymbol('')
          setQuantity('')
          setCostBasis('')
        },
      },
    )
  }

  return (
    <div className="panel-grid">
      <div className="hud-panel">
        <h3>Portafoglio personale</h3>
        <p className="link-hint" style={{ marginBottom: 12 }}>
          Solo tracciamento del valore: nessun consiglio di investimento, nessuna operazione viene eseguita.
        </p>
        {error && <p className="empty">{(error as Error).message}</p>}
        {!error && !portfolio && <p className="empty">Caricamento...</p>}
        {!error && portfolio && portfolio.holdings.length === 0 && <p className="empty">Nessun titolo in portafoglio.</p>}
        {portfolio && portfolio.holdings.length > 0 && (
          <ul>
            {portfolio.holdings.map((h) => (
              <li key={h.id}>
                <span>
                  {h.symbol} · {h.quantity}
                  {h.error && <span className="item-meta"> — {h.error}</span>}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {h.value != null && (
                    <span className="item-meta">
                      {h.value.toFixed(2)}
                      {h.gainLoss != null ? ` (${h.gainLoss >= 0 ? '+' : ''}${h.gainLoss.toFixed(2)})` : ''}
                    </span>
                  )}
                  <button className="hud-button" onClick={() => removeHoldingMutation.mutate(h.id)}>
                    Rimuovi
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {portfolio && portfolio.holdings.length > 0 && (
          <p className="link-hint" style={{ marginTop: 8 }}>
            Valore totale: {portfolio.totalValue.toFixed(2)}
          </p>
        )}

        <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input className="hud-input" placeholder="Simbolo (es. AAPL)" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          <input className="hud-input" placeholder="Quantità" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <input
            className="hud-input"
            placeholder="Prezzo medio (opz.)"
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value)}
          />
          <button className="hud-button" type="submit" disabled={addHoldingMutation.isPending}>
            {addHoldingMutation.isPending ? 'Aggiungo...' : 'Aggiungi'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default InvestmentsSection
