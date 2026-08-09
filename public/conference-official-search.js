(() => {
  const LINK_SELECTOR = '#conferences .section-title a.text-link'

  function getSelectedCompanyCode(section) {
    const companySelect = section.querySelector('.conference-toolbar select')
    const selectedCode = companySelect?.value?.trim() ?? ''
    if (/^\d{4,6}$/.test(selectedCode)) return selectedCode

    const titleValues = Array.from(document.querySelectorAll('.company-title .title-row span'))
      .map((node) => node.textContent?.trim() ?? '')
    return titleValues.find((value) => /^\d{4,6}$/.test(value)) ?? ''
  }

  function buildOfficialConferenceUrl(companyCode) {
    const now = new Date()
    const params = new URLSearchParams({
      encodeURIComponent: '1',
      step: '1',
      firstin: '1',
      off: '1',
      TYPEK: 'all',
      co_id: companyCode,
      year: String(now.getFullYear() - 1911),
      month: String(now.getMonth() + 1).padStart(2, '0'),
    })

    return `https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1?${params.toString()}#`
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
    window.open(buildOfficialConferenceUrl(companyCode), '_blank', 'noopener,noreferrer')
  }, true)
})()
