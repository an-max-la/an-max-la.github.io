const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('fund reminder buttons retain icon actions while contribution actions use member-style settings menu',()=>{
 const app=read('app.js');
 for(const action of ['edit-fund-reminder','delete-fund-reminder']){
  assert.match(app,new RegExp('<button[^>]*class="[^"]*'+action+'[^"]*"[^>]*aria-label="[^"]+"'));
 }
 assert.match(app,/const FUND_EDIT_ICON='<svg[^']+aria-hidden="true"/);
 assert.match(app,/const FUND_REMOVE_ICON='<svg[^']+aria-hidden="true"/);
 assert.match(app,/const FUND_SETTINGS_ICON='<svg[^']+aria-hidden="true"/);
 assert.match(app,/class="member-actions-menu contribution-actions-menu"/);
 assert.match(app,/class="member-actions-dropdown contribution-actions-dropdown"/);
 for(const action of ['edit-contribution','delete-contribution']){
  assert.match(app,new RegExp('class="'+action+'"[^>]*aria-label="[^"]+"[^>]*title="[^"]+"'));
 }
 assert.match(app,/menu\.open=!menu\.open/);
 assert.match(app,/contribution-menu-open/);
});
test('fund action handlers and deletion confirmation remain in place',()=>{
 const app=read('app.js');
 assert.match(app,/querySelectorAll\('\.edit-fund-reminder'\)/);
 assert.match(app,/querySelectorAll\('\.delete-fund-reminder'\)/);
 assert.match(app,/querySelectorAll\('\.edit-contribution'\)/);
 assert.match(app,/querySelectorAll\('\.delete-contribution'\)/);
 assert.match(app,/removeRecord\('contributions'/);
 assert.match(app,/localizedConfirm\('Xóa nhắc thanh toán này\?'\)/);
});
test('fund icon actions have compact layout, keyboard focus, and mobile touch targets',()=>{
 const css=read('styles.css');
 assert.match(css,/\.fund-icon-btn:focus-visible/);
 assert.match(css,/\.fund-icon-edit\{/);
 assert.match(css,/\.fund-icon-remove\{/);
 assert.match(css,/\.fund-reminder-panel \.fund-reminder-row\{/);
 assert.match(css,/#contributionList \.record-row/);
 assert.match(css,/min-height:40px/);
 assert.match(css,/@container ledger \(max-width:590px\)/);
});

test('remove icon is soft minus-circle instead of the sharp trash can',()=>{
 const app=read('app.js');
 const icon=app.match(/const FUND_REMOVE_ICON='([^']+)'/);
 assert.ok(icon,'remove icon exists');
 assert.match(icon[1],/<circle cx="12" cy="12" r="9"\/>/);
 assert.match(icon[1],/<path d="M8 12h8"\/>/);
 assert.doesNotMatch(icon[1],/M4 7h16/);
 assert.match(app,/aria-label="Xóa nhắc thanh toán:/);
 assert.match(app,/aria-label="Xóa khoản đóng quỹ:/);
});
test('reserved amount chip is compact without reducing action hit targets',()=>{
 const css=read('styles.css'),app=read('app.js');
 assert.match(app,/remaining\?'Dự phòng':'Đã trả đủ'/);
 assert.match(css,/\.fund-reminder-row \.fund-reminder-amount\{[\s\S]*?width:max-content/);
 assert.match(css,/\.fund-reminder-row \.fund-reminder-amount small\{/);
 assert.match(css,/\.fund-icon-actions \.fund-icon-btn/);
 assert.match(css,/min-height:40px/);
 assert.match(read('i18n.js'),/"Dự phòng":"Reserved"/);
});

 test('contribution info, amount and settings occupy one grid row on narrow screens',()=>{
 const css=read('styles.css');
 assert.match(css,/#contributionList \.record-row\{grid-template-columns:minmax\(0,1fr\) auto auto;gap:6px/);
 assert.match(css,/#contributionList \.record-row>\.record-main\{grid-column:1;grid-row:1;/);
 assert.match(css,/#contributionList \.record-row>\.record-amount\{grid-column:2;grid-row:1;/);
 assert.match(css,/#contributionList \.record-row>\.contribution-menu-actions\{grid-column:3;grid-row:1;/);
 assert.doesNotMatch(css,/#contributionList \.record-row>\.(?:record-buttons|contribution-menu-actions)\{[^}]*grid-row:2/);
 });
 test('closing refund amounts are left aligned',()=>{
 const css=read('styles.css');
 assert.match(css,/\.closing-refund-amount\{display:flex;flex-direction:column;align-items:flex-start;text-align:left;/);
 assert.match(css,/\.closing-refund-actions\{display:flex;flex-direction:column;gap:8px;align-items:flex-start;/);
 });
