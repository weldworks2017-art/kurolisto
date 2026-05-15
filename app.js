// くろリスト app.js

const KEY = 'kurolisto_v1';

let state = loadState();
let editMode = false;

const sortableInstances = [];

// =================== STATE ===================

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.groups)) return s;
  } catch {}
  return { groups: [] };
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function isInTodo(group, regularItemId) {
  return group.todoItems.some(t => t.refId === regularItemId);
}

// =================== RENDER ===================

function render() {
  const main = document.getElementById('main');
  main.innerHTML = '';

  const editBtn = document.getElementById('editBtn');
  editBtn.textContent = editMode ? '完了' : '編集';
  editBtn.classList.toggle('editing', editMode);

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
    if (group.todoItems.length > 0) {
      meta.appendChild(mk('span', 'badge', String(group.todoItems.length)));
    }
    meta.appendChild(mk('span', 'chevron' + (group.collapsed ? '' : ' open'), '›'));
    hdr.appendChild(meta);
    hdr.addEventListener('click', () => { group.collapsed = !group.collapsed; save(); render(); });
  }
  sec.appendChild(hdr);

  if (!group.collapsed || editMode) {
    const body = mk('div', 'group-body');

    // ── 買うものゾーン（上） ──
    body.appendChild(mk('div', 'zone-label', '買うもの'));
    const todoList = mk('div', 'item-list todo-list');
    todoList.dataset.groupId = group.id;
    group.todoItems.forEach(item => todoList.appendChild(renderTodoItem(group, item)));
    if (!editMode) {
      todoList.appendChild(renderPersistentAdd('追加...', text => {
        group.todoItems.push({ id: uid(), text });
        save(); render();
      }));
    }
    body.appendChild(todoList);

    // ── いつものゾーン（下） ──
    const itsZoneRow = mk('div', 'zone-label-row');
    itsZoneRow.appendChild(mk('span', 'zone-label-text', 'いつもの'));
    if (!editMode && group.regularItems.length > 0) {
      const allAddBtn = mk('button', 'all-add-btn', '全部追加');
      allAddBtn.addEventListener('click', () => {
        group.regularItems.forEach(item => {
          if (!isInTodo(group, item.id)) {
            group.todoItems.push({ id: uid(), text: item.text, refId: item.id });
          }
        });
        save(); render();
      });
      itsZoneRow.appendChild(allAddBtn);
    }
    body.appendChild(itsZoneRow);

    const regList = mk('div', 'item-list regular-list');
    regList.dataset.groupId = group.id;
    group.regularItems.forEach(item => regList.appendChild(renderRegularItem(group, item)));
    if (editMode) {
      const add = mk('div', 'add-row');
      add.innerHTML = '<span class="add-plus">＋</span><span>追加</span>';
      add.addEventListener('click', () => {
        const name = prompt('アイテム名：');
        if (!name?.trim()) return;
        group.regularItems.push({ id: uid(), text: name.trim() });
        save(); render();
      });
      regList.appendChild(add);
    }
    body.appendChild(regList);

    sec.appendChild(body);
  }

  return sec;
}

function renderRegularItem(group, item) {
  const wrap = mk('div', 'item-wrap');
  wrap.dataset.id = item.id;
  const row = mk('div', 'item-row regular-row');

  if (editMode) {
    row.appendChild(mk('span', 'drag-handle sortable-handle', '⠿'));
    const del = mk('button', 'del-btn', '−');
    del.addEventListener('click', () => {
      group.regularItems = group.regularItems.filter(i => i.id !== item.id);
      group.todoItems = group.todoItems.filter(t => t.refId !== item.id);
      save(); render();
    });
    row.appendChild(del);
    row.appendChild(mk('div', 'toggle-dot'));
    const inp = document.createElement('input');
    inp.className = 'inline-input item-text';
    inp.value = item.text;
    inp.addEventListener('change', e => { item.text = e.target.value; save(); });
    row.appendChild(inp);
  } else {
    const inTodo = isInTodo(group, item.id);
    row.appendChild(mk('div', 'toggle-dot' + (inTodo ? ' active' : '')));
    row.appendChild(mk('span', 'item-text' + (inTodo ? ' added' : ''), item.text));
    // 行全体タップ
    row.addEventListener('click', () => {
      const nowIn = isInTodo(group, item.id);
      if (nowIn) {
        group.todoItems = group.todoItems.filter(t => t.refId !== item.id);
      } else {
        group.todoItems.push({ id: uid(), text: item.text, refId: item.id });
      }
      save(); render();
    });
  }

  wrap.appendChild(row);
  return wrap;
}

