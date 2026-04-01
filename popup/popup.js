document.addEventListener('DOMContentLoaded', async () => {
  const settingsContainer = document.getElementById('settings-container');

  // Load existing settings
  let config = {};
  try {
    const result = await browser.storage.local.get('reasoningConfig');
    config = result.reasoningConfig || {};
  } catch (e) {
    console.error('Failed to load settings', e);
  }

  document.getElementById('clear-all')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all learned models?')) {
      config = {}; // Clear the in-memory config
      await browser.storage.local.set({ reasoningConfig: {} }); // Clear storage
      renderList(); // Re-render to show empty state
    }
  });

  function renderList() {
    settingsContainer.innerHTML = '';
    const models = Object.keys(config);
    if (models.length === 0) {
      settingsContainer.innerHTML = '<div style="color:#777; font-size:12px; text-align:center; padding: 10px 0;">No models configured.</div>';
      return;
    }

    models.forEach(model => {
      const row = document.createElement('div');
      row.className = 'model-row';
      
      const info = document.createElement('div');
      info.className = 'model-info';
      
      const nameEl = document.createElement('span');
      nameEl.className = 'model-name';
      nameEl.textContent = model;
      
      // Inline select dropdown
      const selectEl = document.createElement('select');
      selectEl.className = 'model-effort-select';
      ['none', 'low', 'medium', 'high'].forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level.charAt(0).toUpperCase() + level.slice(1);
        if (config[model] === level) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      });

      // Auto-save on change
      selectEl.addEventListener('change', async (e) => {
        config[model] = e.target.value;
        await saveConfig();
      });
      
      info.appendChild(nameEl);
      row.appendChild(info);
      row.appendChild(selectEl);
      
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = 'X';
      delBtn.title = 'Remove model';
      delBtn.onclick = async () => {
        delete config[model];
        await saveConfig();
        renderList();
      };
      
      row.appendChild(delBtn);
      settingsContainer.appendChild(row);
    });
  }

  async function saveConfig() {
    await browser.storage.local.set({ reasoningConfig: config });
  }

  renderList();
});
