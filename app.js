// くろリスト app.js

const KEY = 'kurolisto_v1';

let state = loadState();
let editMode = false;
let pendingAdd = null; // { zone: 'waiting'|'regular'|'todo', groupId? }

const sortableInstances = [];

// =================== STATE ===================

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.groups)) return s;
  } catch {}
  return { waitingCollapsed: false, waitingList: [], groups: [] };
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// =================== RENDER ===================

function render() {
  const main = document.getElementById('main');
  main.innerHTML = '';

  const editBtn = document.getElementById('editBtn');
  editBtn.textContent = editMode ? '完了' : '編集';
  editBtn.classList.toggle('editing', editMode);

  main.appendChild(renderWaitingSection());

  const groupsEl = mk('div', '');
  groupsEl.id = 'groups-list';
  state.groups.forEach(g => groupsEl.appendChild(renderGroup(g)));
  main.appendChild(groupsEl);

  if (editMode) {
    const wrap = mk('div', 'add-group-wrap');
    const btn = mk('button', 'btn-add-group', '＋ グループを追加');
    btn.addEventListener('click', addGroup);
    wrap.appendChild(btn);
    main.appendChild(wrap);
  }

  afterRender();
}

// ---- Waiting Section ----

function renderWaitingSection() {
  const sec = mk('section', 'section waiting-section');

  const hdr = mk('div', 'section-header');
  if (editMode) {
    hdr.appendChild(mk('span', 'drag-handle', '⠿'));
  }
  hdr.appendChild(mk('span', 'section-title', '返事待ち'));
  if (!editMode) {
    const meta = mk('div', 'section-meta');
    meta.appendChild(mk('span', 'chevron' + (state.waitingCollapsed ? '' : ' open'), '›'));
    hdr.appendChild(meta);
    hdr.addEventListener('click', () => {
      state.waitingCollapsed = !state.waitingCollapsed;
      save(); render();
    });
  }
  sec.appendChild(hdr);

  if (!state.waitingCollapsed || editMode) {
    const list = mk('div', 'item-list');
    list.id = 'waiting-list';

    state.waitingList.forEach((item, i) => list.appendChild(renderWaitingItem(item, i)));

    if (pendingAdd?.zone === 'waiting') {
      list.appendChild(renderAddInput('waiting', null));
    } else {
      const addRow = mk('div', 'add-row');
      addRow.innerHTML = '<span class="add-plus">＋</span><span>追加</span>';
      addRow.addEventListener('click', () => { pendingAdd = { zone: 'waiting' }; render(); focusInput(); });
      list.appendChild(addRow);
    }

    sec.appendChild(list);
  }

  return sec;
}

function renderWaitingItem(item, index) {
  const wrap = mk('div', 'item-wrap');
  wrap.dataset.zone = 'waiting';
  wrap.dataset.id = item.id;

  if (!editMode) wrap.appendChild(mk('div', 'delete-bg', '削除'));

  const row = mk('div', 'item-row');

  if (editMode) {
    row.appendChild(mk('span', 'drag-handle sortable-handle', '⠿'));
    const del = mk('button', 'del-btn', '−');
    del.addEventListener('click', () => {
      state.waitingList = state.waitingList.filter(i => i.id !== item.id);
      save(); render();
    });
    row.appendChild(del);
    row.appendChild(mk('span', 'waiting-num', `${index + 1}.`));
    const inp = document.createElement('input');
    inp.className = 'inline-input item-text';
    inp.value = item.text;
    inp.addEventListener('change', e => { item.text = e.target.value; save(); });
    row.appendChild(inp);
  } else {
    row.appendChild(mk('span', 'waiting-num', `${index + 1}.`));
    row.appendChild(mk('span', 'item-text', item.text));
  }

  wrap.appendChild(row);
  return wrap;
}

// ---- Group ----

