// src/shared/components/ParticleField/ParticleField.jsx
// Amoeba-shaped radial mesh of dashes / streaks with wave-crawl.
// Cursor-centred, irregular organic border, theme and mode aware.
// Portalled into document.body.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ParticleField.css'

// ── Per-theme palettes ────────────────────────────────────────────────────
const DEFAULT_THEMES = {
  'pure-bold': ['#ffd300', '#ffdc0d', '#ffe647', '#fff28a', '#e6be00'],
  techy: ['#ffd300', '#ffdc0d', '#ffe647', '#fff28a', '#e6be00'],
  friendly: ['#FF6B35', '#FF8C5A', '#FFD166', '#FFAA80'],
  corporate: ['#6C63FF', '#7C74FF', '#A098FF', '#B0A8FF'],
  playful: ['#FF4DAF', '#B44FFF', '#FF8AD0', '#D490FF'],
  trailblazer: ['#ffd300', '#ffdc0d', '#ffe647', '#fff28a', '#e6be00'],
  monochrome: ['#FFFFFF', '#D0D0D0', '#B0B0B0', '#E8E8E8']
}

// Monochrome light-mode override — dark particles on light background
const MONOCHROME_LIGHT = ['#000000', '#1A1A1A', '#333333', '#4A4A4A']

const RING_SPACING = 44
const ARC_SPACING = 44
const VOID_RADIUS = 55
const WAVE_AMP = 12
const WAVE_SPEED = 2.2
const WAVE_RING_PHASE = 0.6
const WAVE_DOT_PHASE = 0.15

// Amoeba contour — controls how far rings extend at each angle
const AMOEBA_BASE = 550 // px — base radius of the amoeba blob
const AMOEBA_LOBES = [
  // overlapping sine lobes for irregular border
  { freq: 2, amp: 80, speed: 0.3 }, // broad 2-lobe wobble
  { freq: 3, amp: 55, speed: -0.4 }, // 3-lobe counter-rotating
  { freq: 5, amp: 35, speed: 0.55 }, // 5-lobe detail
  { freq: 7, amp: 20, speed: -0.7 }, // high-freq ripple
  { freq: 11, amp: 12, speed: 0.9 } // fine organic noise
]

// ── Helpers ───────────────────────────────────────────────────────────────
function pickColor(colors) {
  return colors[Math.floor(Math.random() * colors.length)]
}

// Calculate the amoeba contour radius at a given angle and time
function amoebaRadius(angle, t) {
  let r = AMOEBA_BASE
  for (const lobe of AMOEBA_LOBES) {
    r += lobe.amp * Math.sin(angle * lobe.freq + t * lobe.speed)
  }
  return r
}

// Irregular breathing pulse — different angular regions expand/contract
// at different rates and amplitudes, like a living organism
const BREATH_LOBES = [
  { freq: 1, amp: 0.08, speed: 0.6 }, // global slow pulse
  { freq: 2, amp: 0.06, speed: -0.9 }, // 2-lobe asymmetry
  { freq: 3, amp: 0.05, speed: 1.1 }, // 3-region irregular
  { freq: 5, amp: 0.03, speed: -1.4 } // fine detail
]

function breathAtAngle(angle, t) {
  // Returns a multiplier ~0.78 – 1.22 that varies by angle and time
  let scale = 1.0
  for (const lobe of BREATH_LOBES) {
    scale += lobe.amp * Math.sin(angle * lobe.freq + t * lobe.speed)
  }
  return scale
}

// Build ring definitions
function buildRings(W, H, colors) {
  const maxR = Math.sqrt((W / 2) ** 2 + (H / 2) ** 2) + RING_SPACING
  const particles = []
  let ringIdx = 0

  for (let r = VOID_RADIUS + RING_SPACING; r <= maxR; r += RING_SPACING) {
    const count = Math.max(6, Math.round((2 * Math.PI * r) / ARC_SPACING))
    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2
      particles.push({
        ringIdx,
        dotIdx: i,
        baseRadius: r,
        baseAngle,
        x: W / 2 + Math.cos(baseAngle) * r,
        y: H / 2 + Math.sin(baseAngle) * r,
        _cx: W / 2,
        _cy: H / 2,
        phaseOffset: Math.random() * Math.PI * 2,
        pulseSpeed: 0.4 + Math.random() * 0.5,
        // Dash dimensions
        dashLen: Math.random() * 5 + 4, // 4 – 9px length
        dashThick: Math.random() * 1.5 + 1.0, // 1 – 2.5px thickness
        color: pickColor(colors)
      })
    }
    ringIdx++
  }
  return { particles, ringCount: ringIdx }
}

