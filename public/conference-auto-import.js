(() => {
  let lastSyncedCode = ''
  let scheduled = false

  function getCurrentCompanyCode() {
    const values = Array.from(document.querySelectorAll('.company-title .title-row span'))
      .map((node) => node.textContent?.trim() ?? '')
    return values.find((value) => /^\d{4,6}$/.test(value)) ?? ''
  }

  function getActiveConferenceGroup() {
    const active = document.querySelector('#conferences .conference-groups button.active')
    const text = active?.textContent?.trim() ?? ''
    return text.startsWith('資訊服務業') ? '資訊服務業' : 'PCB'
  }

  function syncConferenceCompany() {
    scheduled = false
    const section = document.querySelector('#conferences')
    if (!section) return

    const code = getCurrentCompanyCode()
    if (!code || code === lastSyncedCode) return

    lastSyncedCode = code
    window.dispatchEvent(new CustomEvent('select-conference-company', {
      detail: {
        code,
        group: getActiveConferenceGroup(),
      },
    }))
  }

  function scheduleSync() {
    if (scheduled) return
    scheduled = true
    window.setTimeout(syncConferenceCompany, 0)
  }

  const observer = new MutationObserver(scheduleSync)

  function start() {
    const root = document.getElementById('root')
    if (!root) return
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    scheduleSync()
    window.setTimeout(scheduleSync, 500)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
})()
