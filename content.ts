import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"

interface Metrics {
  totalReplacements: number
  wordsReplaced: Record<string, number>
  pagesProcessed: number
  lastProcessedUrl: string
  processingTime: number
}

const PROTECTION_KEY = "job_censor_protection_enabled"

const log = (message: string) => {
  console.log(`[Job Censor] ${message}`)
}

// Configuration for word replacement
const CONFIG = {
  patterns: [
    {
      regex: /\b(jobs?|employment|work)\b/gi,
      replacement: "j*b"
    },
    {
      regex: /\b(applications?|applicants?|hiring|recruitment)\b/gi,
      replacement: "appl*c*nt"
    },
    {
      regex: /\b(career|cv|resume|position|role)\b/gi,
      replacement: "c*r**r"
    },
    {
      regex: /\b(interview|interviewing|interviews)\b/gi,
      replacement: "int*rv*w"
    },
    {
      regex: /\b(salary|compensation|pay|wage)\b/gi,
      replacement: "s*l*ry"
    },
    {
      regex: /\b(company|employer|organization|corporation)\b/gi,
      replacement: "c*mp*ny"
    }
  ],
  // Elements to skip processing
  skipElements: [
    'script',
    'style',
    'code',
    'pre',
    'select',
    'option',
    'meta',
    'link',
    'noscript',
    'iframe'
  ]
}

const STORAGE_KEYS = {
  METRICS: 'job_censor_metrics',
  LAST_UPDATED: 'job_censor_last_updated'
}

const storage = new Storage()
let protectionEnabled = true

const checkProtection = async () => {
  const enabled = await storage.get<boolean>(PROTECTION_KEY)
  protectionEnabled = enabled !== false // default to true
  log(`Protection enabled: ${protectionEnabled}`)
  return protectionEnabled
}

const initializeMetrics = async () => {
  if (!(await checkProtection())) return
  const metrics = await storage.get<Metrics>(STORAGE_KEYS.METRICS)
  if (!metrics) {
    await storage.set(STORAGE_KEYS.METRICS, {
      totalReplacements: 0,
      wordsReplaced: {},
      pagesProcessed: 0,
      lastProcessedUrl: '',
      processingTime: 0
    })
  }
}

// Update metrics
const updateMetrics = async (replacements: Record<string, number>) => {
  if (!(await checkProtection())) return
  const startTime = performance.now()
  
  try {
    const metrics = await storage.get<Metrics>(STORAGE_KEYS.METRICS) || {
      totalReplacements: 0,
      wordsReplaced: {},
      pagesProcessed: 0,
      lastProcessedUrl: '',
      processingTime: 0
    }

    // Update metrics
    metrics.totalReplacements += Object.values(replacements).reduce((a, b) => a + b, 0)
    metrics.pagesProcessed++
    metrics.lastProcessedUrl = window.location.href
    metrics.processingTime = performance.now() - startTime

    // Update word counts
    Object.entries(replacements).forEach(([word, count]) => {
      metrics.wordsReplaced[word] = (metrics.wordsReplaced[word] || 0) + count
    })

    await storage.set(STORAGE_KEYS.METRICS, metrics)
    await storage.set(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString())
  } catch (error) {
    console.error('Error updating metrics:', error)
  }
}

// Check if element should be skipped
const shouldSkipElement = (element: Element): boolean => {
  return CONFIG.skipElements.includes(element.tagName.toLowerCase())
}

// Get all text nodes in the document
const getTextNodes = (): Text[] => {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip if parent element is in skip list
        const parent = node.parentElement
        if (parent && shouldSkipElement(parent)) {
          return NodeFilter.FILTER_REJECT
        }
        // Skip empty or whitespace-only text nodes
        if (!node.textContent?.trim()) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      }
    }
  )
  const textNodes: Text[] = []
  let node: Text | null
  while ((node = walker.nextNode() as Text)) {
    textNodes.push(node)
  }
  return textNodes
}

