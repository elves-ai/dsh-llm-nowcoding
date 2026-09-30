/**
 * Remaining-balance card for the sidebar foot.
 *
 * Registers into `sidebar.footer.action`, directly beside the Settings row.
 * The Host owns every decision the card renders — whether it is enabled, the
 * amounts, and the refresh interval — so the card holds no configuration of its
 * own and needs no props; it reads the fenced `/nowcoding/api` route instead.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client/NowCodingQuotaCard
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { NowCodingApiError, getQuota, type NowCodingQuotaSnapshotView, type NowCodingQuotaView } from './api.ts'
import styles from './NowCodingQuotaCard.module.css'

/** Refresh interval assumed until the Host reports its own. */
const DEFAULT_REFRESH_SECONDS = 300

/** Share of the grant below which the card warns. */
const LOW_REMAINING_RATIO = 0.2

/** What the card currently shows. */
type CardState =
  | { kind: 'loading' }
  | { kind: 'ready'; view: NowCodingQuotaView }
  | { kind: 'failed'; message: string }

/** One amount in the gateway's display currency. */
function formatAmount(value: number, currency: string): string {
  const rounded = Math.round(value * 100) / 100
  return currency + rounded.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/** Whether the remaining balance is low enough to warn about. */
function isLow(snapshot: NowCodingQuotaSnapshotView): boolean {
  if (snapshot.unlimited || snapshot.total <= 0) return false
  return snapshot.remaining / snapshot.total < LOW_REMAINING_RATIO
}

/** The one-line summary the card renders for a loaded balance. */
function summaryOf(snapshot: NowCodingQuotaSnapshotView, currency: string): string {
  if (snapshot.unlimited) return '不限额度'
  return `剩余 ${formatAmount(snapshot.remaining, currency)}`
}

/** Fill share of the grant, clamped to a renderable range. */
function fillPercent(snapshot: NowCodingQuotaSnapshotView): number {
  if (snapshot.unlimited || snapshot.total <= 0) return 100
  const ratio = snapshot.remaining / snapshot.total
  return Math.max(0, Math.min(1, ratio)) * 100
}

/**
 * The sidebar balance card.
 * @returns the card, or null while the user has it switched off.
 */
export function NowCodingQuotaCard(): ReactElement | null {
  const [state, setState] = useState<CardState>({ kind: 'loading' })
  const [refreshSeconds, setRefreshSeconds] = useState(DEFAULT_REFRESH_SECONDS)

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const view = await getQuota(signal)
      if (signal?.aborted === true) return
      setRefreshSeconds(view.refreshSeconds > 0 ? view.refreshSeconds : DEFAULT_REFRESH_SECONDS)
      setState({ kind: 'ready', view })
    } catch (error) {
      if (signal?.aborted === true) return
      setState({
        kind: 'failed',
        message: error instanceof NowCodingApiError ? error.message : String(error),
      })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => { controller.abort() }
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => { void load() }, refreshSeconds * 1_000)
    return () => { clearInterval(timer) }
  }, [load, refreshSeconds])

  const retry = useCallback((): void => {
    setState({ kind: 'loading' })
    void load()
  }, [load])

  if (state.kind === 'ready' && !state.view.enabled) return null

  if (state.kind === 'loading') {
    return <div className={styles.card} data-state="loading">余量读取中…</div>
  }

  if (state.kind === 'failed') {
    return (
      <div className={styles.card} data-state="failed" title={state.message}>
        <span className={styles.summary}>余量读取失败</span>
        <button type="button" className={styles.retry} onClick={retry}>重试</button>
      </div>
    )
  }

  const { snapshot, currency } = state.view
  if (snapshot === null) {
    return <div className={styles.card} data-state="unconfigured">未配置 API Key</div>
  }

  const low = isLow(snapshot)
  return (
    <div className={styles.card} data-state={low ? 'low' : 'ready'}>
      <div className={styles.row}>
        <span className={styles.summary}>{summaryOf(snapshot, currency)}</span>
        <span className={styles.total}>
          {snapshot.unlimited ? '' : `/ ${formatAmount(snapshot.total, currency)}`}
        </span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${fillPercent(snapshot)}%` }} />
      </div>
    </div>
  )
}
