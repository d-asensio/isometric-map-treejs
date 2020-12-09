import './styles/index.scss'
import { App } from './app'

;(async function IIFE () {
  if (document.readyState === 'complete') {
    App.init({
      rootDOMElement: document.body
    })
  } else {
    window.onload = () => {
      App.init({
        rootDOMElement: document.body
      })
    }
  }
})()
