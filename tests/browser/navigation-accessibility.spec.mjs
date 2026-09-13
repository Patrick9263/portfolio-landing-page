import { expect, test } from '@playwright/test'

const openPortfolio = async (page) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' })

  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
}

const skipLinkViewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]

for (const viewport of skipLinkViewports) {
  test(`skip link reaches main content at the ${viewport.name} viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await openPortfolio(page)

    const skipLink = page.getByRole('link', { name: 'Skip to main content' })
    const main = page.getByRole('main')

    await expect(skipLink).not.toBeInViewport()
    await page.keyboard.press('Tab')
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeInViewport()
    await expect(skipLink).toHaveCSS('outline-style', 'solid')

    await page.keyboard.press('Enter')
    await expect(main).toBeFocused()
    expect(new URL(page.url()).hash).toBe('#main-content')
    await expect(
      page.getByRole('heading', { name: 'About', level: 2 })
    ).toBeInViewport()
  })
}

test('desktop navigation uses native links with matching section targets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openPortfolio(page)

  const navigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  })
  const links = [
    ['Home', '#home'],
    ['About', '#about'],
    ['Experience', '#experience'],
    ['Projects', '#projects'],
    ['Contact', '#contact'],
  ]

  for (const [name, href] of links) {
    const link = navigation.getByRole('link', { name, exact: true })
    await expect(link).toHaveAttribute('href', href)
    await expect(page.locator(href)).toHaveCount(1)
  }

  const projectsLink = navigation.getByRole('link', {
    name: 'Projects',
    exact: true,
  })
  await projectsLink.focus()
  await expect(projectsLink).toHaveCSS('outline-style', 'solid')
  await projectsLink.click()
  await expect.poll(() => new URL(page.url()).hash).toBe('#projects')
  await expect(page.locator('#projects')).toBeInViewport()
})

test('mobile menu exposes state and supports keyboard open, traversal, Escape, and selection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPortfolio(page)

  const toggle = page.locator('button[aria-controls="mobile-navigation"]')
  const menu = page.locator('#mobile-navigation')

  await expect(toggle).toHaveAccessibleName('Open navigation menu')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeHidden()
  await expect(
    page.getByRole('link', { name: 'About', exact: true })
  ).toHaveCount(0)

  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAccessibleName('Close navigation menu')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()

  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Home', exact: true })
  ).toBeFocused()
  await page.keyboard.press('Tab')
  const aboutLink = page.getByRole('link', { name: 'About', exact: true })
  await expect(aboutLink).toBeFocused()
  await expect(aboutLink).toHaveCSS('outline-style', 'solid')

  await page.keyboard.press('Escape')
  await expect(toggle).toBeFocused()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeHidden()
  await expect(aboutLink).toHaveCount(0)

  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const reopenedAboutLink = page.getByRole('link', {
    name: 'About',
    exact: true,
  })
  await reopenedAboutLink.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeHidden()
  await expect.poll(() => new URL(page.url()).hash).toBe('#about')
})

test('resizing from mobile to desktop clears stale mobile menu state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPortfolio(page)

  const toggle = page.locator('button[aria-controls="mobile-navigation"]')
  const menu = page.locator('#mobile-navigation')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.setViewportSize({ width: 1000, height: 800 })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeHidden()
  await expect(
    page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'About', exact: true })
  ).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(menu).toBeHidden()
  await expect(
    page.getByRole('link', { name: 'About', exact: true })
  ).toHaveCount(0)
})

test('calls to action use one focused native interactive element', async ({
  page,
}) => {
  await openPortfolio(page)

  await expect(
    page.locator('a button, button a, a input, button [role="link"]')
  ).toHaveCount(0)

  const galleryLink = page.getByRole('link', { name: 'Open gallery' })
  const projectsLink = page.getByRole('link', { name: 'More projects' })

  await expect(galleryLink).toHaveAttribute('href', '/?photos=true')
  await expect(projectsLink).toHaveAttribute(
    'href',
    'https://github.com/Patrick9263'
  )
  await galleryLink.focus()
  await expect(galleryLink).toHaveCSS('outline-style', 'solid')
})

test('reduced motion renders content immediately without typewriter loops', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openPortfolio(page)

  await expect
    .poll(() =>
      page.evaluate(
        () => getComputedStyle(document.documentElement).scrollBehavior
      )
    )
    .toBe('auto')
  await expect(page.locator('[data-testid="typewriter-wrapper"]')).toHaveCount(
    0
  )
  await expect(
    page.getByText("I'm a software engineer.", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText('learning new technologies.', { exact: true })
  ).toBeVisible()

  expect(
    await page.locator('.reveal').evaluateAll((elements) =>
      elements.every((element) => {
        const style = getComputedStyle(element)
        return style.opacity === '1' && style.transitionDuration === '0s'
      })
    )
  ).toBe(true)
  await expect(page.locator('.skill-bar').first()).not.toHaveCSS('width', '1px')
})

test('reduced-motion section navigation jumps without smooth scrolling', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await openPortfolio(page)

  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Contact', exact: true })
    .click()

  expect(new URL(page.url()).hash).toBe('#contact')
  const contactTop = await page
    .locator('#contact')
    .evaluate((element) => Math.round(element.getBoundingClientRect().top))
  expect(contactTop).toBeGreaterThanOrEqual(0)
  expect(contactTop).toBeLessThanOrEqual(64)
})

test('default motion keeps smooth navigation and typewriters active', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openPortfolio(page)

  await expect
    .poll(() =>
      page.evaluate(
        () => getComputedStyle(document.documentElement).scrollBehavior
      )
    )
    .toBe('smooth')
  await expect(page.locator('[data-testid="typewriter-wrapper"]')).toHaveCount(
    2
  )
  await expect(page.locator('.reveal').first()).toHaveCSS(
    'transition-duration',
    '1s, 1s'
  )
})

test('top link uses effect-managed listeners and follows its visibility lifecycle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 600 })
  await openPortfolio(page)

  const topLink = page.locator('.topButton')
  expect(
    await page.evaluate(() => ({
      onload: window.onload,
      onscroll: window.onscroll,
    }))
  ).toEqual({ onload: null, onscroll: null })
  await expect(topLink).toHaveAttribute('href', '#home')
  await expect(topLink).toHaveAttribute('aria-hidden', 'true')
  await expect(topLink).toHaveAttribute('tabindex', '-1')

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(topLink).toHaveAttribute('aria-hidden', 'false')
  await expect(topLink).toBeVisible()
  await topLink.focus()
  await expect(topLink).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Enter')

  await expect.poll(() => new URL(page.url()).hash).toBe('#home')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await expect(topLink).toHaveAttribute('aria-hidden', 'true')
})
