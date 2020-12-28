import Vue from 'vue'

import App from './Main.vue'

new Vue({
    el: '#app',
    render: h => h(App)
  });
  
  const isDev = process.env.NODE_ENV !== "production"
  Vue.config.performance = isDev
  
  
  function debug(...argv) {
      fetch('/debug?argv=' + JSON.stringify(argv))
  }