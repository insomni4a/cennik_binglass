let pdfMakePromise = null

async function initPdfMake() {
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('./pdfFontsMinimal.js'),
  ])

  const pdfMake = pdfMakeModule.default
  pdfMake.addVirtualFileSystem(pdfFontsModule.default)

  return pdfMake
}

export function preloadPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = initPdfMake()
  }
  return pdfMakePromise
}

export function getPdfMake() {
  return preloadPdfMake()
}

export function yieldToMain() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0)
    })
  })
}
