const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');

test('expense date retains native date picker and category grid structure',()=>{
 const html=read('index.html');
 assert.match(html,/<div class="formgrid"><label>Ngày<input id="expenseDate" type="date" required><\/label><label>Phân loại<select id="expenseCategory"/);
 assert.match(html,/styles\.css\?v=97/);
});
test('mobile native date input cannot force its parent wider than the form',()=>{
 const css=read('styles.css');
 assert.match(css,/#expenseDialog \.formgrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(css,/#expenseDialog \.formgrid>label\{min-width:0\}/);
 assert.match(css,/#expenseDialog #expenseDate\{[\s\S]*?width:100%;max-width:100%;min-width:0;/);
 assert.match(css,/@media\(max-width:520px\)\{\s*#expenseDialog \.formgrid\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.doesNotMatch(css,/#expenseDialog #expenseDate\{[^}]*appearance:none/);
 assert.match(read('sw.js'),/triptogether-v130/);
});
