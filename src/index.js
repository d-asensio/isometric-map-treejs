import './styles/index.scss'

function renderApp () {
  const appRoot = document.getElementById('app')
  appRoot.innerText = 'Hello world!'
}

;(async function IIFE () {
  if (document.readyState === 'complete') {
    renderApp()
  } else {
    window.onload = () => renderApp()
  }
})()
