try {
  const label = document.getElementById('bootstrap-loading-text')
  const text = sessionStorage.getItem(label.dataset.storageKey)
  if (text) label.textContent = text
} catch {}
