import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'

const manifest = JSON.parse(
  await fs.readFile(
    new URL('../../src/data/photos.json', import.meta.url),
    'utf8'
  )
)
const photos = manifest.sections.flatMap((s) =>
  s.albums.flatMap((a) => a.photos)
)
const galleryChunk = /\/assets\/PhotosPage-[^/]+\.js$/

test('homepage excludes gallery code, data, styles and images; teaser and history work', async ({
  page,
}) => {
  const requests = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/')
  await expect(
    page.getByRole('link', { name: 'Open gallery' })
  ).toHaveAttribute('href', '/?photos=true')
  expect(
    requests.some(
      (url) =>
        galleryChunk.test(url) ||
        url.includes('/photos/') ||
        /PhotosPage-.*\.css$/.test(url)
    )
  ).toBe(false)
  // Inspect served entry bytes as well as network requests: manifest/library must
  // not merely be bundled under a different filename.
  for (const url of requests.filter((url) => url.endsWith('.js'))) {
    const code = await (await page.request.get(url)).text()
    expect(code).not.toContain(photos[0].fullSrc)
    expect(code).not.toContain('react-photo-album--')
  }
  await page.getByRole('link', { name: 'Open gallery' }).click()
  await expect(page.locator('.photo-opener')).toHaveCount(50)
  expect(requests.some((url) => galleryChunk.test(url))).toBe(true)
  await page.goBack()
  await expect(page.getByRole('link', { name: 'Open gallery' })).toBeVisible()
  await page.goForward()
  await expect(page.locator('.photo-opener')).toHaveCount(50)
})

test('slow gallery chunk shows an accessible loading state', async ({
  page,
}) => {
  let release
  const held = new Promise((resolve) => {
    release = resolve
  })
  await page.route(galleryChunk, async (route) => {
    await held
    await route.continue()
  })
  await page.goto('/?photos=true', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('status')).toHaveText('Loading gallery…')
  await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  await expect(
    page.getByRole('link', { name: 'Return to portfolio' })
  ).toBeVisible()
  release()
  await expect(page.locator('.photo-opener')).toHaveCount(50)
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('failed gallery chunk offers a working reload and homepage exit', async ({
  page,
}) => {
  await page.route(galleryChunk, (route) => route.abort())
  await page.goto('/?photos=true')
  await expect(page.getByRole('alert')).toHaveText(
    'The gallery could not load. Please try again.'
  )
  await expect(
    page.getByRole('link', { name: 'Return to portfolio' })
  ).toHaveAttribute('href', '/')
  const reload = page.getByRole('button', { name: 'Reload gallery' })
  await reload.focus()
  await expect(reload).toBeFocused()
  await page.unroute(galleryChunk)
  await reload.press('Enter')
  await expect(page.locator('.photo-opener')).toHaveCount(50)
})

const profiles = [
  { name: 'narrow phone', width: 320, height: 740, dpr: 1 },
  { name: 'phone', width: 390, height: 844, dpr: 1 },
  { name: 'tablet', width: 820, height: 1180, dpr: 1 },
  { name: 'intermediate', width: 1100, height: 900, dpr: 1 },
  { name: 'desktop', width: 1440, height: 1000, dpr: 1 },
  { name: 'wide desktop', width: 1600, height: 1000, dpr: 1 },
  { name: 'high-DPI phone', width: 390, height: 844, dpr: 3 },
]
for (const profile of profiles) {
  test(`responsive selection and deferred full images at ${profile.name}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.dpr,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    const requests = []
    page.on('request', (r) => requests.push(r.url()))
    try {
      await page.goto('http://127.0.0.1:4173/?photos=true')
      await expect(page.locator('.photo-opener')).toHaveCount(50)
      for (const photo of [
        photos.find((p) => p.height > p.width),
        photos.find((p) => p.width > p.height && p.width / p.height < 2),
        photos.find((p) => p.width / p.height > 2),
      ]) {
        const img = page.locator(`.photo-album-grid img[src="${photo.src}"]`)
        await img.scrollIntoViewIfNeeded()
        await img.evaluate((i) => i.decode())
        const selected = await img.evaluate((i) => ({
          url: new URL(i.currentSrc).pathname,
          width: i.getBoundingClientRect().width,
          srcset: i.srcset,
          sizes: i.sizes,
          loading: i.loading,
          decoding: i.decoding,
        }))
        const candidate = photo.srcSet.find((v) => v.src === selected.url)
        expect(candidate).toBeTruthy()
        expect(candidate.width).toBeLessThan(photo.width)
        // Chromium may choose a slightly smaller candidate near a density
        // boundary, but must neither exaggerate descriptors nor request full.
        expect(candidate.width).toBeGreaterThanOrEqual(
          Math.min(
            selected.width * profile.dpr * 0.8,
            photo.srcSet.at(-1).width
          )
        )
        expect(selected.srcset).not.toContain('/photos/full/')
        expect(selected.srcset).not.toContain('/photos/thumbs/')
        expect(selected.sizes).toContain('calc(')
        expect(selected.loading).toBe('lazy')
        expect(selected.decoding).toBe('async')
      }
      expect(requests.some((url) => url.includes('/photos/full/'))).toBe(false)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      const opener = page.locator('.photo-opener').first()
      await opener.focus()
      await opener.press('Enter')
      await page
        .locator('.photo-lightbox-content img')
        .evaluate((i) => i.decode())
      expect(
        requests.filter((url) => url.includes('/photos/full/'))
      ).toHaveLength(1)
      await page.keyboard.press('Escape')
      await expect(opener).toBeFocused()
    } finally {
      await context.close()
    }
  })
}
