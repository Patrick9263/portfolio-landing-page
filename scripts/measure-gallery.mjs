// Run after npm run build. Cold Chromium contexts; no external services required.
import fs from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import sharp from 'sharp'

const server = await preview({
  preview: { host: '127.0.0.1', port: 4288, strictPort: true },
})
const browser = await chromium.launch()
const base = 'http://127.0.0.1:4288'
const manifest = JSON.parse(await fs.readFile('src/data/photos.json', 'utf8'))
const photos = manifest.sections.flatMap((s) =>
  s.albums.flatMap((a) => a.photos)
)
const sizes = async (urls) => {
  const files = await Promise.all(
    [...new Set(urls)].map((url) => fs.readFile(path.join('dist', url)))
  )
  return {
    bytes: files.reduce((n, b) => n + b.length, 0),
    gzipBytes: files.reduce((n, b) => n + gzipSync(b).length, 0),
  }
}
const manifestBytes = Buffer.from(JSON.stringify(manifest))
const report = {
  manifest: {
    bytes: manifestBytes.length,
    gzipBytes: gzipSync(manifestBytes).length,
  },
  node: process.version,
  photos: photos.length,
  assets: {},
  visits: [],
}
try {
  for (const [name, urls] of Object.entries({
    thumbs: photos.map((p) => p.src),
    full: photos.map((p) => p.fullSrc),
    variants: photos.flatMap((p) => (p.srcSet || []).map((v) => v.src)),
  })) {
    report.assets[name] = (await sizes(urls)).bytes
  }
  report.dimensions = await Promise.all(
    [
      photos.find((p) => p.width > p.height && p.width / p.height < 2),
      photos.find((p) => p.height > p.width),
      photos.reduce((a, b) =>
        a.width / a.height > b.width / b.height ? a : b
      ),
    ].map(async (p) => ({
      id: p.id,
      full: [p.width, p.height],
      thumb: await sharp(path.join('public', p.src))
        .metadata()
        .then((m) => [m.width, m.height]),
    }))
  )
  for (const profile of [
    { name: 'phone', width: 390, height: 844, dpr: 1 },
    { name: 'tablet', width: 820, height: 1180, dpr: 1 },
    { name: 'desktop', width: 1440, height: 1000, dpr: 1 },
    { name: 'high-dpi', width: 390, height: 844, dpr: 3 },
  ]) {
    for (const route of ['/', '/?photos=true']) {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: profile.dpr,
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      await page.route('**/*', (r) =>
        r.request().url().startsWith(base) ? r.continue() : r.abort()
      )
      await page.goto(base + route, { waitUntil: 'networkidle' })
      const resources = () =>
        page.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .filter((r) => r.name.startsWith(location.origin))
            .map((r) => ({
              url: new URL(r.name).pathname,
              bytes: r.encodedBodySize,
              transferBytes: r.transferSize,
              type: r.initiatorType,
            }))
        )
      const summarize = (entries) => ({
        requests: entries.length,
        bodyBytes: entries.reduce((n, r) => n + r.bytes, 0),
        transferBytes: entries.reduce((n, r) => n + r.transferBytes, 0),
        urls: entries.map((r) => r.url),
      })
      const initial = await resources()
      const js = initial.filter((r) => r.url.endsWith('.js')).map((r) => r.url)
      const visit = {
        profile,
        route,
        javascript: await sizes(js),
        javascriptUrls: js,
        initialImages: summarize(initial.filter((r) => r.type === 'img')),
      }
      if (route !== '/') {
        // Visit each image rather than relying on timing-dependent scrolling increments.
        for (const img of await page.locator('.photo-album-grid img').all()) {
          await img.scrollIntoViewIfNeeded()
          await img.evaluate((i) => i.decode())
        }
        await page.waitForLoadState('networkidle')
        const before = await resources()
        visit.allGalleryImages = summarize(
          before.filter((r) => r.type === 'img')
        )
        visit.fullBeforeLightbox = before.filter((r) =>
          r.url.startsWith('/photos/full/')
        ).length
        visit.selections = await page
          .locator('.photo-album-grid img')
          .evaluateAll((imgs) =>
            imgs.map((i) => ({
              src: new URL(i.currentSrc).pathname,
              width: i.getBoundingClientRect().width,
            }))
          )
        await page.locator('.photo-opener').first().click()
        await page
          .locator('.photo-lightbox-content img')
          .evaluate((i) => i.decode())
        visit.lightboxImages = summarize(
          (await resources()).filter((r) => r.url.startsWith('/photos/full/'))
        )
      }
      report.visits.push(visit)
      await context.close()
    }
  }
  const homepage = report.visits.find((v) => v.route === '/')
  const gallery = report.visits.find((v) => v.route !== '/')
  report.galleryOnlyJavascript = await sizes(
    gallery.javascriptUrls.filter(
      (url) => !homepage.javascriptUrls.includes(url)
    )
  )
  const output = process.argv[2]
  if (output) await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n')
  else process.stdout.write(JSON.stringify(report, null, 2) + '\n')
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
