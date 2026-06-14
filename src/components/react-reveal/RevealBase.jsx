/*
 * RevealBase Component For react-reveal
 *
 * Copyright © Roman Nosov 2016, 2017
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React from 'react'
import {
  string,
  object,
  number,
  bool,
  func,
  oneOfType,
  oneOf,
  shape,
  element,
} from 'prop-types'
import {
  namespace,
  ssr,
  disableSsr,
  globalHide,
  hideAll,
  cascade,
  collapseend,
  fadeOutEnabled,
  observerMode,
  raf,
} from './lib/globals'

const inOut = shape({
  make: func,
  duration: number.isRequired,
  delay: number.isRequired,
  forever: bool,
  count: number.isRequired,
  style: object.isRequired,
  reverse: bool,
})

const propTypes = {
  collapse: bool,
  collapseEl: element,
  cascade: bool,
  wait: number,
  force: bool,
  disabled: bool,
  appear: bool,
  enter: bool,
  exit: bool,
  fraction: number,
  refProp: string,
  innerRef: func,
  onReveal: func,
  unmountOnExit: bool,
  mountOnEnter: bool,
  inEffect: inOut.isRequired,
  outEffect: oneOfType([inOut, oneOf([false])]).isRequired,
  ssrReveal: bool,
  collapseOnly: bool,
  ssrFadeout: bool,
}

const defaultProps = {
  fraction: 0.2,
  refProp: 'ref',
}

class RevealBase extends React.Component {
  constructor(props) {
    super(props)

    this.isOn = props.when !== undefined ? !!props.when : true
    this.state = {
      collapse: props.collapse
        ? RevealBase.getInitialCollapseStyle(props)
        : undefined,
      style: {
        opacity:
          (!this.isOn || props.ssrReveal) && props.outEffect ? 0 : undefined,
      },
    }

    this.savedChild = false
    this.isShown = false

    if (!observerMode) {
      this.revealHandler = this.makeHandler(this.reveal)
      this.resizeHandler = this.makeHandler(this.resize)
    } else {
      this.handleObserve = this.handleObserve.bind(this)
    }

    this.saveRef = this.saveRef.bind(this)
  }

  saveRef(node) {
    if (typeof this.childRef === 'function') {
      this.childRef(node)
    } else if (this.childRef && typeof this.childRef === 'object') {
      this.childRef.current = node
    }

    if (this.props.innerRef) {
      this.props.innerRef(node)
    }

    if (this.el !== node) {
      this.el = node && 'offsetHeight' in node ? node : undefined
      this.observe(this.props, true)
    }
  }

  invisible() {
    if (!this || !this.el) return

    this.savedChild = false

    if (!this.isShown) {
      this.setState({
        hasExited: true,
        collapse: this.props.collapse
          ? { ...this.state.collapse, visibility: 'hidden' }
          : null,
        style: {
          opacity: 0,
        },
      })

      if (!observerMode && this.props.collapse) {
        window.document.dispatchEvent(collapseend)
      }
    }
  }

  animationEnd(func, shouldCascade, { forever, count, delay, duration }) {
    if (forever) return

    const handler = () => {
      if (!this || !this.el) return
      this.animationEndTimeout = undefined
      func.call(this)
    }

    this.animationEndTimeout = window.setTimeout(
      handler,
      delay + (duration + (shouldCascade ? duration : 0) * count)
    )
  }

  getDimensionValue() {
    return (
      this.el.offsetHeight +
      parseInt(
        window.getComputedStyle(this.el, null).getPropertyValue('margin-top'),
        10
      ) +
      parseInt(
        window
          .getComputedStyle(this.el, null)
          .getPropertyValue('margin-bottom'),
        10
      )
    )
  }

  collapse(state, props, inOutEffect) {
    const total =
      inOutEffect.duration + (props.cascade ? inOutEffect.duration : 0)
    const height = this.isOn ? this.getDimensionValue() : 0

    let duration
    let delay

    if (props.collapseOnly) {
      duration = inOutEffect.duration / 3
      delay = inOutEffect.delay
    } else {
      const delta1 = total >> 2
      const delta2 = delta1 >> 1

      duration = delta1
      delay = inOutEffect.delay + (this.isOn ? 0 : total - delta1 - delta2)

      state.style.animationDuration = `${
        total - delta1 + (this.isOn ? delta2 : -delta2)
      }ms`
      state.style.animationDelay = `${
        inOutEffect.delay + (this.isOn ? delta1 - delta2 : 0)
      }ms`
    }

    state.collapse = {
      height,
      transition: `height ${duration}ms ease ${delay}ms`,
      overflow: props.collapseOnly ? 'hidden' : undefined,
    }

    return state
  }

  animate(props) {
    if (!this || !this.el) return

    this.unlisten()

    if (this.isShown === this.isOn) return

    this.isShown = this.isOn

    const leaving = !this.isOn && props.outEffect
    const inOutEffect = props[leaving ? 'outEffect' : 'inEffect']

    let animationName =
      ('style' in inOutEffect && inOutEffect.style.animationName) || undefined

    let state

    if (!props.collapseOnly) {
      if ((props.outEffect || this.isOn) && inOutEffect.make) {
        animationName = inOutEffect.make
      }

      state = {
        hasAppeared: true,
        hasExited: false,
        collapse: undefined,
        style: {
          ...inOutEffect.style,
          animationDuration: `${inOutEffect.duration}ms`,
          animationDelay: `${inOutEffect.delay}ms`,
          animationIterationCount: inOutEffect.forever
            ? 'infinite'
            : inOutEffect.count,
          opacity: 1,
          animationName,
        },
        className: inOutEffect.className,
      }
    } else {
      state = {
        hasAppeared: true,
        hasExited: false,
        style: { opacity: 1 },
      }
    }

    this.setState(
      props.collapse ? this.collapse(state, props, inOutEffect) : state
    )

    if (leaving) {
      this.savedChild = React.cloneElement(this.getChild())
      this.animationEnd(this.invisible, props.cascade, inOutEffect)
    } else {
      this.savedChild = false
    }

    this.onReveal(props)
  }

  onReveal(props) {
    if (props.onReveal && this.isOn) {
      if (this.onRevealTimeout) {
        this.onRevealTimeout = window.clearTimeout(this.onRevealTimeout)
      }

      props.wait
        ? (this.onRevealTimeout = window.setTimeout(props.onReveal, props.wait))
        : props.onReveal()
    }
  }

  componentWillUnmount() {
    this.unlisten()

    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    if (ssr) {
      disableSsr()
    }
  }

  handleObserve([entry], observer) {
    if (entry.intersectionRatio > 0) {
      observer.disconnect()
      this.observer = null
      this.reveal(this.props, true)
    }
  }

  observe(props, update = false) {
    if (!this.el) return

    if (observerMode) {
      if (this.observer) {
        if (update) {
          this.observer.disconnect()
        } else {
          return
        }
      } else if (update) {
        return
      }

      this.observer = new IntersectionObserver(this.handleObserve, {
        threshold: props.fraction,
      })
      this.observer.observe(this.el)
    }
  }

  reveal(props, inView = false) {
    if (!globalHide) hideAll()
    if (!this || !this.el) return

    if (!props) props = this.props
    if (ssr) disableSsr()

    if (this.isOn && this.isShown && props.spy !== undefined) {
      this.isShown = false
      this.setState({ style: {} })
      window.setTimeout(() => this.reveal(props), 200)
    } else if (inView || this.inViewport(props) || props.force) {
      this.animate(props)
    } else if (observerMode) {
      this.observe(props)
    } else {
      this.listen()
    }
  }

  componentDidMount() {
    if (!this.el || this.props.disabled) return

    if (!this.props.collapseOnly) {
      if ('make' in this.props.inEffect) {
        this.props.inEffect.make(false, this.props)
      }

      if (
        this.props.when !== undefined &&
        this.props.outEffect &&
        'make' in this.props.outEffect
      ) {
        this.props.outEffect.make(true, this.props)
      }
    }

    const appear = this.props.appear

    if (
      this.isOn &&
      (((this.props.when !== undefined || this.props.spy !== undefined) &&
        !appear) ||
        (ssr &&
          !fadeOutEnabled &&
          !this.props.ssrFadeout &&
          this.props.outEffect &&
          !this.props.ssrReveal &&
          RevealBase.getTop(this.el) < window.pageYOffset + window.innerHeight))
    ) {
      this.isShown = true
      this.setState({
        hasAppeared: true,
        collapse: this.props.collapse
          ? { height: this.getDimensionValue() }
          : this.state.collapse,
        style: { opacity: 1 },
      })
      this.onReveal(this.props)
      return
    }

    if (
      ssr &&
      (fadeOutEnabled || this.props.ssrFadeout) &&
      this.props.outEffect &&
      RevealBase.getTop(this.el) < window.pageYOffset + window.innerHeight
    ) {
      this.setState({
        style: { opacity: 0, transition: 'opacity 1000ms 1000ms' },
      })
      window.setTimeout(() => this.reveal(this.props, true), 2000)
      return
    }

    if (this.isOn) {
      this.props.force ? this.animate(this.props) : this.reveal(this.props)
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.when !== undefined) {
      this.isOn = !!this.props.when
    }

    if (this.props.fraction !== prevProps.fraction) {
      this.observe(this.props, true)
    }

    if (
      !this.isOn &&
      this.props.onExited &&
      'exit' in this.props &&
      this.props.exit === false
    ) {
      this.props.onExited()
      return
    }

    if (this.props.disabled) return

    if (this.props.collapse && !prevProps.collapse) {
      this.setState({
        style: {},
        collapse: RevealBase.getInitialCollapseStyle(this.props),
      })
      this.isShown = false
    }

    if (
      this.props.when !== prevProps.when ||
      this.props.spy !== prevProps.spy
    ) {
      this.reveal(this.props)
    }

    if (this.onRevealTimeout && !this.isOn) {
      this.onRevealTimeout = window.clearTimeout(this.onRevealTimeout)
    }
  }

  cascade(children) {
    let newChildren

    if (typeof children === 'string') {
      newChildren = children.split('').map((ch, index) => (
        <span
          key={index}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {ch}
        </span>
      ))
    } else {
      newChildren = React.Children.toArray(children)
    }

    let { duration, reverse } =
      this.props[this.isOn || !this.props.outEffect ? 'inEffect' : 'outEffect']

    const count = newChildren.length
    let total = duration * 2

    if (this.props.collapse) {
      total = parseInt(this.state.style.animationDuration, 10)
      duration = total / 2
    }

    let i = reverse ? count : 0

    return newChildren.map((child) =>
      typeof child === 'object' && child
        ? React.cloneElement(child, {
            style: {
              ...child.props.style,
              ...this.state.style,
              animationDuration:
                Math.round(
                  cascade(reverse ? i-- : i++, 0, count, duration, total)
                ) + 'ms',
            },
          })
        : child
    )
  }

  getChild() {
    if (this.savedChild && !this.props.disabled) return this.savedChild

    if (typeof this.props.children === 'object') {
      const child = React.Children.only(this.props.children)

      return ('type' in child && typeof child.type === 'string') ||
        this.props.refProp !== 'ref' ? (
        child
      ) : (
        <div>{child}</div>
      )
    }

    return <div>{this.props.children}</div>
  }

  render() {
    let mount

    if (!this.state.hasAppeared) {
      mount = !this.props.mountOnEnter || this.isOn
    } else {
      mount = !this.props.unmountOnExit || !this.state.hasExited || this.isOn
    }

    const child = this.getChild()

    this.childRef = child.props.ref

    const { style, className, children } = child.props

    const newClass = this.props.disabled
      ? className
      : `${this.props.outEffect ? namespace : ''}${
          this.state.className ? ' ' + this.state.className : ''
        }${className ? ' ' + className : ''}` || undefined

    let newChildren = false
    let newStyle

    if (typeof this.state.style.animationName === 'function') {
      const newState = this.state.style.animationName(!this.isOn, this.props)
      this.state.style.animationName = newState
    }

    if (
      this.props.cascade &&
      !this.props.disabled &&
      children &&
      this.state.style.animationName
    ) {
      newChildren = this.cascade(children)
      newStyle = { ...style, opacity: 1 }
    } else {
      newStyle = this.props.disabled ? style : { ...style, ...this.state.style }
    }

    const props = {
      ...this.props.props,
      className: newClass,
      style: newStyle,
      [this.props.refProp]: this.saveRef,
    }

    const el = React.cloneElement(
      child,
      props,
      mount ? newChildren || children : undefined
    )

    if (this.props.collapse !== undefined) {
      return this.props.collapseEl ? (
        React.cloneElement(this.props.collapseEl, {
          style: {
            ...this.props.collapseEl.style,
            ...(this.props.disabled ? undefined : this.state.collapse),
          },
          children: el,
        })
      ) : (
        <div style={this.props.disabled ? undefined : this.state.collapse}>
          {el}
        </div>
      )
    }

    return el
  }

  makeHandler(handler) {
    const update = () => {
      handler.call(this, this.props)
      this.ticking = false
    }

    return () => {
      if (!this.ticking) {
        raf(update)
        this.ticking = true
      }
    }
  }

  resize(props) {
    if (!this || !this.el || !this.isOn) return

    if (this.inViewport(props)) {
      this.unlisten()
      this.isShown = this.isOn
      this.setState({
        hasExited: !this.isOn,
        hasAppeared: true,
        collapse: undefined,
        style: { opacity: this.isOn || !props.outEffect ? 1 : 0 },
      })
      this.onReveal(props)
    }
  }

  listen() {
    if (!observerMode && !this.isListener) {
      this.isListener = true
      window.addEventListener('scroll', this.revealHandler, { passive: true })
      window.addEventListener('orientationchange', this.revealHandler, {
        passive: true,
      })
      window.document.addEventListener('visibilitychange', this.revealHandler, {
        passive: true,
      })
      window.document.addEventListener('collapseend', this.revealHandler, {
        passive: true,
      })
      window.addEventListener('resize', this.resizeHandler, { passive: true })
    }
  }

  unlisten() {
    if (!observerMode && this.isListener) {
      window.removeEventListener('scroll', this.revealHandler)
      window.removeEventListener('orientationchange', this.revealHandler)
      window.document.removeEventListener(
        'visibilitychange',
        this.revealHandler
      )
      window.document.removeEventListener('collapseend', this.revealHandler)
      window.removeEventListener('resize', this.resizeHandler)
      this.isListener = false
    }

    if (this.onRevealTimeout) {
      this.onRevealTimeout = window.clearTimeout(this.onRevealTimeout)
    }

    if (this.animationEndTimeout) {
      this.animationEndTimeout = window.clearTimeout(this.animationEndTimeout)
    }
  }

  inViewport(props) {
    if (!this.el || window.document.hidden) return false

    const height = this.el.offsetHeight
    const delta = window.pageYOffset - RevealBase.getTop(this.el)
    const tail =
      Math.min(height, window.innerHeight) * (globalHide ? props.fraction : 0)

    return delta > tail - window.innerHeight && delta < height - tail
  }

  static getInitialCollapseStyle(props) {
    return {
      height: 0,
      visibility: props.when ? undefined : 'hidden',
    }
  }

  static getTop(el) {
    while (el.offsetTop === undefined) {
      el = el.parentNode
    }

    let top = el.offsetTop

    for (; el.offsetParent; top += el.offsetTop) {
      el = el.offsetParent
    }

    return top
  }
}

RevealBase.propTypes = propTypes
RevealBase.defaultProps = defaultProps
RevealBase.displayName = 'RevealBase'

export default RevealBase
