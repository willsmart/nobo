const finders = [
  require('./dom-attribute'),
  require('./dom-children'),
  require('./dom-context'),
  require('./dom-tree'),
];
const finderFactories = [require('./dom-element')];

module.exports = ({ cache, htmlToElement }) => {
  const finderFns = finders.concat(finderFactories.map(factory => factory({ htmlToElement })));

  for (const fn of finderFns) cache.getterSetterInfo.finders.push(fn);
};
