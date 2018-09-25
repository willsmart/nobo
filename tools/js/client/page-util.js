window.forEachLocal = (el, cb) => {
  while (el && !el.hasAttribute('sourcetemplate')) el = el.parentElement;
  if (!el) return;
  go(el);
  function go(el) {
    cb(el);
    for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
      if (!child.hasAttribute('sourcetemplate')) go(child);
    }
  }
};

window.filterLocal = (el, select) => {
  while (el && !el.hasAttribute('sourcetemplate')) el = el.parentElement;
  if (!el) return;
  const ret = [];
  go(el);
  return ret;
  function go(el) {
    if (select(el)) ret.push(el);
    for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
      if (!child.hasAttribute('sourcetemplate')) go(child);
    }
  }
};

window.findLocal = (el, select) => {
  while (el && !el.hasAttribute('sourcetemplate')) {
    el = el.parentElement;
  }
  if (!el) return;
  return go(el);
  function go(el) {
    if (select(el)) return el;
    for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
      if (!child.hasAttribute('sourcetemplate')) {
        const ret = go(child);
        if (ret) return ret;
      }
    }
  }
};

window.localElement = (el, name) => {
  return findLocal(el, el => el.getAttribute('localid') === name);
};