function renderGroup(group) {
  const sec = mk('section', 'section');
  sec.dataset.id = group.id;

  const hdr = mk('div', 'section-header');

  if (editMode) {
    hdr.appendChild(mk('span', 'drag-handle sortable-handle', '⠿'));
    const del = mk('button', 'del-btn', '−');
    del.addEventListener('click', () => {
      if (!confirm(`「${group.name}」を削除しますか？`)) return;
      state.groups = state.groups.filter(g => g.id !== group.id);
      save(); render();
    });
    hdr.appendChild(del);
    const inp = document.createElement('input');
    inp.className = 'section-title-input';
    inp.value = group.name;
    inp.addEventListener('change', e => { group.name = e.target.value; save(); });
    hdr.appendChild(inp);
  } else {
    hdr.appendChild(mk('span', 'section-title', group.name));
    const meta = mk('div', 'section-meta');
    const n = group.regularItems.filter(i => i.active).length + group.todoItems.length;
    if (n > 0) meta.appendChild(mk('span', 'badge', String(n)));
    meta.appendChild(mk('span', 'chevron' + (group.collapsed ? '' : ' open'), '›'));
    hdr.appendChild(meta);
    hdr.addEventListener('click', () => { group.collapsed = !group.collapsed; save(); render(); });
  }
  sec.appendChild(hdr);

  if (!group.collapsed || editMode) {
    const body = mk('div', 'group-body');

    // 定期ゾーン
    body.appendChild(mk('div', 'zone-label', '定期'));
    const regList = mk('div', 'item-list regular-list');
    regList.dataset.groupId = group.id;

    group.regularItems.forEach(item => regList.appendChild(renderRegularItem(group, item)));

    if (editMode) {
      if (pendingAdd?.zone === 'regular' && pendingAdd.groupId === group.id) {
        regList.appendChild(renderAddInput('regular', group.id));
      } else {
        const add = mk('div', 'add-row');
        add.innerHTML = '<span class="add-plus">＋</span><span>定期アイテムを追加</span>';
        add.addEventListener('click', () => { pendingAdd = { zone: 'regular', groupId: group.id }; render(); focusInput(); });
        regList.appendChild(add);
      }
    }
    body.appendChild(regList);

    // 今回ゾーン
    body.appendChild(mk('div', 'zone-label', '今回'));
    const todoList = mk('div', 'item-list todo-list');
    todoList.dataset.groupId = group.id;

    group.todoItems.forEach(item => todoList.appendChild(renderTodoItem(group, item)));

    if (pendingAdd?.zone === 'todo' && pendingAdd.groupId === group.id) {
      todoList.appendChild(renderAddInput('todo', group.id));
    } else if (!editMode) {
      const add = mk('div', 'add-row');
      add.innerHTML = '<span class="add-plus">＋</span><span>追加</span>';
      add.addEventListener('click', () => { pendingAdd = { zone: 'todo', groupId: group.id }; render(); focusInput(); });
      todoList.appendChild(add);
    }
    body.appendChild(todoList);

    // 買い物完了
    if (!editMode && (group.regularItems.some(i => i.active) || group.todoItems.length > 0)) {
      const btn = mk('button', 'complete-btn', '✓ 買い物完了');
      btn.addEventListener('click', () => {
        group.regularItems.forEach(i => i.active = false);
        group.todoItems = [];
        save(); render();
      });
      body.appendChild(btn);
    }

    sec.appendChild(body);
  }

  return sec;
}