// ── Component ─────────────────────────────────────────────────────────────
export function ParticleField({ themes = DEFAULT_THEMES, className = '' }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)
  const canvasRef = useRef(null)
  const mouseRef = useRef({ x: -999, y: -999 })

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (isMobile) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let rafId

    let W = 0,
      H = 0
    let data = { particles: [], ringCount: 0 }
    let colors = []

    function reinitColors() {
      const html = document.documentElement
      const theme = html.dataset.theme || 'pure-bold'
      const mode = html.classList.contains('dark') ? 'dark' : 'light'
      if (theme === 'monochrome' && mode === 'light') {
        colors = MONOCHROME_LIGHT
      } else {
        colors = themes[theme] ?? themes['pure-bold'] ?? DEFAULT_THEMES['pure-bold']
      }
      data.particles.forEach((p) => {
        p.color = pickColor(colors)
      })
    }
    reinitColors()

    function sizeCanvas() {
      const rect = canvas.getBoundingClientRect()
      W = rect.width
      H = rect.height
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    sizeCanvas()

    data = buildRings(W, H, colors)

    const START = performance.now()

    function tick() {
      const t = (performance.now() - START) / 1000
      ctx.clearRect(0, 0, W, H)

      const mouse = mouseRef.current
      const hasCursor = mouse.x > -900
      const targetCX = hasCursor ? mouse.x : W / 2
      const targetCY = hasCursor ? mouse.y : H / 2

      // Dark mode
      const isDark = document.documentElement.classList.contains('dark')
      const alphaBoost = isDark ? 0.1 : 0

      // Global breathe
      const breathe = 0.75 + 0.25 * Math.sin(t * 0.8)

      // ── Blob centre + movement tracking ────────────────────────────────
      if (!data._blobCX) {
        data._blobCX = W / 2
        data._blobCY = H / 2
        data._velX = 0
        data._velY = 0
      }

      const prevCX = data._blobCX
      const prevCY = data._blobCY

      data._blobCX += (targetCX - data._blobCX) * 0.06
      data._blobCY += (targetCY - data._blobCY) * 0.06
      const bCX = data._blobCX
      const bCY = data._blobCY

      // Smoothed velocity for directional deformation
      const rawVX = bCX - prevCX
      const rawVY = bCY - prevCY
      data._velX += (rawVX - data._velX) * 0.15
      data._velY += (rawVY - data._velY) * 0.15
      const velX = data._velX
      const velY = data._velY
      const speed = Math.sqrt(velX * velX + velY * velY)
      // Normalised movement direction (safe when speed ≈ 0)
      const dirX = speed > 0.01 ? velX / speed : 0
      const dirY = speed > 0.01 ? velY / speed : 0

      // Squash/stretch intensity — scales with speed, caps at 0.35
      const deformAmt = Math.min(0.35, speed * 12)

      data.particles.forEach((p) => {
        // ── Per-ring viscosity: outer rings lag behind like fluid ─────────
        // Each particle tracks its own centre that chases the blob centre.
        // Inner rings follow fast; outer rings drag — creates gooey inertia.
        if (p._pcx === undefined) {
          p._pcx = bCX
          p._pcy = bCY
        }
        const ringLerp = 0.12 / (1 + p.ringIdx * 0.18)
        p._pcx += (bCX - p._pcx) * ringLerp
        p._pcy += (bCY - p._pcy) * ringLerp

        // ── Wave-crawl modulation (organic surface undulation) ───────────
        const wave =
          Math.sin(t * WAVE_SPEED - p.ringIdx * WAVE_RING_PHASE - p.dotIdx * WAVE_DOT_PHASE) *
          WAVE_AMP *
          breathe

        // ── Irregular breathing: per-angle expand/contract ───────────────
        const localBreath = breathAtAngle(p.baseAngle, t)

        // ── Directional squash/stretch deformation ───────────────────────
        // Dot product of particle's radial direction with movement direction:
        //   +1 = facing movement (front) → compress radius
        //   -1 = opposite (back) → stretch radius
        //    0 = perpendicular (sides) → no change
        const pDirX = Math.cos(p.baseAngle)
        const pDirY = Math.sin(p.baseAngle)
        const facing = pDirX * dirX + pDirY * dirY // dot product, -1 to +1

        // Front compresses (1 - deform), back stretches (1 + deform)
        const deform = 1.0 - facing * deformAmt

        const effectiveR = (p.baseRadius + wave) * localBreath * deform

        // ── Target = per-ring viscous centre + deformed ring slot ─────────
        const targetX = p._pcx + Math.cos(p.baseAngle) * effectiveR
        const targetY = p._pcy + Math.sin(p.baseAngle) * effectiveR

        // Smooth glide to target
        p.x += (targetX - p.x) * 0.08
        p.y += (targetY - p.y) * 0.08

        // ── Amoeba contour clipping (also breathes irregularly) ──────────
        const amoebaR = amoebaRadius(p.baseAngle, t) * breathe * localBreath
        const distFromCX = Math.sqrt((p.x - p._pcx) ** 2 + (p.y - p._pcy) ** 2)

        // Fade at the very outer edge only — 50px soft border
        const edgeFade = 1 - Math.max(0, Math.min(1, (distFromCX - amoebaR + 50) / 50))
        if (edgeFade <= 0.01) return

        // ── Per-particle pulse ──────────────────────────────────────────
        const pulse = Math.sin(t * p.pulseSpeed + p.phaseOffset) * 0.5 + 0.5

        // ── Alpha: high baseline, outer particles extra vivid ───────────
        const radialBoost = Math.min(1, distFromCX / (AMOEBA_BASE * 0.4))
        const baseAlpha = 0.6 + 0.2 * pulse + 0.2 * radialBoost + alphaBoost
        const alpha = Math.min(1, Math.max(0.55, baseAlpha) * edgeFade)

        // ── Dash size: outer particles are bigger and bolder ────────────
        const outerScale = 1.0 + radialBoost * 0.6 // inner 1× → outer 1.6×
        const len = p.dashLen * (0.8 + pulse * 0.2) * breathe * outerScale
        const thick = p.dashThick * (0.8 + pulse * 0.2) * breathe * outerScale

        // ── Orientation: radial (pointing toward/away from centre) ──────
        const spokeAngle = Math.atan2(p.y - p._pcy, p.x - p._pcx)

        // ── Shape: dots at inner (first 4 rings) / outer edges, streaks in middle
        const radialFrac = amoebaR > 0 ? distFromCX / amoebaR : 0
        const isInnerDot = p.ringIdx < 4
        const isOuterDot = radialFrac > 0.8
        const isDot = isInnerDot || isOuterDot

        // Dots are more faded and smaller than streaks
        const dotAlpha = alpha * 0.7
        const dotSizeMul = 0.6

        ctx.globalAlpha = Math.max(0, isDot ? dotAlpha : alpha)
        ctx.fillStyle = p.color

        if (isDot) {
          // ── Draw circle dot — smaller and softer ───────────────────────
          const dotR = thick * outerScale * dotSizeMul
          ctx.beginPath()
          ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // ── Draw streak (rounded-end rectangle) ────────────────────────
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(spokeAngle)
          const halfLen = len / 2
          const halfT = thick / 2
          ctx.beginPath()
          ctx.moveTo(-halfLen, -halfT)
          ctx.lineTo(halfLen, -halfT)
          ctx.arc(halfLen, 0, halfT, -Math.PI / 2, Math.PI / 2)
          ctx.lineTo(-halfLen, halfT)
          ctx.arc(-halfLen, 0, halfT, Math.PI / 2, -Math.PI / 2)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      })

      ctx.globalAlpha = 1
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    const ro = new ResizeObserver(() => {
      sizeCanvas()
      data = buildRings(W, H, colors)
    })
    ro.observe(canvas)

    const mo = new MutationObserver(() => reinitColors())
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-mode', 'class']
    })

    function onMouseMove(e) {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    function onMouseLeave() {
      mouseRef.current = { x: -999, y: -999 }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [themes, isMobile])

  if (isMobile) return null

  return createPortal(
    <canvas
      ref={canvasRef}
      className={`particle-field-canvas${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />,
    document.body
  )
}
