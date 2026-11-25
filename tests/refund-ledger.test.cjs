const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../refund-ledger.js');
const F=require('../finance.js');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
const members=[{user_id:'a',name:'A'},{user_id:'b',name:'B'},{user_id:'c',name:'C'}];
const report=()=>F.calculateClosingRefunds({initial_fund:0},members,[{amount:60000,category:'Food',payer_id:null,split:{weights:{a:1,b:1}}}],[{payer_id:'a',amount:100000},{payer_id:'b',amount:100000},{payer_id:'c',amount:100000}]);
test('coffee shared by A/B gives C a higher refund and all amounts reconcile',()=>{
 const plan=report();assert.deepEqual(plan.rows.map(x=>x.refund),[70000,70000,100000]);
 const state=R.reconcile(plan,[]);
 assert.equal(state.paidTotal,0);assert.equal(state.remainingTotal,240000);
 assert.equal(state.afterPayouts,240000);assert.equal(state.problems.length,0);
});
test('mark one or all members paid, never count payout as new expense',()=>{
 const plan=report();
 const a=R.reconcile(plan,[{member_id:'a',amount:70000,paid_on:'2026-11-25'}]);
 assert.equal(a.paidTotal,70000);assert.equal(a.remainingTotal,170000);assert.equal(a.afterPayouts,170000);
 assert.equal(a.rows[0].remaining,0);assert.equal(a.rows[2].remaining,100000);
 const all=R.reconcile(plan,[{member_id:'a',amount:70000},{member_id:'b',amount:70000},{member_id:'c',amount:100000}]);
 assert.equal(all.remainingTotal,0);assert.equal(all.afterPayouts,0);
});
test('ledger warns if refund amount no longer matches recalculated financial plan',()=>{
 const s=R.reconcile(report(),[{member_id:'a',amount:60000}]);
 assert.equal(s.paidTotal,60000);assert.equal(s.remainingTotal,180000);
 assert.ok(s.problems.some(x=>x.includes('khớp')));
});
test('unknown, duplicate and invalid refund entries are flagged',()=>{
 const s=R.reconcile(report(),[{member_id:'a',amount:70000},{member_id:'a',amount:70000},{member_id:'former',amount:1}]);
 assert.ok(s.problems.some(x=>x.includes('trùng')));
 assert.ok(s.problems.some(x=>x.includes('không còn')));
});
test('new UI fetches and exports refund records; no action transfers money',()=>{
 const app=read('app.js'),html=read('index.html'),sql=read('trip_member_refunds.sql'),backup=read('excel-backup.js');
 assert.match(html,/id="markAllRefundsPaid"/);
 assert.match(html,/id="refundLedgerSetup"/);
 assert.match(app,/TripTogetherRefundLedger\.reconcile\(closeReport,memberRefunds\)/);
 assert.match(app,/db\.from\('trip_member_refunds'\)\.insert\(entries\)/);
 assert.match(app,/db\.from\('trip_member_refunds'\)\.delete\(\)/);
 assert.match(app,/refunds:freshRefunds/);
 assert.match(backup,/name:'Hoan quy'/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/unique\(trip_id,member_id\)/);
 assert.match(sql,/can_edit_trip\(trip_id\)/);
 assert.doesNotMatch(sql,/grant.*\bupdate\b/i);
});
