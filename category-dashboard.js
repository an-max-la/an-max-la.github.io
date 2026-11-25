/* Trip expense category dashboard calculations: VND amounts are already normalized
 * when foreign-currency expenses are recorded. Never use original_amount here.
 * Charts count each expense once, regardless of who paid or the split. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TripTogetherCategoryDashboard=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 function summarize(expenses){
  const totals=new Map();
  let total=0,count=0;
  for(const expense of expenses||[]){
   const amount=Number(expense.amount);
   if(!Number.isFinite(amount)||amount<=0)continue;
   const category=String(expense.category||'Other').trim()||'Other';
   const current=totals.get(category)||{key:category,amount:0,count:0};
   current.amount+=amount;current.count++;
   totals.set(category,current);total+=amount;count++;
  }
  const isOther=key=>key==='Other'||key==='Khác';
  const rows=[...totals.values()].sort((a,b)=>Number(isOther(a.key))-Number(isOther(b.key))||b.amount-a.amount||a.key.localeCompare(b.key));
  return {total,count,rows:rows.map(row=>({...row,share:total?row.amount/total*100:0}))};
 }
 return {summarize};
});
