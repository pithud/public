/**
 * album_runtime.js
 * Universal Travel Album & Activity Log Client Runtime
 * Features: Dark/Light Mode Sync, Chart.js Controller, Tab Navigation, Fallback Error Handling
 */

(function (window, document) {
  'use strict';

  var STORAGE_KEY = 'trip_nav_theme';

  function getThemeColors() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      isDark: isDark,
      text: isDark ? '#94a3b8' : '#475569',
      title: isDark ? '#f8fafc' : '#0f172a',
      grid: isDark ? '#334155' : '#f1f5f9',
      cardBorder: isDark ? '#1e293b' : '#ffffff'
    };
  }

  function updateThemeButton(theme) {
    var btn = document.getElementById('themeBtn');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', theme === 'dark' ? 'ライトテーマに切替' : 'ダークテーマに切替');
    }
  }

  function applyTheme(theme, save) {
    document.documentElement.setAttribute('data-theme', theme);
    if (save) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {}
    }
    updateThemeButton(theme);

    // Dynamic non-destructive chart color update
    if (window.albumApp && window.albumApp.activeChart) {
      window.albumApp.updateThemeColors();
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    var next = current === 'light' ? 'dark' : 'light';
    applyTheme(next, true);
  }

  // 2. Chart Controller
  function AlbumApp() {
    this.activeChart = null;
    this.currentView = 'hourly';
    this.chartData = window.__ALBUM_CHART_DATA__ || null;
  }

  AlbumApp.prototype.init = function () {
    var self = this;
    var savedTheme = 'light';
    try {
      savedTheme = localStorage.getItem(STORAGE_KEY) || 'light';
    } catch (e) {}

    applyTheme(savedTheme, false);

    // Bind theme toggle button listener
    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleTheme);
    }

    // Bind tab clicks
    var tabs = document.querySelectorAll('.chart-tab-btn');
    tabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        if (view) {
          self.switchView(view);
        }
      });
    });

    if (this.chartData && document.getElementById('mainChartCanvas')) {
      var initialTab = document.querySelector('.chart-tab-btn.active');
      if (initialTab && initialTab.getAttribute('data-view')) {
        this.currentView = initialTab.getAttribute('data-view');
      }
      this.renderCurrentChart();
    }
  };

  AlbumApp.prototype.switchView = function (viewType) {
    this.currentView = viewType;
    var buttons = document.querySelectorAll('.chart-tab-btn');
    buttons.forEach(function (btn) {
      if (btn.getAttribute('data-view') === viewType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.renderCurrentChart();
  };

  AlbumApp.prototype.updateThemeColors = function () {
    if (!this.activeChart) return;
    var tc = getThemeColors();

    try {
      if (this.activeChart.options.scales) {
        if (this.activeChart.options.scales.x) {
          this.activeChart.options.scales.x.ticks.color = tc.text;
        }
        if (this.activeChart.options.scales.y) {
          this.activeChart.options.scales.y.ticks.color = tc.text;
          this.activeChart.options.scales.y.grid.color = tc.grid;
          if (this.activeChart.options.scales.y.title) {
            this.activeChart.options.scales.y.title.color = tc.text;
          }
        }
      }
      if (this.activeChart.options.plugins && this.activeChart.options.plugins.legend) {
        this.activeChart.options.plugins.legend.labels.color = tc.title;
      }
      if (this.activeChart.config.type === 'doughnut') {
        this.activeChart.data.datasets.forEach(function (ds) {
          ds.borderColor = tc.cardBorder;
        });
      }
      this.activeChart.update('none');
    } catch (e) {
      // Fallback: re-render
      this.renderCurrentChart();
    }
  };

  AlbumApp.prototype.renderCurrentChart = function () {
    var canvas = document.getElementById('mainChartCanvas');
    var wrapper = canvas ? canvas.parentElement : null;
    if (!canvas) return;

    // Check Chart.js availability with graceful fallback UI
    if (typeof Chart === 'undefined') {
      if (wrapper && !wrapper.querySelector('.chart-fallback')) {
        wrapper.innerHTML = '<div class="chart-fallback">📊 グラフ表示ライブラリ（Chart.js）の読み込みに失敗したか、オフラインです。データは安全に保持されています。</div>';
      }
      return;
    }

    if (this.activeChart) {
      this.activeChart.destroy();
      this.activeChart = null;
    }

    var dataConfig = this.chartData ? this.chartData[this.currentView] : null;
    if (!dataConfig) return;

    var captionEl = document.getElementById('chartCaption');
    if (captionEl && dataConfig.caption) {
      captionEl.innerHTML = dataConfig.caption;
    }

    var tc = getThemeColors();
    var ctx = canvas.getContext('2d');
    var chartType = dataConfig.type || 'bar';

    // Deep clone datasets to prevent global mutation
    var clonedDatasets = JSON.parse(JSON.stringify(dataConfig.datasets || []));

    var options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: tc.title,
            font: { weight: 'bold', size: 11 }
          }
        }
      }
    };

    if (chartType === 'doughnut') {
      options.plugins.legend.position = 'right';
      options.plugins.legend.labels.font.size = 10;
      clonedDatasets.forEach(function (ds) {
        ds.borderColor = tc.cardBorder;
      });
    } else {
      options.scales = {
        x: {
          ticks: { color: tc.text, font: { weight: 'bold', size: 10 } },
          grid: { display: false }
        },
        y: {
          ticks: { color: tc.text },
          grid: { color: tc.grid }
        }
      };
      if (dataConfig.yTitle) {
        options.scales.y.title = {
          display: true,
          text: dataConfig.yTitle,
          color: tc.text,
          font: { weight: 'bold', size: 11 }
        };
      }
    }

    try {
      this.activeChart = new Chart(ctx, {
        type: chartType,
        data: {
          labels: dataConfig.labels,
          datasets: clonedDatasets
        },
        options: options
      });
    } catch (err) {
      console.error('[album_runtime] Chart creation failed:', err);
      if (wrapper) {
        wrapper.innerHTML = '<div class="chart-fallback">⚠️ グラフ描画中にエラーが発生しました。</div>';
      }
    }
  };

  window.toggleTheme = toggleTheme;
  window.AlbumApp = AlbumApp;

  document.addEventListener('DOMContentLoaded', function () {
    window.albumApp = new AlbumApp();
    window.albumApp.init();
  });

})(window, document);
