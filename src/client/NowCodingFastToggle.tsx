/** Session-local fast switch, immediately before the composer model seat. */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactElement } from 'react'
import { fastControlOf, type ModelDirectory } from './fast-control.ts'
import css from './NowCodingFastToggle.module.css'
import { getFastModels, getSessionFast, setSessionFast, onNowCodingSettingsCommitted } from './api.ts'

interface InputSnapshot { phase: string }
interface SessionSnapshot { running: boolean; removed?: boolean }
type SnapshotHook<T> = <R>(selector: (snapshot: T) => R) => R | undefined

export interface NowCodingFastToggleProps {
  directory: ModelDirectory
  sessionId: string
  available: boolean
  // Older hosts pass owner snapshots; current hosts pass the session hook kit.
  input?: InputSnapshot
  session?: SessionSnapshot
  useInput?: SnapshotHook<InputSnapshot>
  useSession?: SnapshotHook<SessionSnapshot>
}

export function NowCodingFastToggle({ directory, sessionId, available, input, session, useInput, useSession }: NowCodingFastToggleProps): ReactElement | null {
  const inputState = useInput?.(snapshot => snapshot) ?? input
  const sessionState = useSession?.(snapshot => snapshot) ?? session
  const state = useSyncExternalStore(
    listener => directory.store.subscribe(listener),
    () => directory.store.getSnapshot(),
  )
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const inFlight = useRef(false)
  const [fastModels, setFastModels] = useState<readonly string[]>([])
  const [mode, setMode] = useState<{ key: string; enabled: boolean } | null>(null)
  const control = fastControlOf(state, fastModels)
  const model = control?.model
  const key = JSON.stringify([sessionId, model])
  const generation = useRef(0)
  useEffect(() => {
    if (!available) return
    let disposed = false
    let request = 0
    const refresh = (): void => {
      const next = ++request
      void getFastModels().then(value => {
        if (!disposed && next === request) setFastModels(value.models)
      }, () => {
        if (!disposed && next === request) setFastModels([])
      })
    }
    refresh()
    const stop = onNowCodingSettingsCommitted(refresh)
    return () => { disposed = true; stop() }
  }, [directory, available, state.groups])
  useEffect(() => {
    if (available && directory.store.getSnapshot().status === 'idle') {
      void directory.load().catch(() => { /* Host store owns load failures. */ })
    }
  }, [directory, available])
  useEffect(() => {
    if (!available || model === undefined) return
    let disposed = false
    const refresh = (): void => {
      const request = ++generation.current
      void getSessionFast(sessionId, model).then(value => {
        if (!disposed && request === generation.current) setMode({ key, enabled: value.enabled })
      }, error => {
        if (!disposed && request === generation.current) {
          setMode(null)
          setFailure({ key, message: '读取快速模式失败：' + (error instanceof Error ? error.message : String(error)) })
        }
      })
    }
    refresh()
    const stop = onNowCodingSettingsCommitted(refresh)
    return () => { disposed = true; ++generation.current; stop() }
  }, [available, sessionId, model, key, sessionState?.running])
  if (!available || control === undefined) return null
  const active = mode?.key === key && mode.enabled
  const disabled = pending || mode?.key !== key || state.status === 'selecting' || state.status === 'loading'
    || sessionState === undefined || sessionState.running || sessionState.removed === true || inputState?.phase !== 'plain'
  const error = failure?.key === key ? failure.message : undefined
  const label = active ? '关闭 NowCoding 快速模式' : '开启 NowCoding 快速模式'
  const toggle = async (): Promise<void> => {
    if (disabled || inFlight.current) return
    inFlight.current = true
    const request = ++generation.current
    setPending(true)
    setFailure(null)
    try {
      const value = await setSessionFast(sessionId, control.model, !active)
      if (request === generation.current) setMode({ key, enabled: value.enabled })
    } catch (error) {
      if (request === generation.current) setFailure({ key, message: '切换失败：' + (error instanceof Error ? error.message : String(error)) })
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }
  return (
    <span className={css.root}>
      <button
        type="button"
        className={css.button}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        title={error ?? (active ? '快速模式已开启（计费高于标准档），点击关闭' : '标准模式，点击开启快速档（计费更高）')}
        onMouseDown={event => { event.preventDefault() }}
        onClick={() => { void toggle() }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
          <path d="M13 2 4 14h7l-1 8 10-12h-7l1-8Z" />
        </svg>
      </button>
      {error !== undefined && <span className={css.error} role="alert">{error}</span>}
    </span>
  )
}
