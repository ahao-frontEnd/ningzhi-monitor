import './App.css'

import { RouterProvider } from 'react-router-dom'

import { Toaster } from './components/ui/toaster'
import { router } from './router'

function App() {
  return (
    <>
      <Toaster />
      <RouterProvider router={router} />
    </>
  )
}

export default App
