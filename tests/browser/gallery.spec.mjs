import { expect, test } from '@playwright/test'
import fs from 'node:fs'

const productionManifest = JSON.parse(
  fs.readFileSync(
    new URL('../../src/data/photos.json', import.meta.url),
    'utf8'
  )
)
const productionPhotos = productionManifest.sections.flatMap((section) =>
  section.albums.flatMap((album) => album.photos)
)

const fixtureImagePath = (id, variant) =>
  `/__gallery-test-assets__/${id}-${variant}.svg`

const makePhoto = (id, title = `Photo ${id}`) => ({
  id,
  src: fixtureImagePath(id, 'thumb'),
  fullSrc: fixtureImagePath(id, 'full'),
  width: 160,
  height: 120,
  title,
  alt: title,
})

const makeAlbum = (id, title, photoIds) => ({
  id,
  title,
  photos: photoIds.map((photoId) => makePhoto(photoId)),
})

const makeManifest = (sections) => ({
  schemaVersion: 2,
  sections,
})

const interactionManifest = makeManifest([
  {
    id: 'current',
    title: 'Current',
    albums: [makeAlbum('current', null, ['one', 'two', 'three'])],
  },
])

const syntheticImage = (requestUrl) => {
  const label = requestUrl.split('/').at(-1)
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="120">
      <rect width="160" height="120" fill="#31516f" />
      <text x="8" y="64" fill="white" font-size="10">${label}</text>
    </svg>
  `
}

const openGalleryWithFixture = async (page, manifest) => {
  await page.route('**/__gallery-test-assets__/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: syntheticImage(route.request().url()),
    })
  })
  await page.addInitScript((fixtureManifest) => {
    window.__PORTFOLIO_GALLERY_TEST_MANIFEST__ = fixtureManifest
  }, manifest)

  const response = await page.goto('/?photos=true', {
    waitUntil: 'domcontentloaded',
  })

  expect(response?.ok()).toBe(true)
  await expect(
    page.getByRole('heading', { name: 'Photos', exact: true })
  ).toBeVisible()
}

const expectSelectedPhoto = async (page, name) => {
  await expect(page.locator('.photo-lightbox-content img')).toHaveAttribute(
    'alt',
    name
  )
}

const expectBodyScroll = async (page, value) => {
  await expect
    .poll(() => page.locator('body').evaluate((body) => body.style.overflow))
    .toBe(value)
}

const expectControlInViewport = async (control, viewport) => {
  await expect(control).toBeVisible()
  const box = await control.boundingBox()

  expect(box).not.toBeNull()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
}

test('the built portfolio renders at the root URL', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' })

  expect(response?.ok()).toBe(true)
  await expect(page.locator('.App')).toBeVisible()
  await expect(page.locator('.photos-page')).toHaveCount(0)
})

test('the built gallery renders all 50 committed photos and assets', async ({
  page,
}) => {
  const requestedUrls = []
  page.on('request', (request) => requestedUrls.push(request.url()))

  const response = await page.goto('/?photos=true', {
    waitUntil: 'domcontentloaded',
  })

  expect(response?.ok()).toBe(true)
  await expect(page.getByText('No photos available yet.')).toHaveCount(0)
  await expect(page.locator('.photo-section')).toHaveCount(1)
  await expect(page.locator('.photo-section-header h3')).toHaveText('Current')
  await expect(page.locator('.photo-album-section')).toHaveCount(1)
  await expect(page.locator('.photo-album-header h4')).toHaveCount(0)
  await expect(page.locator('.photo-album-header p')).toHaveText('50 photos')

  const thumbnails = page.locator('.photo-album-grid img')
  await expect(thumbnails).toHaveCount(50)
  const thumbnailPaths = await thumbnails.evaluateAll((images) =>
    images.map((image) => image.getAttribute('src'))
  )

  expect(new Set(thumbnailPaths).size).toBe(50)
  expect(thumbnailPaths).toEqual(productionPhotos.map((photo) => photo.src))
  const committedAssetPaths = productionPhotos.flatMap((photo) => [
    photo.src,
    photo.fullSrc,
  ])
  const assetResults = await page.evaluate(async (paths) => {
    return Promise.all(
      paths.map(async (path) => {
        const assetResponse = await fetch(path)
        const bytes = await assetResponse.arrayBuffer()
        return {
          path,
          ok: assetResponse.ok,
          size: bytes.byteLength,
        }
      })
    )
  }, committedAssetPaths)

  expect(assetResults).toHaveLength(100)
  expect(assetResults.every((asset) => asset.ok && asset.size > 0)).toBe(true)

  await thumbnails.first().click()
  const fullImage = page.locator('.photo-lightbox-content img')
  await expect(fullImage).toBeVisible()
  await expect
    .poll(() => fullImage.evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0)
  expect(requestedUrls.some((url) => url.includes('photos-source'))).toBe(false)
})

test('renders isolated multi-section, multi-album, year, and non-year data', async ({
  page,
}) => {
  const manifest = makeManifest([
    {
      id: 'current',
      title: 'Current',
      albums: [
        makeAlbum('featured', 'Featured', ['current-one']),
        makeAlbum('shared', 'Another album', ['current-two']),
      ],
    },
    {
      id: '2025',
      title: '2025',
      albums: [
        makeAlbum('shared', 'Winter trip', ['winter-one', 'winter-two']),
      ],
    },
  ])

  await openGalleryWithFixture(page, manifest)

  await expect(page.locator('.photo-section-header h3')).toHaveText([
    'Current',
    '2025',
  ])
  await expect(page.locator('.photo-album-header h4')).toHaveText([
    'Featured',
    'Another album',
    'Winter trip',
  ])
  await expect(page.locator('.photo-album-header p')).toHaveText([
    '1 photo',
    '1 photo',
    '2 photos',
  ])
  await expect(page.locator('.photo-album-grid img')).toHaveCount(4)
})

test('renders the intentional empty-gallery state', async ({ page }) => {
  await openGalleryWithFixture(
    page,
    makeManifest([
      {
        id: 'empty-section',
        title: 'Empty section',
        albums: [{ id: 'empty-album', title: null, photos: [] }],
      },
    ])
  )

  await expect(page.getByText('No photos available yet.')).toBeVisible()
  await expect(page.locator('.photo-section')).toHaveCount(0)
})

test('renders and opens a one-photo album without navigation controls', async ({
  page,
}) => {
  await openGalleryWithFixture(
    page,
    makeManifest([
      {
        id: 'single-section',
        title: 'Single section',
        albums: [makeAlbum('single-album', 'Single album', ['only'])],
      },
    ])
  )

  await expect(page.locator('.photo-album-header p')).toHaveText('1 photo')
  const opener = page.getByRole('button', { name: 'Open Photo only' })
  await opener.focus()
  await page.keyboard.press('Enter')
  await expectSelectedPhoto(page, 'Photo only')
  await expect(
    page.getByRole('button', { name: 'Previous photo' })
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next photo' })).toHaveCount(0)

  const close = page.getByRole('button', { name: 'Close photo' })
  await expect(close).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
})

test('keyboard and button navigation wrap within the active album', async ({
  page,
}) => {
  await openGalleryWithFixture(page, interactionManifest)
  await page.locator('.photo-album-grid img').first().click()

  await expectSelectedPhoto(page, 'Photo one')
  await page.keyboard.press('ArrowLeft')
  await expectSelectedPhoto(page, 'Photo three')
  await page.keyboard.press('ArrowRight')
  await expectSelectedPhoto(page, 'Photo one')

  await page.getByRole('button', { name: 'Next photo' }).click()
  await expectSelectedPhoto(page, 'Photo two')
  await page.getByRole('button', { name: 'Previous photo' }).click()
  await expectSelectedPhoto(page, 'Photo one')
  await page.getByRole('button', { name: 'Previous photo' }).click()
  await expectSelectedPhoto(page, 'Photo three')
  await page.getByRole('button', { name: 'Next photo' }).click()
  await expectSelectedPhoto(page, 'Photo one')
})

test('Escape, backdrop, and repeated close cycles restore scroll state', async ({
  page,
}) => {
  await openGalleryWithFixture(page, interactionManifest)
  const firstThumbnail = page.getByRole('button', { name: 'Open Photo one' })
  const dialog = page.getByRole('dialog')

  await firstThumbnail.click()
  await expect(dialog).toBeVisible()
  await expectBodyScroll(page, 'hidden')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expectBodyScroll(page, '')
  await expect(firstThumbnail).toBeFocused()

  await firstThumbnail.click()
  await expect(dialog).toBeVisible()
  await expectBodyScroll(page, 'hidden')
  await page
    .locator('.photo-lightbox-backdrop')
    .click({ position: { x: 8, y: 8 } })
  await expect(dialog).toHaveCount(0)
  await expectBodyScroll(page, '')
  await expect(firstThumbnail).toBeFocused()

  await firstThumbnail.click()
  await expect(dialog).toBeVisible()
  await expectBodyScroll(page, 'hidden')
  await page.locator('.photo-lightbox-close').click()
  await expect(dialog).toHaveCount(0)
  await expectBodyScroll(page, '')
  await expect(firstThumbnail).toBeFocused()
})

const viewports = [
  { name: 'desktop', width: 1600, height: 900 },
  { name: 'intermediate', width: 1100, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]

for (const viewport of viewports) {
  test(`lightbox controls remain usable at the ${viewport.name} viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await openGalleryWithFixture(page, interactionManifest)
    await page.locator('.photo-album-grid img').first().click()

    const previous = page.getByRole('button', { name: 'Previous photo' })
    const next = page.getByRole('button', { name: 'Next photo' })
    const close = page.locator('.photo-lightbox-close')

    await expectControlInViewport(previous, viewport)
    await expectControlInViewport(next, viewport)
    await expectControlInViewport(close, viewport)

    await next.click()
    await expectSelectedPhoto(page, 'Photo two')
    await previous.click()
    await expectSelectedPhoto(page, 'Photo one')
    await close.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expectBodyScroll(page, '')
  })
}

