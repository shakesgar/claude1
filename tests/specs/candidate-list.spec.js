const { test, expect } = require('../fixtures')
const { SEED } = require('../data/constants')

// 'Amara Demoray' -> 'demoray amara', the order the list sorts names by
const sortKey = name => {
  const [first, ...rest] = name.split(' ')
  return `${rest.join(' ')} ${first}`.toLowerCase()
}
const firstAmount = text => Number(text.split('–')[0].replace(/[^\d]/g, ''))
const ascending = values => [...values].sort((a, b) => (typeof a === 'number' ? a - b : a.localeCompare(b)))

test.describe('Candidate list', { tag: '@regression' }, () => {
  test.beforeEach(async ({ candidateListPage }) => {
    await candidateListPage.goto()
  })

  test.describe('search', () => {
    test('finds a candidate by name', async ({ candidateListPage, page }) => {
      await candidateListPage.search('Amara')

      expect(await candidateListPage.names()).toEqual(['Amara Demoray'])
      await expect(candidateListPage.resultCount).toHaveText('Showing 1–1 of 1 candidate')
      await expect(page).toHaveURL(/\?search=Amara$/)
    })

    test('matches part of a name in any letter case', async ({ candidateListPage }) => {
      await candidateListPage.search('AMA')

      const names = await candidateListPage.names()
      expect(names.length).toBeGreaterThan(1)
      for (const name of names) expect(name.toLowerCase()).toContain('ama')
    })

    test('matches across first and last name', async ({ candidateListPage }) => {
      await candidateListPage.search('amara dem')

      expect(await candidateListPage.names()).toEqual(['Amara Demoray'])
    })

    test('shows an empty state when nothing matches', async ({ candidateListPage }) => {
      await candidateListPage.search('zzz-no-such-candidate')

      await expect(candidateListPage.table.rows).toHaveCount(0)
      await expect(candidateListPage.emptyMessage).toHaveText('No candidates match your search.')
      await expect(candidateListPage.resultCount).toHaveText('No candidates found')
      await expect(candidateListPage.pagination).toBeHidden()
    })

    test('pressing Enter in the search box runs the search', async ({ candidateListPage }) => {
      await candidateListPage.searchInput.fill('Amara')
      await candidateListPage.searchInput.press('Enter')

      await expect(candidateListPage.table.rows).toHaveCount(1)
    })
  })

  test.describe('filters', () => {
    test('filters by status', async ({ candidateListPage, page }) => {
      await candidateListPage.filterByStatus('Placed')

      const statuses = await candidateListPage.statuses()
      expect(statuses).toEqual(['Placed', 'Placed', 'Placed'])
      await expect(page).toHaveURL(/\?status=Placed$/)
    })

    test('filters by skill', async ({ candidateListPage }) => {
      await candidateListPage.filterBySkill('SQL')

      const skills = await candidateListPage.table.cellTexts('candidate-skills')
      expect(skills.length).toBeGreaterThan(0)
      for (const cell of skills) expect(cell.split(', ')).toContain('SQL')
    })

    test('combines search, status and skill', async ({ candidateListPage }) => {
      await candidateListPage.filterByStatus('Active')
      await candidateListPage.filterBySkill('JavaScript')
      const filtered = await candidateListPage.names()
      expect(filtered.length).toBeGreaterThan(0)

      await candidateListPage.search(filtered[0])
      expect(await candidateListPage.names()).toEqual([filtered[0]])
      expect(await candidateListPage.statuses()).toEqual(['Active'])
    })

    test('Clear removes every filter', async ({ candidateListPage, page }) => {
      await candidateListPage.search('Amara')
      await candidateListPage.filterByStatus('Active')
      await expect(candidateListPage.table.rows).toHaveCount(1)

      await candidateListPage.clearFilters()

      await expect(candidateListPage.resultCount).toHaveText(`Showing 1–10 of ${SEED.candidates} candidates`)
      await expect(candidateListPage.searchInput).toHaveValue('')
      await expect(candidateListPage.statusFilter).toHaveValue('')
      await expect(page).toHaveURL(/\/candidates$/)
    })

    test('filtering returns to the first page', async ({ candidateListPage }) => {
      await candidateListPage.goToPage(3)
      await candidateListPage.filterByStatus('Active')

      await expect(candidateListPage.pageInfo).toHaveText('Page 1 of 2')
    })
  })

  test.describe('sorting', () => {
    test('sorts by name ascending by default', async ({ candidateListPage }) => {
      await expect(candidateListPage.table.header('Name')).toHaveAttribute('aria-sort', 'ascending')

      const keys = (await candidateListPage.names()).map(sortKey)
      expect(keys).toEqual(ascending(keys))
    })

    test('clicking the sorted column reverses the order', async ({ candidateListPage, page }) => {
      await candidateListPage.table.sortBy('Name')

      await expect(candidateListPage.table.header('Name')).toHaveAttribute('aria-sort', 'descending')
      const keys = (await candidateListPage.names()).map(sortKey)
      expect(keys).toEqual(ascending(keys).reverse())
      await expect(page).toHaveURL(/\?order=desc$/)
    })

    test('sorts by expected salary in both directions', async ({ candidateListPage }) => {
      await candidateListPage.table.sortBy('Expected salary')
      await expect(candidateListPage.table.header('Expected salary')).toHaveAttribute('aria-sort', 'ascending')
      await expect(candidateListPage.table.header('Name')).toHaveAttribute('aria-sort', 'none')
      let amounts = (await candidateListPage.table.cellTexts('candidate-salary')).map(firstAmount)
      expect(amounts).toEqual(ascending(amounts))

      await candidateListPage.table.sortBy('Expected salary')
      await expect(candidateListPage.table.header('Expected salary')).toHaveAttribute('aria-sort', 'descending')
      amounts = (await candidateListPage.table.cellTexts('candidate-salary')).map(firstAmount)
      expect(amounts).toEqual(ascending(amounts).reverse())
    })

    for (const [column, cell] of [['Email', 'candidate-email'], ['Location', 'candidate-location'], ['Status', 'candidate-status']]) {
      test(`sorts by ${column.toLowerCase()}`, async ({ candidateListPage }) => {
        await candidateListPage.table.sortBy(column)

        await expect(candidateListPage.table.header(column)).toHaveAttribute('aria-sort', 'ascending')
        const values = (await candidateListPage.table.cellTexts(cell)).map(value => value.toLowerCase())
        expect(values).toEqual(ascending(values))
      })
    }

    test('sorting keeps the active filter', async ({ candidateListPage }) => {
      await candidateListPage.filterByStatus('Placed')
      await candidateListPage.table.sortBy('Expected salary')

      expect(await candidateListPage.statuses()).toEqual(['Placed', 'Placed', 'Placed'])
    })
  })

  test.describe('pagination', () => {
    test('shows ten candidates per page', async ({ candidateListPage }) => {
      await expect(candidateListPage.table.rows).toHaveCount(SEED.pageSize)
      await expect(candidateListPage.pageInfo).toHaveText('Page 1 of 4')
      await expect(candidateListPage.previousButton).toBeDisabled()
      await expect(candidateListPage.nextButton).toBeEnabled()
      await expect(candidateListPage.pageButton(1)).toHaveAttribute('aria-current', 'page')
    })

    test('Next and Previous move between pages', async ({ candidateListPage, page }) => {
      const firstPage = await candidateListPage.names()

      await candidateListPage.goToNextPage()
      await expect(candidateListPage.pageInfo).toHaveText('Page 2 of 4')
      await expect(candidateListPage.resultCount).toHaveText(`Showing 11–20 of ${SEED.candidates} candidates`)
      await expect(page).toHaveURL(/\?page=2$/)
      const secondPage = await candidateListPage.names()
      expect(secondPage).toHaveLength(SEED.pageSize)
      for (const name of secondPage) expect(firstPage).not.toContain(name)

      await candidateListPage.goToPreviousPage()
      await expect(candidateListPage.pageInfo).toHaveText('Page 1 of 4')
      expect(await candidateListPage.names()).toEqual(firstPage)
    })

    test('the last page holds the remainder', async ({ candidateListPage }) => {
      await candidateListPage.goToPage(4)

      await expect(candidateListPage.table.rows).toHaveCount(SEED.candidates % SEED.pageSize)
      await expect(candidateListPage.resultCount).toHaveText('Showing 31–32 of 32 candidates')
      await expect(candidateListPage.nextButton).toBeDisabled()
      await expect(candidateListPage.previousButton).toBeEnabled()
    })

    test('every candidate appears exactly once across the pages', async ({ candidateListPage }) => {
      const seen = []
      for (let number = 1; number <= 4; number++) {
        if (number > 1) await candidateListPage.goToPage(number)
        seen.push(...await candidateListPage.names())
      }

      expect(seen).toHaveLength(SEED.candidates)
      expect(new Set(seen).size).toBe(SEED.candidates)
    })
  })

  test('restores search, filter, sort and page from the URL', async ({ candidateListPage }) => {
    await candidateListPage.goto('?status=Active&sort=salary&order=desc&page=2')

    await expect(candidateListPage.statusFilter).toHaveValue('Active')
    await expect(candidateListPage.table.header('Expected salary')).toHaveAttribute('aria-sort', 'descending')
    await expect(candidateListPage.pageInfo).toHaveText('Page 2 of 2')
    await expect(candidateListPage.table.rows).toHaveCount(10)
    expect(new Set(await candidateListPage.statuses())).toEqual(new Set(['Active']))
  })

  test('the browser Back button restores the previous view', async ({ candidateListPage, page }) => {
    await candidateListPage.filterByStatus('Placed')
    await expect(candidateListPage.table.rows).toHaveCount(3)

    await page.goBack()

    await expect(candidateListPage.table.rows).toHaveCount(SEED.pageSize)
    await expect(candidateListPage.statusFilter).toHaveValue('')
  })

  test('a candidate name opens the profile', async ({ candidateListPage, candidateProfilePage, page }) => {
    await candidateListPage.search('Amara')
    await candidateListPage.openCandidate('Amara Demoray')

    await expect(page).toHaveURL(/\/candidates\/1$/)
    await expect(candidateProfilePage.name).toHaveText('Amara Demoray')
  })
})
