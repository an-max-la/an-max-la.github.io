const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const F=require('../finance.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const members=[{user_id:'a',name:'An'},{user_id:'b',name:'Bình'},{user_id:'c',name:'Chi'}];
const contrib=(payer_id,amount)=>({payer_id,amount});
const exp=(amount,split=null,payer_id=null)=>({amount,split,payer_id,paid_amount:0});

test('coffee split: someone who did not drink receives a larger final refund',()=>{
 const expenses=[exp(60000,{mode:'equal',weights:{a:1,b:1}})];
 const contributions=[contrib('a',100000),contrib('b',100000),contrib('c',100000)];
 const report=F.calculateClosingRefunds({initial_fund:0},members,expenses,contributions);
 assert.equal(report.canRefund,true);
 assert.deepEqual(report.rows.map(x=>x.refund),[70000,70000,100000]);
 assert.equal(report.expectedRemaining,240000);
 assert.equal(report.rows.reduce((sum,r)=>sum+r.refund,0),240000);
});
test('equal expenses still split equally',()=>{
 const r=F.calculateClosingRefunds({initial_fund:0},members,[exp(90000)],members.map(m=>contrib(m.user_id,100000)));
 assert.equal(r.canRefund,true);
 assert.deepEqual(r.rows.map(x=>x.refund),[70000,70000,70000]);
});
test('initial fund and uneven proportional expense splits are accounted for',()=>{
 const trip={initial_fund:90000},expenses=[exp(90000,{mode:'shares',weights:{a:2,b:1}})];
 const r=F.calculateClosingRefunds(trip,members,expenses,members.map(m=>contrib(m.user_id,100000)));
 assert.equal(r.canRefund,true);
 assert.deepEqual(r.rows.map(x=>x.refund),[70000,100000,130000]);
 assert.equal(r.expectedRemaining,300000);
});
test('distribute rounding in VND without losing or creating money',()=>{
 const r=F.calculateClosingRefunds({initial_fund:100},members,[exp(1)],[]);
 assert.equal(r.canRefund,true);
 assert.equal(r.rows.reduce((sum,x)=>sum+x.refund,0),99);
 assert.deepEqual(r.rows.map(x=>x.refund),[33,33,33]);
});
test('unpaid advances block showing the refund list as ready',()=>{
 const expenses=[exp(100000,{mode:'equal',weights:{a:1,b:1}},'a')];
 const r=F.calculateClosingRefunds({initial_fund:200000},members,expenses,[]);
 assert.equal(r.canRefund,false);
 assert.match(r.issues.join(' '),/ứng trước/);
});
test('negative entitlements, room reservations and personal debts block settlement',()=>{
 const r=F.calculateClosingRefunds({initial_fund:100000},members,[exp(100000,{mode:'equal',weights:{a:1}})],[],{
  reminders:[{total_amount:150000,paid_amount:50000}],
  debts:[{amount:20000,paid_amount:0}]
 });
 assert.equal(r.canRefund,false);
 assert.match(r.issues.join(' '),/đóng bổ sung/);
 assert.match(r.issues.join(' '),/dự phòng/);
 assert.match(r.issues.join(' '),/nợ riêng/);
});
test('missing members or negative fund prevent finalization',()=>{
 const r=F.calculateClosingRefunds({initial_fund:0},[],[exp(10000)],[]);
 assert.equal(r.canRefund,false);
 assert.match(r.issues.join(' '),/chưa có thành viên/);
});
test('trip UI shows per-member refund details, warns before payout and never posts money',()=>{
 const app=read('app.js'),html=read('index.html');
 for(const id of ['closingRefundSection','closingRefundSummary','closingRefundWarnings','closingRefundList','copyClosingRefunds'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/TripTogetherFinance\.calculateClosingRefunds\(/);
 assert.match(app,/fundRemindersAvailable\?fundReminders/);
 assert.match(app,/closeReport\.canRefund/);
 assert.match(app,/navigator\.clipboard\.writeText/);
 const block=app.slice(app.indexOf('const closeReport='),app.indexOf('const expenseTransfers='));
 assert.doesNotMatch(block,/db\.from\(|db\.rpc\(/);
});