const duplicatePhoto = makePhoto('duplicate')
const invalidManifests = [
  {
    name: 'duplicate section IDs',
    manifest: makeManifest([
      {
        id: 'same',
        title: 'First',
        albums: [makeAlbum('first', null, ['one'])],
      },
      {
        id: 'same',
        title: 'Second',
        albums: [makeAlbum('second', null, ['two'])],
      },
    ]),
  },
  {
    name: 'duplicate album IDs inside one section',
    manifest: makeManifest([
      {
        id: 'section',
        title: 'Section',
        albums: [
          makeAlbum('same', 'First', ['one']),
          makeAlbum('same', 'Second', ['two']),
        ],
      },
    ]),
  },
  {
    name: 'duplicate photo IDs inside one album',
    manifest: makeManifest([
      {
        id: 'section',
        title: 'Section',
        albums: [
          {
            id: 'album',
            title: null,
            photos: [
              duplicatePhoto,
              {
                ...duplicatePhoto,
                src: fixtureImagePath('duplicate-two', 'thumb'),
                fullSrc: fixtureImagePath('duplicate-two', 'full'),
              },
            ],
          },
        ],
      },
    ]),
  },
  {
    name: 'a missing schema version',
    manifest: { sections: [] },
  },
  {
    name: 'a section without albums',
    manifest: makeManifest([
      {
        id: 'incomplete',
        title: 'Incomplete',
      },
    ]),
  },
  {
    name: 'an incomplete photo record',
    manifest: makeManifest([
      {
        id: 'section',
        title: 'Section',
        albums: [
          {
            id: 'album',
            title: null,
            photos: [
              {
                id: 'incomplete',
                src: fixtureImagePath('incomplete', 'thumb'),
                width: 160,
                height: 120,
              },
            ],
          },
        ],
      },
    ]),
  },
]

