const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const stats=require('../category-dashboard.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('summarizes spending by category from all expense amounts in VND',()=>{
 const report=stats.summarize([
  {category:'Food',amount:100000,payer_id:'member-a'},
  {category:'Transport',amount:80000,payer_id:null},
  {category:'Food',amount:50000,currency:'USD',original_amount:2,fx_rate:25000},
  {category:'Accommodation',amount:200000}
 ]);
 assert.equal(report.total,430000);
 assert.equal(report.count,4);
 assert.deepEqual(report.rows.map(x=>[x.key,x.amount,x.count]),[
  ['Accommodation',200000,1],['Food',150000,2],['Transport',80000,1]
 ]);
 assert.ok(Math.abs(report.rows.reduce((sum,x)=>sum+x.share,0)-100)<0.000001);
});
test('unknown and missing categories are handled without losing expenses',()=>{
 const report=stats.summarize([{amount:10},{category:'',amount:20},{category:'Custom',amount:40}]);
 assert.deepEqual(report.rows.map(x=>[x.key,x.amount]),[['Custom',40],['Other',30]]);
});
test('empty and invalid expense values do not break charts',()=>{
 assert.deepEqual(stats.summarize([]),{total:0,count:0,rows:[]});
 const r=stats.summarize([{category:'Food',amount:'n/a'},{amount:0},{amount:-10},{category:'Food',amount:100}]);
 assert.equal(r.total,100);
 assert.equal(r.rows[0].share,100);
});
test('dashboard is wired to all enriched expenses, not UI-filtered results',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.match(html,/id="categorySpendingDashboard"/);
 assert.match(html,/id="categoryDashboardContent"/);
 assert.match(html,/category-dashboard\.js\?v=1/);
 assert.match(app,/TripTogetherCategoryDashboard\.summarize\(displayExpenses\)/);
 assert.doesNotMatch(app,/TripTogetherCategoryDashboard\.summarize\(visibleExpenses\)/);
 assert.match(app,/categoryReport\.total/);
 assert.match(app,/categoryDashboardContent/);
});
test('accessible responsive chart and empty state',()=>{
 const css=read('styles.css'),app=read('app.js');
 assert.match(css,/\.category-dashboard-content\{display:grid/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(app,/class="category-dashboard-donut" role="img"/);
 assert.match(app,/role="meter"/);
 assert.match(app,/Chưa có khoản chi để thống kê/);
});

test('donut keeps a thin ring and an unbroken VND total, without expense count',()=>{
 const app=read('app.js'),css=read('styles.css');
 assert.match(app,/<div class="category-dashboard-donut-center"><small>Tổng chi<\/small><strong>\$\{money\(categoryReport.total\)\}<\/strong><\/div>/);
 assert.doesNotMatch(app,/categoryReport\.count\} khoản chi/);
 assert.match(css,/\.category-dashboard-donut\{[^}]*padding:11%/);
 assert.match(css,/\.category-dashboard-donut-center strong\{[^}]*white-space:nowrap/);
 assert.match(css,/\.category-dashboard-donut-center strong\{[^}]*font-variant-numeric:tabular-nums/);
 assert.match(css,/@media\(max-width:700px\)[\s\S]*?\.category-dashboard-donut-center strong\{font-size:clamp\(11px,3vw,15px\)\}/);
});

test('category dashboard precedes recent expense cards on trip overview',()=>{
 const html=read('index.html');
 const category=html.indexOf('id="categorySpendingDashboard"');
 const recent=html.indexOf('Khoản chi gần đây');
 const activity=html.indexOf('id="activityPanel"');
 assert.ok(category>=0&&category<recent&&recent<activity);
 assert.equal((html.match(/id="categorySpendingDashboard"/g)||[]).length,1);
});