// Utility to inject animation CSS if not present
const injectCensorAnimCSS = () => {
  if (document.getElementById('job-censor-anim-style')) return;
  const style = document.createElement('style');
  style.id = 'job-censor-anim-style';
  style.textContent = `
    .job-censor-anim {
      display: inline-block;
      background: linear-gradient(90deg, #a855f7 0%, #38bdf8 100%);
      color: transparent;
      background-clip: text;
      -webkit-background-clip: text;
      animation: shimmer 1.5s infinite linear;
      border-radius: 4px;
      position: relative;
    }
    @keyframes shimmer {
      0% { filter: brightness(1.2) drop-shadow(0 0 2px #a855f7); }
      50% { filter: brightness(2) drop-shadow(0 0 8px #38bdf8); }
      100% { filter: brightness(1.2) drop-shadow(0 0 2px #a855f7); }
    }
  `;
  document.head.appendChild(style);
}

// Main function to process the page
const processPage = async (): Promise<void> => {
  if (!(await checkProtection())) {
    log("Protection disabled, skipping page processing")
    return
  }
  injectCensorAnimCSS();
  log("Processing page")
  try {
    await initializeMetrics()
    const textNodes = getTextNodes()
    const allReplacements: Record<string, number> = {}
    textNodes.forEach(node => {
      const replacements = replaceTextInNode(node)
      Object.entries(replacements).forEach(([word, count]) => {
        allReplacements[word] = (allReplacements[word] || 0) + count
      })
    })
    if (Object.keys(allReplacements).length > 0) {
      await updateMetrics(allReplacements)
    }
  } catch (error) {
    console.error("Error processing page:", error)
  }
}

// Update replaceTextInNode to wrap censored words in a span
const replaceTextInNode = (node: Text): Record<string, number> => {
  const text = node.textContent || ""
  let newText = text
  const replacements: Record<string, number> = {}

  CONFIG.patterns.forEach(({ regex, replacement }) => {
    // Replace and wrap each match
    newText = newText.replace(regex, (match) => {
      const word = match.toLowerCase()
      replacements[word] = (replacements[word] || 0) + 1
      return `<span class=\"job-censor-anim\">${replacement}</span>`
    })
  })

  if (newText !== text) {
    // Replace node with HTML
    const span = document.createElement('span')
    span.innerHTML = newText
    node.replaceWith(span)
  }

  return replacements
}

// --- Mutation Observer logic ---
let observer: MutationObserver | null = null

const observerCallback = (mutations: MutationRecord[]) => {
  if (!protectionEnabled) return
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement
        if (parent && !shouldSkipElement(parent)) {
          const replacements = replaceTextInNode(node as Text)
          if (Object.keys(replacements).length > 0) {
            updateMetrics(replacements)
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const textNodes = getTextNodes()
        const allReplacements: Record<string, number> = {}
        textNodes.forEach(node => {
          const replacements = replaceTextInNode(node)
          Object.entries(replacements).forEach(([word, count]) => {
            allReplacements[word] = (allReplacements[word] || 0) + count
          })
        })
        if (Object.keys(allReplacements).length > 0) {
          updateMetrics(allReplacements)
        }
      }
    })
  })
}

const startObserver = () => {
  if (observer) observer.disconnect()
  observer = new MutationObserver(observerCallback)
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
  log("MutationObserver started")
}

const stopObserver = () => {
  if (observer) {
    observer.disconnect()
    observer = null
    log("MutationObserver stopped")
  }
}

// Initialize the content script
checkProtection().then((enabled) => {
  if (enabled) {
    log("Protection enabled, processing page")
    processPage()
    startObserver()
  } else {
    log("Protection disabled, skipping page processing")
    stopObserver()
  }
})

// Listen for protection state changes
storage.watch({
  [PROTECTION_KEY]: (change) => {
    protectionEnabled = change.newValue !== false
    if (protectionEnabled) {
      log("Protection enabled, processing page")
      processPage()
      startObserver()
    } else {
      log("Protection disabled, skipping page processing")
      stopObserver()
    }
  }
})

export const config: PlasmoCSConfig = {
  matches: ["*://*/*"],
  all_frames: true
}