function renderRegularItem(group, item) {
  const wrap = mk('div', 'item-wrap');
  wrap.dataset.id = item.id;

  const row = mk('div', 'item-row');

  if (editMode) {
    row.appendChild(mk('span', 'drag-handle sortable-handle', '⠿'));
    const del = mk('button', 'del-btn', '−');
    del.addEventListener('click', () => {
      group.regularItems = group.regularItems.filter(i => i.id !== item.id);
      save(); render();
    });
    row.appendChild(del);
    const dot = mk('div', 'toggle-dot' + (item.active ? ' active' : ''));
    row.appendChild(dot);
    const inp = document.createElement('input');
    inp.className = 'inline-input item-text';
    inp.value = item.text;
    inp.addEventListener('change', e => { item.text = e.target.value; save(); });
    row.appendChild(inp);
  } else {
    const dot = mk('div', 'toggle-dot' + (item.active ? ' active' : ''));
    dot.addEventListener('click', () => { item.active = !item.active; save(); render(); });
    row.appendChild(dot);
    row.appendChild(mk('span', 'item-text' + (item.active ? '' : ' dimmed'), item.text));
  }

  wrap.appendChild(row);
  return wrap;
}

function renderTodoItem(group, item) {
  const wrap = mk('div', 'item-wrap');
  wrap.dataset.zone = 'todo';
  wrap.dataset.id = item.id;
  wrap.dataset.groupId = group.id;

  wrap.appendChild(mk('div', 'delete-bg', '削除'));

  const row = mk('div', 'item-row');
  row.appendChild(mk('span', 'item-text', item.text));
  wrap.appendChild(row);
  return wrap;
}

// ---- Inline Add Input ----

function renderAddInput(zone, groupId) {
  const row = mk('div', 'item-row add-input-row');
  const inp = document.createElement('input');
  inp.className = 'add-input';
  inp.placeholder =
    zone === 'waiting' ? '返事待ちを入力...' :
    zone === 'regular' ? '定期アイテム名...' :
    'アイテム名...';

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commitAdd(zone, groupId, inp.value); }
    if (e.key === 'Escape') { pendingAdd = null; render(); }
  });
  inp.addEventListener('blur', () => commitAdd(zone, groupId, inp.value));

  const cancel = mk('button', 'cancel-add-btn', '✕');
  cancel.addEventListener('mousedown', e => { e.preventDefault(); pendingAdd = null; render(); });

  row.appendChild(inp);
  row.appendChild(cancel);
  return row;
}

function commitAdd(zone, groupId, rawText) {
  const text = rawText?.trim();
  pendingAdd = null;
  if (text) {
    if (zone === 'waiting') {
      state.waitingList.push({ id: uid(), text });
    } else if (zone === 'regular') {
      const g = state.groups.find(g => g.id === groupId);
      if (g) g.regularItems.push({ id: uid(), text, active: false });
    } else if (zone === 'todo') {
      const g = state.groups.find(g => g.id === groupId);
      if (g) g.todoItems.push({ id: uid(), text });
    }
    save();
  }
  render();
}

function focusInput() {
  requestAnimationFrame(() => {
    const inp = document.querySelector('.add-input');
    if (inp) inp.focus();
  });
}

function addGroup() {
  const name = prompt('グループ名：');
  if (!name?.trim()) return;
  state.groups.push({ id: uid(), name: name.trim(), collapsed: false, regularItems: [], todoItems: [] });
  save(); render();
}

// =================== AFTER RENDER ===================

function afterRender() {
  sortableInstances.forEach(s => { try { s.destroy(); } catch {} });
  sortableInstances.length = 0;

  if (editMode) {
    initSortable();
  } else {
    initSwipe();
  }
}

// =================== SORTABLE ===================

function initSortable() {
  if (typeof Sortable === 'undefined') return;

  const opts = (onEndFn) => ({
    handle: '.sortable-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    filter: '.add-row, .add-input-row',
    preventOnFilter: false,
    onEnd: onEndFn
  });

  // Groups
  const groupsList = document.getElementById('groups-list');
  if (groupsList) {
    sortableInstances.push(new Sortable(groupsList, opts(e => {
      const [moved] = state.groups.splice(e.oldIndex, 1);
      state.groups.splice(e.newIndex, 0, moved);
      save();
    })));
  }

  // Waiting list
  const waitingList = document.getElementById('waiting-list');
  if (waitingList) {
    sortableInstances.push(new Sortable(waitingList, opts(e => {
      const [moved] = state.waitingList.splice(e.oldIndex, 1);
      state.waitingList.splice(e.newIndex, 0, moved);
      save(); render(); // re-number
    })));
  }

  // Regular items per group
  document.querySelectorAll('.regular-list').forEach(list => {
    const gid = list.dataset.groupId;
    const group = state.groups.find(g => g.id === gid);
    if (!group) return;
    sortableInstances.push(new Sortable(list, opts(e => {
      const [moved] = group.regularItems.splice(e.oldIndex, 1);
      group.regularItems.splice(e.newIndex, 0, moved);
      save();
    })));
  });
}