function renderTodoItem(group, item) {
  const wrap = mk('div', 'item-wrap');
  wrap.dataset.zone = 'todo';
  wrap.dataset.id = item.id;
  wrap.dataset.groupId = group.id;
  if (item.refId) wrap.dataset.refId = item.refId;

  wrap.appendChild(mk('div', 'delete-bg', '削除'));
  const row = mk('div', 'item-row');
  row.appendChild(mk('span', 'item-text', item.text));
  wrap.appendChild(row);
  return wrap;
}

// ---- 常時表示の追加入力 ----

function renderPersistentAdd(placeholder, onAdd) {
  const row = mk('div', 'item-row persistent-add-row');
  row.appendChild(mk('span', 'add-plus', '＋'));
  const inp = document.createElement('input');
  inp.className = 'persistent-input';
  inp.placeholder = placeholder;
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && inp.value.trim()) {
      e.preventDefault();
      onAdd(inp.value.trim());
      inp.value = '';
    }
  });
  row.appendChild(inp);
  return row;
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
  if (editMode) initSortable();
  else initSwipe();
}

// =================== SORTABLE ===================

function initSortable() {
  if (typeof Sortable === 'undefined') return;

  const opts = onEndFn => ({
    handle: '.sortable-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    filter: '.add-row, .persistent-add-row',
    preventOnFilter: false,
    onEnd: onEndFn
  });

  const groupsList = document.getElementById('groups-list');
  if (groupsList) {
    sortableInstances.push(new Sortable(groupsList, opts(e => {
      const [moved] = state.groups.splice(e.oldIndex, 1);
      state.groups.splice(e.newIndex, 0, moved);
      save();
    })));
  }

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

function closeAllSwiped(exceptWrap) {
  document.querySelectorAll('.item-wrap.swiped-open').forEach(w => {
    if (w === exceptWrap) return;
    const r = w.querySelector('.item-row');
    const b = w.querySelector('.delete-bg');
    if (r) { r.style.transition = 'transform .2s'; r.style.transform = ''; }
    if (b) b.style.opacity = '0';
    w.classList.remove('swiped-open');
  });
}

function initSwipe() {
  document.querySelectorAll('.item-wrap[data-zone]').forEach(wrap => {
    const row = wrap.querySelector('.item-row');
    const bg  = wrap.querySelector('.delete-bg');
    if (!row || !bg) return;

    const zone    = wrap.dataset.zone;
    const id      = wrap.dataset.id;
    const groupId = wrap.dataset.groupId;

    const execDelete = e => {
      e.stopPropagation();
      wrap.classList.remove('swiped-open');
      slideDelete(wrap, () => doDelete(zone, id, groupId));
    };
    bg.addEventListener('touchend', execDelete, { passive: false });
    bg.addEventListener('click',    execDelete);

    let startX = 0, curX = 0, swiping = false;

    function pointerStart(clientX) {
      closeAllSwiped(wrap);
      startX = clientX; curX = 0; swiping = true;
      row.style.transition = 'none';
    }
    function pointerMove(clientX) {
      if (!swiping) return;
      curX = Math.min(0, clientX - startX);
      row.style.transform = `translateX(${curX}px)`;
      bg.style.opacity = String(Math.min(1, Math.abs(curX) / 80));
    }
    function pointerEnd() {
      if (!swiping) return;
      swiping = false;
      row.style.transition = 'transform .2s';
      if (curX < -180) {
        wrap.classList.remove('swiped-open');
        slideDelete(wrap, () => doDelete(zone, id, groupId));
      } else if (curX < -70) {
        row.style.transform = 'translateX(-90px)';
        bg.style.opacity = '1';
        wrap.classList.add('swiped-open');
      } else {
        row.style.transform = '';
        bg.style.opacity = '0';
      }
    }

    row.addEventListener('touchstart', e => pointerStart(e.touches[0].clientX), { passive: true });
    row.addEventListener('touchmove',  e => pointerMove(e.touches[0].clientX),  { passive: true });
    row.addEventListener('touchend',   pointerEnd);
    row.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      pointerStart(e.clientX);
      const onMove = e2 => pointerMove(e2.clientX);
      const onUp   = () => { pointerEnd(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });

  document.addEventListener('touchstart', e => {
    if (!e.target.closest('.item-wrap.swiped-open')) closeAllSwiped(null);
  }, { passive: true });
}

function slideDelete(wrap, callback) {
  wrap.style.overflow = 'hidden';
  wrap.style.height = wrap.offsetHeight + 'px';
  requestAnimationFrame(() => {
    wrap.style.transition = 'height .2s ease, opacity .15s ease';
    wrap.style.height = '0';
    wrap.style.opacity = '0';
  });
  setTimeout(callback, 220);
}

function doDelete(zone, id, groupId) {
  if (zone === 'todo') {
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
  editMode = !editMode;
  render();
});

render();
