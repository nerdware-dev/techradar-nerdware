import { test, expect } from '@playwright/test'

const RADAR = [
  {
    name: 'Docker',
    ring: 'High',
    quadrant: 'platforms',
    isNew: 'FALSE',
    description: 'Container platform.',
  },
  {
    name: 'React',
    ring: 'High',
    quadrant: 'languages & frameworks',
    isNew: 'FALSE',
    description: 'UI library.',
  },
  { name: 'Vite', ring: 'Dev', quadrant: 'tools', isNew: 'TRUE', description: 'Build tool.' },
]

test.beforeEach(async ({ page }) => {
  await page.route('**/tech-radar.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(RADAR) }),
  )
})

test('radar loads and a quadrant can be focused', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('img', { name: 'Tech Radar' })).toBeVisible()
  const firstBlip = page.getByRole('button').first()
  await expect(firstBlip).toBeVisible()
  await firstBlip.click()
  await expect(page.locator('[data-quadrant-table]')).toBeVisible()
})

test('search filters blips', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox').fill('doc')
  await expect(page.getByRole('option', { name: /docker/i })).toBeVisible()
})
