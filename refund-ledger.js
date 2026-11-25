/* Closing refund ledger: records transferred money separately from trip spending. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TripTogetherRefundLedger=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 function reconcile(report,records=[]){
  const map=new Map(),problems=[];
  for(const record of records){
   if(map.has(record.member_id))problems.push('Có khoản hoàn trùng thành viên.');
   map.set(record.member_id,record);
  }
  const rows=report.rows.map(person=>{
   const paidRecord=map.get(person.id)||null;
   const planned=Math.max(0,Math.round(person.refund));
   const paid=paidRecord?Number(paidRecord.amount):0;
   if(paidRecord&&paid!==planned)problems.push('Số tiền đã hoàn không còn khớp với quyết toán của '+person.name+'.');
   return {...person,planned,paid,paidRecord,remaining:Math.max(0,planned-paid)};
  });
  if(records.some(record=>!report.rows.some(person=>person.id===record.member_id)))
   problems.push('Có khoản hoàn cho thành viên không còn trong chuyến.');
  const paidTotal=records.reduce((sum,x)=>sum+Number(x.amount||0),0);
  const remainingTotal=rows.reduce((sum,x)=>sum+x.remaining,0);
  return {rows,paidTotal,remainingTotal,afterPayouts:report.expectedRemaining-paidTotal,problems:[...new Set(problems)]};
 }
 return {reconcile};
});
