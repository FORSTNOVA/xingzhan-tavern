({
  panel:!!document.querySelector('#xingzhan-synthesis'),
  openButton:!!document.querySelector('#xingzhan-synthesis [data-open-image-dialog]'),
  dialog:!!document.querySelector('#xingzhan-image-dialog'),
  scriptCount:document.querySelectorAll('script[src*="xingzhan"]').length,
  scriptUrls:[...document.querySelectorAll('script[src*="xingzhan"]')].map(x=>x.src),
  extensionCount:document.querySelectorAll('#extensions_settings > *').length,
  extensionIds:[...document.querySelectorAll('#extensions_settings > *')].map(x=>x.id).filter(Boolean),
})
