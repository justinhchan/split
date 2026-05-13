/// <reference types="vite/client" />

/*
 * React 19 scoped JSX under `React.JSX`. A lot of our components use the
 * legacy `JSX.Element` return type (that's what our shadcn ports and our own
 * files all use), so we re-expose the old global here. One declaration file,
 * zero component churn.
 */
import type * as React from 'react'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    type Element = React.JSX.Element
    type ElementClass = React.JSX.ElementClass
    type ElementAttributesProperty = React.JSX.ElementAttributesProperty
    type ElementChildrenAttribute = React.JSX.ElementChildrenAttribute
    type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>
    type IntrinsicAttributes = React.JSX.IntrinsicAttributes
    type IntrinsicClassAttributes<T> = React.JSX.IntrinsicClassAttributes<T>
    type IntrinsicElements = React.JSX.IntrinsicElements
  }

  /** Exposed by the preload bridge — see src/preload/index.ts. */
  interface Window {
    api: import('../../preload/index').Api
    electron: import('@electron-toolkit/preload').ElectronAPI
  }
}

export {}
