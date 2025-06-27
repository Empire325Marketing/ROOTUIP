// Google Analytics 4
(function() {
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID';
  document.head.appendChild(script);
  
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
  
  // Track ROI Calculator usage
  gtag('event', 'roi_calculator_interaction', {
    'event_category': 'engagement',
    'event_label': 'roi_calculator'
  });
})();

// Performance monitoring
(function() {
  window.addEventListener('load', function() {
    setTimeout(function() {
      var perfData = performance.timing;
      var pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      
      if (window.gtag) {
        gtag('event', 'page_load_time', {
          'event_category': 'performance',
          'value': pageLoadTime
        });
      }
    }, 0);
  });
})();
