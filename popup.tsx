import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import "./style.css"

interface Metrics {
  totalReplacements: number
  wordsReplaced: Record<string, number>
  pagesProcessed: number
  lastProcessedUrl: string
  processingTime: number
}

const PROTECTION_KEY = "job_censor_protection_enabled"

const log = (message: string) => {
  console.log(`[Job Censor Popup] ${message}`)
}

// Toggle Switch Component
const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean, onChange: (v: boolean) => void }) => (
  <button
    className={`relative w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ${enabled ? 'bg-green-500' : 'bg-gray-600'}`}
    onClick={() => onChange(!enabled)}
    aria-label="Toggle Protection"
  >
    <span className={`absolute left-1 top-1 w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${enabled ? 'translate-x-6' : ''}`}></span>
    <span className="sr-only">Toggle Protection</span>
  </button>
)

// Status Indicator
const StatusIndicator = ({ enabled }: { enabled: boolean }) => (
  <div className="flex items-center space-x-2">
    <span className={`w-3 h-3 rounded-full ${enabled ? 'bg-green-400' : 'bg-gray-400'}`}></span>
    <span className={`font-semibold ${enabled ? 'text-green-400' : 'text-gray-400'}`}>{enabled ? 'Protection Enabled' : 'Protection Disabled'}</span>
  </div>
)

// Loading component
const LoadingScreen = () => (
  <div className="w-[400px] h-[500px] bg-gray-900 text-white flex items-center justify-center">
    <div className="animate-pulse">Loading your anti-work stats...</div>
  </div>
)

// Header component
const Header = ({ enabled, onToggle }: { enabled: boolean, onToggle: (v: boolean) => void }) => (
  <div className="p-6 border-b border-gray-700 bg-gray-800/50 flex flex-col items-center">
    <div className="flex items-center justify-between w-full mb-2">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <span>🚫</span> Anti-Work Shield
      </h2>
      <ToggleSwitch enabled={enabled} onChange={onToggle} />
    </div>
    <StatusIndicator enabled={enabled} />
    <p className="text-gray-400 text-sm mt-2 text-center">
      Your mental health protection companion
    </p>
  </div>
)

// Achievement banner component
const AchievementBanner = ({ totalWords, enabled }: { totalWords: number, enabled: boolean }) => (
  <div className={`bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-4 mb-6 text-center ${!enabled ? 'opacity-40 grayscale' : ''}`}>
    <div className="text-4xl mb-2">🏆</div>
    <h3 className="text-xl font-bold">Word Blocking Champion!</h3>
    <p className="text-sm opacity-90">
      You've blocked {totalWords} work-related words
    </p>
  </div>
)

// Stats grid component
const StatsGrid = ({ pagesProcessed, uniqueWords, enabled }: { pagesProcessed: number, uniqueWords: number, enabled: boolean }) => (
  <div className={`grid grid-cols-2 gap-4 mb-6 ${!enabled ? 'opacity-40 grayscale' : ''}`}>
    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
      <div className="text-3xl mb-2">📚</div>
      <p className="text-sm text-gray-400">Pages Protected</p>
      <p className="text-2xl font-bold">{pagesProcessed}</p>
    </div>
    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
      <div className="text-3xl mb-2">🎯</div>
      <p className="text-sm text-gray-400">Unique Words Blocked</p>
      <p className="text-2xl font-bold">{uniqueWords}</p>
    </div>
  </div>
)

// Most blocked word component
const MostBlockedWord = ({ word, count, enabled }: { word: string, count: number, enabled: boolean }) => (
  <div className={`bg-gray-800/50 rounded-xl p-4 mb-6 ${!enabled ? 'opacity-40 grayscale' : ''}`}>
    <h3 className="text-lg font-semibold mb-3 flex items-center">
      <span className="mr-2">🎯</span> Most Blocked Word
    </h3>
    <div className="bg-gray-700 rounded-lg p-3 text-center">
      <p className="text-2xl font-bold text-blue-400">{word}</p>
      <p className="text-sm text-gray-400">
        Blocked {count} times
      </p>
    </div>
  </div>
)

// Word list component
const WordList = ({ wordsReplaced, enabled }: { wordsReplaced: Record<string, number>, enabled: boolean }) => (
  <div className={`bg-gray-800/50 rounded-xl p-4 ${!enabled ? 'opacity-40 grayscale' : ''}`}>
    <h3 className="text-lg font-semibold mb-3 flex items-center">
      <span className="mr-2">📊</span> Word Blocking Stats
    </h3>
    <div className="space-y-2 max-h-[150px] overflow-y-auto scrollbar-hide">
      {Object.entries(wordsReplaced)
        .sort(([, a], [, b]) => b - a)
        .map(([word, count]) => (
          <div key={word} className="flex justify-between items-center py-2 px-3 bg-gray-700/50 rounded-lg">
            <span className="text-gray-300">{word}</span>
            <span className="bg-blue-600/50 px-2 py-1 rounded text-sm">{count}</span>
          </div>
        ))}
    </div>
  </div>
)

// Footer component
const Footer = () => (
  <div className="p-4 bg-gray-800/50 border-t border-gray-700 text-center text-sm text-gray-400">
    <div className="flex items-center justify-center space-x-2">
      <span>🛡️</span>
      <span>Job Censor v1.0</span>
      <span>🛡️</span>
    </div>
  </div>
)

// Main popup component
function IndexPopup() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [protectionEnabled, setProtectionEnabled] = useState(true)
  const storage = new Storage()

  useEffect(() => {
    const loadMetrics = async () => {
      const data = await storage.get<Metrics>("job_censor_metrics")
      setMetrics(data || {
        totalReplacements: 0,
        wordsReplaced: {},
        pagesProcessed: 0,
        lastProcessedUrl: '',
        processingTime: 0
      })
    }
    const loadProtection = async () => {
      const enabled = await storage.get<boolean>(PROTECTION_KEY)
      setProtectionEnabled(enabled !== false) // default to true
    }
    loadMetrics()
    loadProtection()
    storage.watch({
      "job_censor_metrics": (change) => {
        setMetrics(change.newValue as Metrics)
      },
      [PROTECTION_KEY]: (change) => {
        setProtectionEnabled(change.newValue !== false)
      }
    })
  }, [])

  const handleToggle = async (enabled: boolean) => {
    setProtectionEnabled(enabled)
    log(`Toggling protection to ${enabled}`)
    await storage.set(PROTECTION_KEY, enabled)
  }

  if (!metrics) return <LoadingScreen />

  const totalWords = metrics.totalReplacements
  const uniqueWords = Object.keys(metrics.wordsReplaced).length
  const mostBlockedWord = Object.entries(metrics.wordsReplaced)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || "none"
  const mostBlockedCount = metrics.wordsReplaced[mostBlockedWord] || 0

  return (
    <div className="w-[120px] h-[500px] bg-gray-900 text-white flex flex-col overflow-hidden shadow-lg scrollbar-hide" style={{ width: "400px", height: "500px" }}>
      <Header enabled={protectionEnabled} onToggle={handleToggle} />
      
      <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
        <AchievementBanner totalWords={totalWords} enabled={protectionEnabled} />
        <StatsGrid pagesProcessed={metrics.pagesProcessed} uniqueWords={uniqueWords} enabled={protectionEnabled} />
        <MostBlockedWord word={mostBlockedWord} count={mostBlockedCount} enabled={protectionEnabled} />
        <WordList wordsReplaced={metrics.wordsReplaced} enabled={protectionEnabled} />
      </div>

      <Footer />
    </div>
  )
}

export default IndexPopup
