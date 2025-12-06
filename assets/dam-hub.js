(function() {
  'use strict';

  window.DAMHub = function(options) {
    var container = document.getElementById(options.containerId);
    if (!container) return;

    var folders = options.folders || [];
    var files = options.files || [];
    var currentFolder = 'root';
    var viewMode = 'grid';

    function render() {
      var currentFolders = folders.filter(function(f) {
        return (f.parent_id || 'root') === currentFolder;
      });
      var currentFiles = files.filter(function(f) {
        return (f.folder_id || 'root') === currentFolder;
      });

      var html = '<div class="dam-hub">';
      html += '<div class="dam-header">';
      html += '<h2>Marketing Resources</h2>';
      html += '<div class="dam-controls">';
      html += '<button class="dam-view-btn" data-view="grid">Grid</button>';
      html += '<button class="dam-view-btn" data-view="list">List</button>';
      html += '</div>';
      html += '</div>';

      if (currentFolder !== 'root') {
        html += '<button class="dam-back-btn" id="damBack">← Back</button>';
      }

      html += '<div class="dam-content dam-' + viewMode + '">';

      if (currentFolders.length === 0 && currentFiles.length === 0) {
        html += '<div class="dam-empty">No files or folders</div>';
      }

      currentFolders.forEach(function(folder) {
        html += '<div class="dam-item dam-folder" data-folder-id="' + folder.id + '">';
        html += '<div class="dam-icon">📁</div>';
        html += '<div class="dam-name">' + escapeHtml(folder.name) + '</div>';
        html += '</div>';
      });

      currentFiles.forEach(function(file) {
        var icon = getFileIcon(file.name);
        html += '<div class="dam-item dam-file" data-url="' + escapeHtml(file.url) + '" data-name="' + escapeHtml(file.name) + '">';
        if (isImage(file.name) && file.url) {
          html += '<div class="dam-thumb"><img src="' + escapeHtml(file.url) + '" alt=""></div>';
        } else {
          html += '<div class="dam-icon">' + icon + '</div>';
        }
        html += '<div class="dam-name">' + escapeHtml(file.name) + '</div>';
        html += '<div class="dam-actions">';
        html += '<a href="' + escapeHtml(file.url) + '" download class="dam-btn">Download</a>';
        html += '<button class="dam-btn dam-copy" data-url="' + escapeHtml(file.url) + '">Copy Link</button>';
        html += '</div>';
        html += '</div>';
      });

      html += '</div></div>';
      container.innerHTML = html;
      bindEvents();
    }

    function bindEvents() {
      container.querySelectorAll('.dam-folder').forEach(function(el) {
        el.addEventListener('click', function() {
          currentFolder = el.dataset.folderId;
          render();
        });
      });

      var backBtn = document.getElementById('damBack');
      if (backBtn) {
        backBtn.addEventListener('click', function() {
          var parentFolder = folders.find(function(f) { return f.id === currentFolder; });
          currentFolder = parentFolder ? (parentFolder.parent_id || 'root') : 'root';
          render();
        });
      }

      container.querySelectorAll('.dam-copy').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var url = btn.dataset.url;
          navigator.clipboard.writeText(url).then(function() {
            btn.textContent = 'Copied!';
            setTimeout(function() { btn.textContent = 'Copy Link'; }, 2000);
          });
        });
      });

      container.querySelectorAll('.dam-view-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          viewMode = btn.dataset.view;
          render();
        });
      });
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function isImage(name) {
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name || '');
    }

    function getFileIcon(name) {
      var ext = (name || '').split('.').pop().toLowerCase();
      var icons = {
        pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
        ppt: '📽', pptx: '📽', zip: '📦', rar: '📦',
        mp4: '🎬', mov: '🎬', mp3: '🎵', wav: '🎵'
      };
      return icons[ext] || '📄';
    }

    if (!document.getElementById('dam-hub-styles')) {
      var style = document.createElement('style');
      style.id = 'dam-hub-styles';
      style.textContent = '\
.dam-hub { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }\
.dam-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0; }\
.dam-header h2 { margin: 0; font-size: 24px; font-weight: 500; }\
.dam-controls { display: flex; gap: 8px; }\
.dam-view-btn { padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; }\
.dam-view-btn:hover { background: #f5f5f5; }\
.dam-back-btn { margin-bottom: 15px; padding: 8px 16px; border: none; background: #f0f0f0; border-radius: 4px; cursor: pointer; }\
.dam-back-btn:hover { background: #e0e0e0; }\
.dam-content.dam-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }\
.dam-content.dam-list { display: flex; flex-direction: column; gap: 8px; }\
.dam-content.dam-list .dam-item { flex-direction: row; padding: 12px; }\
.dam-content.dam-list .dam-icon, .dam-content.dam-list .dam-thumb { width: 40px; height: 40px; font-size: 24px; margin-right: 12px; }\
.dam-content.dam-list .dam-name { flex: 1; }\
.dam-item { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; cursor: pointer; display: flex; flex-direction: column; align-items: center; text-align: center; transition: box-shadow 0.2s; }\
.dam-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }\
.dam-icon { font-size: 48px; margin-bottom: 8px; }\
.dam-thumb { width: 100%; height: 120px; margin-bottom: 8px; overflow: hidden; border-radius: 4px; }\
.dam-thumb img { width: 100%; height: 100%; object-fit: cover; }\
.dam-name { font-size: 14px; word-break: break-word; margin-bottom: 8px; }\
.dam-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }\
.dam-btn { padding: 6px 12px; font-size: 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; text-decoration: none; color: inherit; }\
.dam-btn:hover { background: #f5f5f5; }\
.dam-empty { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #666; }\
';
      document.head.appendChild(style);
    }

    render();
  };
})();
