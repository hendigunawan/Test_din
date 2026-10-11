(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));
  else root.QuizHistory=factory(root.QuizCore);
})(globalThis,function(C){
  'use strict';
  const STORE='latihan-kode-produk:history:v1',LIMIT=100;
  const reasons=['submitted','timeout','violations','parallel','storage'];
  const date=value=>Number.isFinite(value)&&value>=0&&value<=8640000000000000;
  function valid(s){
    return !!s&&typeof s.id==='string'&&s.id.length>0&&s.id.length<=200
      &&date(s.startedAt)&&date(s.finishedAt)&&s.finishedAt>=s.startedAt
      &&[10,30,45,60].includes(s.minutes)
      &&Number.isFinite(s.durationMs)&&s.durationMs>=0&&s.durationMs<=s.minutes*60000
      &&s.durationMs<=s.finishedAt-s.startedAt
      &&Number.isInteger(s.score)&&s.score>=0&&s.score<=100
      &&Number.isInteger(s.answered)&&s.answered>=s.score&&s.answered<=100
      &&Number.isInteger(s.violations)&&s.violations>=0&&s.violations<=3
      &&reasons.includes(s.reason);
  }
  function summarize(a){
    if(!C.validAttempt(a)||a.status!=='finished'||!Number.isFinite(a.finishedAt))return null;
    const r=C.result(a);
    const s={id:a.id,startedAt:a.startedAt,finishedAt:a.finishedAt,minutes:a.minutes,
      durationMs:Math.max(0,Math.min(a.finishedAt,a.deadline)-a.startedAt),
      score:r.score,answered:r.correct+r.wrong,violations:a.violations.length,reason:a.finishReason};
    return valid(s)?s:null;
  }
  function ordered(entries){return [...entries].sort((a,b)=>a.finishedAt-b.finishedAt||a.id.localeCompare(b.id)).slice(-LIMIT);}
  function parse(raw){
    if(raw===null)return [];
    const data=JSON.parse(raw);
    if(!data||data.version!==1||!Array.isArray(data.sessions)||!data.sessions.every(valid)
      ||new Set(data.sessions.map(s=>s.id)).size!==data.sessions.length)throw new Error('Riwayat tidak valid.');
    return ordered(data.sessions);
  }
  function add(entries,session){
    if(!valid(session)||entries.some(s=>s.id===session.id))return entries;
    return ordered([...entries,session]);
  }
  function stats(entries){
    const count=entries.length;
    return {count,averageDurationMs:count?entries.reduce((sum,s)=>sum+s.durationMs,0)/count:null,
      averageScore:count?entries.reduce((sum,s)=>sum+s.score,0)/count:null};
  }
  return {STORE,LIMIT,summarize,parse,add,stats};
});
