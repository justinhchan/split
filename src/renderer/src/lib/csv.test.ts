import { describe, expect, it } from 'vitest'
import { applyPaymentHeuristic, parseAmount, parseCSV, parseDate } from './csv'
import type { Transaction } from '../store/types'

// Synthetic CSV fixtures kept inline (and deliberately fake) so we don't ship
// representative-looking statement data with the source. They cover the shapes
// the parser cares about: signed-amount columns, split debit/credit columns,
// the payment-row heuristic, and a small credit that should not be excluded.
const SINGLE_AMOUNT_CSV = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
04/11/2026,04/12/2026,ACME CAFE,Food & Drink,Sale,-15.64,
04/10/2026,04/11/2026,FAKE GAS CO,Gas,Sale,-48.00,
04/09/2026,04/09/2026,SAMPLE DELIVERY,Food & Drink,Sale,-32.18,
04/08/2026,04/08/2026,PAYMENT THANK YOU - WEB,Payment,Payment,1250.00,
04/05/2026,04/06/2026,EXAMPLE GROCERS,Groceries,Sale,-87.43,
04/04/2026,04/05/2026,DEMO STREAMING,Entertainment,Sale,-17.99,
`

const DEBIT_CREDIT_CSV = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2025-12-16,2025-12-16,0000,ACME RETAIL,Merchandise,32.17,
2025-12-15,2025-12-15,0000,EXAMPLE GROCERS,Groceries,58.40,
2025-12-14,2025-12-14,0000,FAKE TRANSIT,Transport,8.50,
2025-12-10,2025-12-10,0000,SAMPLE LUNCH CO,Food,7.95,
2025-11-28,2025-11-28,0000,SMALL REFUND CO,Food,,3.75
2025-11-19,2025-11-19,0000,AUTOPAY THANK YOU,Payment/Credit,,2066.33
2025-11-15,2025-11-15,0000,DEMO GAMES,Entertainment,39.99,
`

function mkTx(partial: Partial<Transaction> & Pick<Transaction, 'amount'>): Transaction {
  return {
    id: partial.id ?? Math.random().toString(),
    date: partial.date ?? '2026-04-01',
    description: partial.description ?? 'test',
    category: partial.category,
    amount: partial.amount,
    tags: partial.tags ?? []
  }
}

describe('parseAmount', () => {
  it('parses plain decimals', () => {
    expect(parseAmount('10.50')).toBe(10.5)
    expect(parseAmount('-12.34')).toBe(-12.34)
    expect(parseAmount('0')).toBe(0)
  })

  it('strips currency symbols, commas, and whitespace', () => {
    expect(parseAmount('$1,234.56')).toBeCloseTo(1234.56)
    expect(parseAmount('£99.00')).toBe(99)
    expect(parseAmount('  42.00  ')).toBe(42)
  })

  it('treats parentheses as negative', () => {
    expect(parseAmount('(25.00)')).toBe(-25)
    expect(parseAmount('($1,000.00)')).toBe(-1000)
  })

  it('returns null for garbage', () => {
    expect(parseAmount('')).toBe(null)
    expect(parseAmount('abc')).toBe(null)
    expect(parseAmount('-')).toBe(null)
  })
})

describe('parseDate', () => {
  it('normalises ISO dates', () => {
    expect(parseDate('2026-04-12')).toBe('2026-04-12')
    expect(parseDate('2026-04-12T10:00:00Z')).toBe('2026-04-12')
  })

  it('normalises MM/DD/YYYY', () => {
    expect(parseDate('04/11/2026')).toBe('2026-04-11')
    expect(parseDate('4/1/2026')).toBe('2026-04-01')
  })

  it('returns null for unparseable input', () => {
    expect(parseDate('')).toBe(null)
    expect(parseDate('not a date')).toBe(null)
  })
})

describe('parseCSV — single-amount column', () => {
  const result = parseCSV(SINGLE_AMOUNT_CSV)

  it('picks the right columns in single-amount mode', () => {
    expect(result.detected.mode).toBe('single')
    expect(result.detected.date).toMatch(/date/i)
    expect(result.detected.description).toBe('Description')
    expect(result.detected.amount).toBe('Amount')
    expect(result.detected.category).toBe('Category')
  })

  it('detects the sign-flip (charges mostly negative)', () => {
    expect(result.detected.flipSign).toBe(true)
  })

  it('produces positive charge amounts after the flip', () => {
    const food = result.transactions.find((t) => /ACME CAFE/.test(t.description))
    expect(food?.amount).toBeCloseTo(15.64)
  })

  it('flags the Payment Thank You row as excluded', () => {
    const payment = result.transactions.find((t) => /PAYMENT THANK YOU/.test(t.description))
    expect(payment?.isPayment).toBe(true)
    expect(payment?.excluded).toBe(true)
    expect(result.excludedCount).toBe(1)
  })

  it('is not ambiguous', () => {
    expect(result.ambiguous).toBe(false)
  })
})

describe('parseCSV — debit/credit columns', () => {
  const result = parseCSV(DEBIT_CREDIT_CSV)

  it('detects debit/credit mode', () => {
    expect(result.detected.mode).toBe('debit-credit')
    expect(result.detected.debit).toBe('Debit')
    expect(result.detected.credit).toBe('Credit')
  })

  it('excludes the autopay credit row', () => {
    const autopay = result.transactions.find((t) => /AUTOPAY THANK YOU/.test(t.description))
    expect(autopay?.isPayment).toBe(true)
    expect(autopay?.excluded).toBe(true)
  })

  it('does not exclude a small credit (returns/refunds under threshold)', () => {
    const refund = result.transactions.find((t) => /SMALL REFUND CO/.test(t.description))
    expect(refund?.excluded).not.toBe(true)
  })
})

describe('applyPaymentHeuristic', () => {
  it('flags rows whose description matches payment keywords', () => {
    const txs = [
      mkTx({ amount: -1000, description: 'ONLINE PAYMENT - THANK YOU' }),
      mkTx({ amount: -25, description: 'STARBUCKS' })
    ]
    applyPaymentHeuristic(txs, 'single')
    expect(txs[0].excluded).toBe(true)
    expect(txs[0].isPayment).toBe(true)
    expect(txs[1].excluded).not.toBe(true)
  })

  it('flags a sign-flipped row over the magnitude threshold', () => {
    const txs = [
      mkTx({ amount: -15, description: 'cafe' }),
      mkTx({ amount: -20, description: 'bus' }),
      mkTx({ amount: -40, description: 'groceries' }),
      mkTx({ amount: 800, description: 'mystery credit' })
    ]
    applyPaymentHeuristic(txs, 'single')
    const credit = txs[3]
    expect(credit.isPayment).toBe(true)
    expect(credit.excluded).toBe(true)
  })

  it('leaves small sign-flipped rows alone (merchant refund, not a payment)', () => {
    const txs = [
      mkTx({ amount: -15, description: 'cafe' }),
      mkTx({ amount: -20, description: 'bus' }),
      mkTx({ amount: 8, description: 'coffee refund' })
    ]
    applyPaymentHeuristic(txs, 'single')
    expect(txs[2].excluded).not.toBe(true)
  })

  it('respects the category column', () => {
    const txs = [
      mkTx({ amount: -2000, description: 'random description', category: 'Payment/Credit' })
    ]
    applyPaymentHeuristic(txs, 'debit-credit')
    expect(txs[0].isPayment).toBe(true)
  })
})
