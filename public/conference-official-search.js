(() => {
  const LINK_SELECTOR = '#conferences .section-title a.text-link'
  const OFFICIAL_CONFERENCE_SEARCH_URL = 'https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1'

  function getSelectedCompanyCode(section) {
    const companySelect = section.querySelector('.conference-toolbar select')
    const selectedCode = companySelect?.value?.trim() ?? ''
    if (/^\d{4,6}$/.test(selectedCode)) return selectedCode

    const titleValues = Array.from(document.querySelectorAll('.company-title .title-row span'))
      .map((node) => node.textContent?.trim() ?? '')
    return titleValues.find((value) => /^\d{4,6}$/.test(value)) ?? ''
  }

  function openOfficialConferenceSearch(companyCode) {
    const now = new Date()
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = OFFICIAL_CONFERENCE_SEARCH_URL
    form.target = '_blank'

    const fields = {
      encodeURIComponent: '1',
      subMenuID: '2',
      step: '1',
      firstin: '1',
      off: '1',
      TYPEK: 'all',
      co_id: companyCode,
      year: String(now.getFullYear() - 1911),
      month: 'all',
    }

    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }

    document.body.appendChild(form)
    form.submit()
    form.remove()
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest(LINK_SELECTOR) : null
    if (!(target instanceof HTMLAnchorElement)) return

    const section = target.closest('#conferences')
    if (!section) return

    const companyCode = getSelectedCompanyCode(section)
    if (!companyCode) return

    event.preventDefault()
    event.stopImmediatePropagation()
    openOfficialConferenceSearch(companyCode)
  }, true)
})()
