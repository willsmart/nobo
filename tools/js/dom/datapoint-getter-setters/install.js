const finders = [
  [require('./dom-attribute'), 'dom-attribute'],
  [require('./dom-children'), 'dom-children'],
  [require('./dom-context'), 'dom-context'],
  [require('./dom-tree'), 'dom-tree'],
  [require('./dom-initialized-element'), 'dom-initialized-element'],
];
const finderFactories = [[require('./dom-element'), 'dom-element']];

module.exports = ({ cache, htmlToElement }) => {
  const finderFns = finders.concat(finderFactories.map(([factory, name]) => [factory({ htmlToElement }), name]));

  for (const fn of finderFns) cache.getterSetterInfo.finders.push(fn);
};
