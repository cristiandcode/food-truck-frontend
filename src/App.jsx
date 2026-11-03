
import { useState } from 'react'

import './index.css'

import Topbar from './components/layout/Topbar'
import POS from './pages/POS'
import Sales from './pages/Sales'

function App() {
  const [activePage, setActivePage] = useState('pos')

  return (
    <div className="min-h-screen bg-[#f5f3ee] text-[#26332d]">
      <Topbar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      {activePage === 'pos' && <POS />}

      {activePage === 'sales' && <Sales />}
    </div>
  )
}

export default App
