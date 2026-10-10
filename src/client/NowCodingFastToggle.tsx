/** Session-local fast switch, immediately before the composer model seat. */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactElement } from 'react'
import { fastControlOf, type ModelDirectory } from './fast-control.ts'
import css from './NowCodingFastToggle.module.css'
import { getFastModels, onNowCodingSettingsCommitted } from './api.ts'

interface InputSnapshot { phase: string }
interface SessionSnapshot { running: boolean; removed?: boolean }
type SnapshotHook<T> = <R>(selector: (snapshot: T) => R) => R | undefined

export interface NowCodingFastToggleProps {
  directory: ModelDirectory
  available: boolean
  // Older hosts pass owner snapshots; current hosts pass the session hook kit.
  input?: InputSnapshot
  session?: SessionSnapshot
  useInput?: SnapshotHook<InputSnapshot>
  useSession?: SnapshotHook<SessionSnapshot>
}

export function NowCodingFastToggle({ directory, available, input, session, useInput, useSession }: NowCodingFastToggleProps): ReactElement | null {
  const inputState = useInput?.(snapshot => snapshot) ?? input
  const sessionState = useSession?.(snapshot => snapshot) ?? session
  const state = useSyncExternalStore(
    listener => directory.store.subscribe(listener),
    () => directory.store.getSnapshot(),
  )
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<{ model: string; message: string } | null>(null)
  const inFlight = useRef(false)
  const [fastModels, setFastModels] = useState<readonly string[]>([])
  useEffect(() => {
    if (!available) return
    let disposed = false
    let generation = 0
    const refresh = (): void => {
      const request = ++generation
      void getFastModels().then(value => {
        if (!disposed && request === generation) setFastModels(value.models)
      }, () => {
        if (!disposed && request === generation) setFastModels([])
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
  const control = fastControlOf(state, fastModels)
  if (!available || control === undefined) return null
  const disabled = pending || state.status === 'selecting' || state.status === 'loading'
    || sessionState === undefined || sessionState.running || sessionState.removed === true || inputState?.phase !== 'plain'
  const error = failure !== null && failure.model === state.current?.model ? failure.message : undefined
  const label = control.active ? '关闭 NowCoding 快速模式' : '开启 NowCoding 快速模式'
  const toggle = async (): Promise<void> => {
    if (disabled || inFlight.current) return
    inFlight.current = true
    setPending(true)
    setFailure(null)
    try {
      const result = await directory.select(control.selection)
      if (result?.ok === false) throw new Error(result.error.code + ': ' + result.error.message)
    } catch (error) {
      setFailure({ model: state.current!.model, message: '切换失败：' + (error instanceof Error ? error.message : String(error)) })
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
        aria-pressed={control.active}
        disabled={disabled}
        title={error ?? (control.active ? '快速模式已开启（计费高于标准档），点击关闭' : '标准模式，点击开启快速档（计费更高）')}
        onMouseDown={event => { event.preventDefault() }}
        onClick={() => { void toggle() }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill={control.active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
          <path d="M13 2 4 14h7l-1 8 10-12h-7l1-8Z" />
        </svg>
      </button>
      {error !== undefined && <span className={css.error} role="alert">{error}</span>}
    </span>
  )
}