// =================== SWIPE DELETE ===================

function initSwipe() {
  document.querySelectorAll('.item-wrap[data-zone]').forEach(wrap => {
    const row = wrap.querySelector('.item-row');
    if (!row) return;

    let startX = 0, curX = 0, swiping = false;

    function pointerStart(clientX) {
      startX = clientX;
      curX = 0;
      swiping = true;
      row.style.transition = 'none';
    }

    function pointerMove(clientX) {
      if (!swiping) return;
      curX = Math.min(0, clientX - startX);
      row.style.transform = `translateX(${curX}px)`;
      const bg = wrap.querySelector('.delete-bg');
      if (bg) bg.style.opacity = String(Math.min(1, Math.abs(curX) / 80));
    }

    function pointerEnd() {
      if (!swiping) return;
      swiping = false;
      row.style.transition = 'transform .2s';

      const zone    = wrap.dataset.zone;
      const id      = wrap.dataset.id;
      const groupId = wrap.dataset.groupId;
      const bg      = wrap.querySelector('.delete-bg');

      if (curX < -180) {
        slideDelete(wrap, () => doDelete(zone, id, groupId));
      } else if (curX < -70) {
        row.style.transform = 'translateX(-90px)';
        if (bg) {
          bg.style.opacity = '1';
          bg.onclick = () => slideDelete(wrap, () => doDelete(zone, id, groupId));
        }
        setTimeout(() => {
          const dismiss = () => {
            row.style.transform = '';
            if (bg) bg.style.opacity = '0';
            document.removeEventListener('touchstart', dismiss);
            document.removeEventListener('mousedown', dismiss);
          };
          document.addEventListener('touchstart', dismiss, { once: true });
          document.addEventListener('mousedown', dismiss, { once: true });
        }, 50);
      } else {
        row.style.transform = '';
        if (bg) bg.style.opacity = '0';
      }
    }

    // Touch
    row.addEventListener('touchstart', e => pointerStart(e.touches[0].clientX), { passive: true });
    row.addEventListener('touchmove',  e => pointerMove(e.touches[0].clientX),  { passive: true });
    row.addEventListener('touchend',   pointerEnd);

    // Mouse (PC)
    row.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      pointerStart(e.clientX);
      const onMove = e2 => pointerMove(e2.clientX);
      const onUp   = () => { pointerEnd(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

function slideDelete(wrap, callback) {
  const h = wrap.offsetHeight;
  wrap.style.overflow = 'hidden';
  wrap.style.height = h + 'px';
  requestAnimationFrame(() => {
    wrap.style.transition = 'height .2s ease, opacity .2s ease';
    wrap.style.height = '0';
    wrap.style.opacity = '0';
  });
  setTimeout(callback, 220);
}

function doDelete(zone, id, groupId) {
  if (zone === 'waiting') {
    state.waitingList = state.waitingList.filter(i => i.id !== id);
  } else if (zone === 'todo') {
    const g = state.groups.find(g => g.id === groupId);
    if (g) g.todoItems = g.todoItems.filter(i => i.id !== id);
  }
  save(); render();
}

// =================== HELPERS ===================

function mk(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// =================== BOOT ===================

document.getElementById('editBtn').addEventListener('click', () => {
  pendingAdd = null;
  editMode = !editMode;
  render();
});

render();
