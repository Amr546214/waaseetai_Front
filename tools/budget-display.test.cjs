const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const filename = path.join(__dirname, '../src/app/pages/dashboard/provider-overview/explore-requests/explore-requests.ts');
const file = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
const component = file.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'ExploreRequests');
const method = component.members.find(node => node.name?.getText(file) === 'cleanBudget');
assert.ok(method, 'exercise the production formatter, not a copied implementation');
const executable = ts.transpile(`function cleanBudget(${method.parameters.map(p => p.getText(file)).join(',')}) ${method.body.getText(file)}`);
const scope = {};
vm.runInNewContext(executable, scope);
const format = scope.cleanBudget;
test('budget range accepts dollar symbols on both bounds without duplicating them', () => {
  assert.equal(format('$6,000 - $7,000'), '6000 - 7000 $');
});
test('budget display retains cents instead of truncating monetary values', () => {
  assert.equal(format('125.50 – 130.75'), '125.5 - 130.75 $');
});
test('unavailable and foreign-currency text is not relabelled as dollars', () => {
  assert.equal(format('غير متاح'), 'غير متاح');
  assert.equal(format('100 - 200 SAR'), '100 - 200 SAR');
});
test('empty and non-text values produce no invented range', () => {
  assert.equal(format(null), '');
  assert.equal(format('   '), '');
});
