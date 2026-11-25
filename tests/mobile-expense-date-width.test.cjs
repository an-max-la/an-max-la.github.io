const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');

test('expense date retains native date picker and category grid structure',()=>{
 const html=read('index.html');
 assert.match(html,/<div class="formgrid"><label>Ngày<input id="expenseDate" type="date" required><\/label><label>Phân loại<select id="expenseCategory"/);
 assert.match(html,/styles\.css\?v=\d+/);
});
test('mobile native date input cannot force its parent wider than the form',()=>{
 const css=read('styles.css');
 assert.match(css,/#expenseDialog \.formgrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(css,/#expenseDialog \.formgrid>label\{min-width:0\}/);
 assert.match(css,/#expenseDialog #expenseDate\{[\s\S]*?width:100%;max-width:100%;min-width:0;/);
 assert.match(css,/@media\(max-width:520px\)\{\s*#expenseDialog \.formgrid\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.doesNotMatch(css,/#expenseDialog #expenseDate\{[^}]*appearance:none/);
 assert.match(read('sw.js'),/triptogether-v\d+/);
});

test('date field has same fixed height and constrained width as expense modal selects',()=>{
 const css=read('styles.css');
 assert.match(css,/#expenseDialog \.formgrid input:not\(\[type="checkbox"\]\),\s*#expenseDialog \.formgrid select\{/);
 assert.match(css,/#expenseDialog \.formgrid select\{[^}]*inline-size:100%;min-inline-size:0;max-inline-size:100%;[^}]*block-size:46px;min-block-size:46px;max-block-size:46px;/);
 assert.match(css,/#expenseDialog input\[type="date"\]\{[^}]*inline-size:100%;width:100%;min-inline-size:0;min-width:0;max-inline-size:100%;[^}]*block-size:46px;height:46px;min-block-size:46px;max-block-size:46px;/);
 assert.match(css,/#expenseDialog input\[type="date"\]::-webkit-date-and-time-value\{/);
 assert.match(css,/#expenseDialog input\[type="date"\]::-webkit-datetime-edit\{/);
 assert.doesNotMatch(css,/#expenseDialog input\[type="date"\]\{[^}]*appearance:none/);
});