for (const { name, manifest } of invalidManifests) {
  test(`fails closed at the renderer boundary for ${name}`, async ({
    page,
  }) => {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await openGalleryWithFixture(page, manifest)

    await expect(page.getByText('No photos available yet.')).toBeVisible()
    await expect(page.locator('.photo-section')).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })
}

test.describe('gallery keyboard accessibility', () => {
  test('photo buttons follow manifest order and open with Enter and Space', async ({
    page,
  }) => {
    await openGalleryWithFixture(page, interactionManifest)
    const homeLink = page.getByRole('link', { name: 'HOME' })
    const firstOpener = page.getByRole('button', { name: 'Open Photo one' })
    const secondOpener = page.getByRole('button', { name: 'Open Photo two' })
    const lastOpener = page.getByRole('button', { name: 'Open Photo three' })

    await homeLink.focus()
    await page.keyboard.press('Tab')
    await expect(firstOpener).toBeFocused()
    await expect(firstOpener).toHaveCSS('outline-style', 'solid')
    await expect(firstOpener).toHaveCSS('outline-width', '4px')
    await page.keyboard.press('Tab')
    await expect(secondOpener).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(lastOpener).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(secondOpener).toBeFocused()

    await firstOpener.focus()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('dialog', { name: 'Photo viewer' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Close photo' }).click()
    await expect(firstOpener).toBeFocused()

    const scrollPosition = await page.evaluate(() => window.scrollY)
    await page.keyboard.press('Space')
    await expect(
      page.getByRole('dialog', { name: 'Photo viewer' })
    ).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBe(scrollPosition)
  })

  for (const viewport of [viewports[0], viewports[2]]) {
    test(`modal focus is contained at the ${viewport.name} viewport`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await openGalleryWithFixture(page, interactionManifest)
      await page.getByRole('button', { name: 'Open Photo one' }).click()

      const dialog = page.getByRole('dialog', { name: 'Photo viewer' })
      const close = page.getByRole('button', { name: 'Close photo' })
      const previous = page.getByRole('button', { name: 'Previous photo' })
      const next = page.getByRole('button', { name: 'Next photo' })

      await expect(dialog).toHaveAttribute('aria-modal', 'true')
      await expect(dialog).toHaveAccessibleDescription(
        'Photo 1 of 3: Photo one.'
      )
      await expect(close).toBeFocused()

      await page.keyboard.press('Shift+Tab')
      await expect(next).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(close).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(previous).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(next).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(close).toBeFocused()
    })
  }

  test('the page is inert while the modal is open and recovers on close', async ({
    page,
  }) => {
    await openGalleryWithFixture(page, interactionManifest)
    const opener = page.getByRole('button', { name: 'Open Photo one' })
    const pageBackground = page.locator('.photos-page-background')
    const backgroundHomeLink = page.locator('.navbar-top a')

    await opener.click()
    await expect(pageBackground).toHaveAttribute('inert', '')
    await backgroundHomeLink.focus()
    await expect(
      page.getByRole('button', { name: 'Close photo' })
    ).toBeFocused()

    const galleryUrl = page.url()
    await backgroundHomeLink.click({ force: true })
    expect(page.url()).toBe(galleryUrl)

    await page.keyboard.press('Escape')
    await expect(pageBackground).not.toHaveAttribute('inert', '')
    await expect(page.getByRole('link', { name: 'HOME' })).toBeVisible()
  })

  test('closing after navigation restores the original opener', async ({
    page,
  }) => {
    await openGalleryWithFixture(page, interactionManifest)
    const secondOpener = page.getByRole('button', { name: 'Open Photo two' })

    await secondOpener.click()
    await page.keyboard.press('ArrowRight')
    await expectSelectedPhoto(page, 'Photo three')
    await page.getByRole('button', { name: 'Close photo' }).click()
    await expect(secondOpener).toBeFocused()

    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Previous photo' }).click()
    await expectSelectedPhoto(page, 'Photo one')
    await page.keyboard.press('Escape')
    await expect(secondOpener).toBeFocused()
  })

  test('a failed full-size request leaves the modal operable', async ({
    page,
  }) => {
    await openGalleryWithFixture(
      page,
      makeManifest([
        {
          id: 'failure-section',
          title: 'Failure section',
          albums: [makeAlbum('failure-album', null, ['broken'])],
        },
      ])
    )
    await page.route('**/broken-full.svg', (route) => route.abort())
    const opener = page.getByRole('button', { name: 'Open Photo broken' })

    await opener.click()
    const fullImage = page.getByRole('img', { name: 'Photo broken' })
    await expect(fullImage).toBeVisible()
    await expect
      .poll(() => fullImage.evaluate((image) => image.complete))
      .toBe(true)
    expect(await fullImage.evaluate((image) => image.naturalWidth)).toBe(0)
    await expect(
      page.getByRole('button', { name: 'Close photo' })
    ).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(opener).toBeFocused()
  })
})
