/* Pure financial calculations. No DOM or database dependencies. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TripTogetherFinance = api;
})(typeof globalThis !== 'undefined' ? globalThis : undefined, function() {
  'use strict';
  function applyPayments(expenses, debts, payments) {
    const expenseTotals = new Map(), debtTotals = new Map();
    for (const payment of payments || []) {
      const map = payment.expense_id ? expenseTotals : debtTotals;
      const key = payment.expense_id || payment.debt_id;
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + Number(payment.amount));
    }
    const amountPaid = (row, values, completed) => {
      const amount = Number(row.amount);
      return Math.min(amount, Math.max(0, values.has(row.id) ? values.get(row.id) : completed ? amount : 0));
    };
    return {
      expenses: expenses.map(row => ({ ...row, paid_amount: row.payer_id ? amountPaid(row, expenseTotals, row.reimbursed) : 0 })),
      debts: debts.map(row => ({ ...row, paid_amount: amountPaid(row, debtTotals, row.is_settled) }))
    };
  }
  const reimbursedAmount = item => item.payer_id
    ? Math.max(0, Math.min(Number(item.amount), item.paid_amount == null ? (item.reimbursed ? Number(item.amount) : 0) : Number(item.paid_amount)))
    : Number(item.amount);

  function calculateTotals(trip, expenses, contributions) {
    const spent = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const additional = contributions.reduce((sum, item) => sum + Number(item.amount), 0);
    const initial = Number(trip.initial_fund || 0);
    const fund = initial + additional;
    const fundPaid = expenses.reduce((sum, item) =>
      sum + reimbursedAmount(item), 0);
    const dueToMembers = expenses.reduce((sum, item) =>
      sum + (item.payer_id ? Number(item.amount) - reimbursedAmount(item) : 0), 0);
    const cashFund = fund - fundPaid;
    const actualFund = cashFund - dueToMembers;
    return { spent, additional, initial, fund, fundPaid, dueToMembers, cashFund, actualFund };
  }

  // How one expense is shared (VND, may be fractional like the equal split always was).
  // split = null → everyone in the trip shares equally (the original behaviour).
  // split = {mode:'equal'|'shares'|'exact', weights:{memberId: weight}} → proportional to weights.
  // Weights for ids that are no longer members are ignored and the expense is spread over the
  // remaining participants, so allocations always add up to the full amount and balances stay zero-sum.
  function allocateExpense(expense, members) {
    const amount = Number(expense.amount), ids = members.map(m => m.user_id), out = new Map();
    const weights = expense.split && typeof expense.split === 'object' && expense.split.weights
      ? Object.entries(expense.split.weights).filter(([id, w]) => ids.includes(id) && Number(w) > 0) : [];
    if (!weights.length) {
      for (const id of ids) out.set(id, amount / Math.max(1, ids.length));
      return out;
    }
    const total = weights.reduce((sum, [, w]) => sum + Number(w), 0);
    for (const [id, w] of weights) out.set(id, amount * Number(w) / total);
    return out;
  }

  function memberShares(members, expenses) {
    const shares = new Map(members.map(m => [m.user_id, 0]));
    for (const expense of expenses)
      for (const [id, value] of allocateExpense(expense, members)) shares.set(id, shares.get(id) + value);
    return shares;
  }

  function calculateMemberBalances(members, expenses, contributions, totals) {
    const memberCount = Math.max(1, members.length);
    const sharePerMember = totals.spent / memberCount;
    // Keep the exact original arithmetic when nothing is split unevenly.
    const custom = expenses.some(item => item.split && item.split.weights);
    const shares = custom ? memberShares(members, expenses) : null;
    return members.map(member => {
      const share = custom ? shares.get(member.user_id) : sharePerMember;
      const personal = expenses.filter(item => item.payer_id === member.user_id);
      const paid = personal.reduce((sum, item) => sum + Number(item.amount), 0);
      const outstanding = personal.reduce((sum, item) =>
        sum + (Number(item.amount) - reimbursedAmount(item)), 0);
      const contributed = contributions.filter(item => item.payer_id === member.user_id)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const b = totals.initial / memberCount + contributed - share - totals.actualFund / memberCount;
      return { id: member.user_id, name: member.name, is_guest: !!member.is_guest, paid, outstanding, contributed, share, b };
    });
  }

  // A final cash refund is NOT the same as dividing the balance equally: every member
  // gets their initial-fund share plus contributions, minus only expenses they shared.
  // All allocation is in whole VND; distribute fractional remainders deterministically
  // so the member totals always add back to the available common fund.
  function allocateWholeVnd(amount, raw, members) {
    const ids=members.map(m=>m.user_id),out=new Map(ids.map(id=>[id,0]));
    const eligible=ids.map((id,index)=>({id,index,raw:Number(raw.get(id)||0)}))
      .filter(item=>item.raw>0);
    if(!eligible.length)return out;
    const goal=Math.round(Number(amount));
    let assigned=0;
    const amounts=eligible.map(item=>{
      const base=Math.floor(item.raw);
      assigned+=base;
      return {...item,base,fraction:item.raw-base};
    });
    const remaining=goal-assigned;
    amounts.sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
    // Normally remaining is at most participant count. If the input isn't integral,
    // rounding to the nearest VND can still be reconciled safely here.
    for(let i=0;i<Math.max(0,remaining);i++)amounts[i%amounts.length].base++;
    if(remaining<0){
      const reverse=[...amounts].sort((a,b)=>a.fraction-b.fraction||a.index-b.index);
      for(let i=0;i<-remaining;i++)reverse[i%reverse.length].base--;
    }
    for(const item of amounts)out.set(item.id,item.base);
    return out;
  }

  function calculateClosingRefunds(trip,members,expenses,contributions,{reminders=[],debts=[]}={}){
    const issues=[],rows=[];
    if(!members.length)issues.push('Chuyến đi chưa có thành viên.');
    const memberCount=Math.max(1,members.length),initial=Math.round(Number(trip?.initial_fund||0));
    const initialShare=allocateWholeVnd(initial,new Map(members.map(m=>[m.user_id,initial/memberCount])),members);
    const shares=new Map(members.map(m=>[m.user_id,0]));
    for(const expense of expenses){
      const allocation=allocateWholeVnd(expense.amount,allocateExpense(expense,members),members);
      for(const [id,value] of allocation)shares.set(id,(shares.get(id)||0)+value);
      if(expense.payer_id&&Number(expense.amount)-reimbursedAmount(expense)>.5)
        issues.push('Quỹ còn khoản ứng trước chưa hoàn cho thành viên.');
    }
    const contributionByMember=new Map(members.map(m=>[m.user_id,0]));
    for(const c of contributions)contributionByMember.set(c.payer_id,(contributionByMember.get(c.payer_id)||0)+Math.round(Number(c.amount)));
    for(const m of members){
      const contributed=contributionByMember.get(m.user_id)||0,opening=initialShare.get(m.user_id)||0;
      const spent=shares.get(m.user_id)||0;
      const refund=opening+contributed-spent;
      rows.push({id:m.user_id,name:m.name,opening,contributed,spent,refund});
      if(refund<0)issues.push('Một số thành viên cần đóng bổ sung trước khi hoàn quỹ.');
    }
    if(reminders.some(x=>Number(x.total_amount)-Number(x.paid_amount||0)>.5))
      issues.push('Vẫn còn khoản dự phòng chưa thanh toán hoặc chưa được đánh dấu hoàn tất.');
    if(debts.some(x=>Number(x.amount)-Number(x.paid_amount??(x.is_settled?x.amount:0))>.5))
      issues.push('Còn nợ riêng giữa các thành viên; hãy đối soát riêng trước khi kết thúc.');
    const fund=initial+contributions.reduce((sum,x)=>sum+Number(x.amount),0);
    const spent=expenses.reduce((sum,x)=>sum+Number(x.amount),0);
    const expectedRemaining=Math.round(fund-spent);
    const allocated=rows.reduce((sum,x)=>sum+x.refund,0);
    if(allocated!==expectedRemaining)issues.push('Số dư tính toán không khớp; kiểm tra lại khoản chi và đóng quỹ.');
    if(expectedRemaining<0)issues.push('Quỹ còn thiếu tiền để quyết toán.');
    // Unique issues retain their human-friendly order.
    return {rows,expectedRemaining,canRefund:issues.length===0,issues:[...new Set(issues)]};
  }

  function calculateDebtBalances(members, debts) {
    return members.map(member => ({
      id: member.user_id, name: member.name,
      b: debts.reduce((sum, debt) => {
        const due = Math.max(0, Number(debt.amount) -
          Number(debt.paid_amount == null ? (debt.is_settled ? debt.amount : 0) : debt.paid_amount));
        return sum + (debt.creditor_id === member.user_id ? due :
                      debt.debtor_id === member.user_id ? -due : 0);
      }, 0)
    }));
  }

  // Preserve the existing transfer order, threshold and rounding behavior.
  function settle(balances) {
    const debt = balances.filter(item => item.b < -.5).map(item => ({ ...item, b: -item.b }));
    const credit = balances.filter(item => item.b > .5).map(item => ({ ...item }));
    const out = [];
    let i = 0, j = 0;
    while (i < debt.length && j < credit.length) {
      const amount = Math.min(debt[i].b, credit[j].b);
      out.push({ from: debt[i].name, to: credit[j].name, amount: Math.round(amount) });
      debt[i].b -= amount;
      credit[j].b -= amount;
      if (debt[i].b < .5) i++;
      if (credit[j].b < .5) j++;
    }
    return out;
  }

  function vietnamDate(date = new Date()) {
    // Date-only inputs are displayed in Vietnam time, not UTC or device timezone.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const get = key => parts.find(part => part.type === key).value;
    return get('year') + '-' + get('month') + '-' + get('day');
  }

  return { calculateTotals, calculateMemberBalances, allocateExpense, memberShares, calculateClosingRefunds, calculateDebtBalances, applyPayments, settle, vietnamDate };
});
