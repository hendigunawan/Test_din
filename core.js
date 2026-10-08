(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuizCore = api;
})(globalThis, function() {
  'use strict';
  const VERSION = 1;
  function shuffle(items, random) {
    const copy = [...items];
    for (let i=copy.length-1;i>0;i--) {
      const j=Math.floor(random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }
  function createAttempt(bank, {now=Date.now(),minutes=45,id,random=Math.random}={}) {
    if(bank.length!==100 || new Set(bank.map(p=>p.code)).size!==100) throw new Error('Bank harus memuat 100 kode berbeda.');
    if(![10,30,45,60].includes(minutes)) throw new Error('Durasi tidak valid.');
    const safe=shuffle(bank.filter(p=>!p.ambiguousName),random);
    if(safe.length<50)throw new Error('Belum cukup nama produk yang unik.');
    const codeSet=new Set(safe.slice(0,50).map(p=>p.code));
    return {version:VERSION,id:id || String(now),status:'active',startedAt:now,deadline:now+minutes*60000,
      minutes,questions:shuffle(bank.map(p=>({...p,kind:codeSet.has(p.code)?'code':'name'})),random),
      answers:Array(100).fill(''),flags:Array(100).fill(false),current:0,violations:[],maxViolations:3,
      pendingViolation:false,requiresFullscreen:false,finishedAt:null,finishReason:null};
  }
  function normalize(value,kind) {
    const text=String(value??'').trim();
    return kind==='code'?text:text.toUpperCase().replace(/[^A-Z0-9]/g,'');
  }
  function isCorrect(q,value){const actual=normalize(value,q.kind);return actual!==''&&actual===normalize(q.kind==='code'?q.code:q.name,q.kind);}
  function setAnswer(a,index,value){if(a.status==='active'&&!a.pendingViolation&&Number.isInteger(index)&&index>=0&&index<100)a.answers[index]=String(value).slice(0,160);}
  function finishAttempt(a,reason,now=Date.now()) {
    if(a.status!=='active')return false;
    a.status='finished';a.finishedAt=now;a.finishReason=reason;a.pendingViolation=false;return true;
  }
  function remaining(a,now=Date.now()){return Math.max(0,a.deadline-now);}
  function tick(a,now=Date.now()){if(a.status==='active'&&remaining(a,now)===0)finishAttempt(a,'timeout',a.deadline);return a.status;}
  function violate(a,reason,now=Date.now()) {
    tick(a,now);
    if(a.status!=='active'||a.pendingViolation)return false;
    a.violations.push({reason,at:now});a.pendingViolation=true;
    if(a.violations.length>=a.maxViolations)finishAttempt(a,'violations',now);
    return true;
  }
  function resumeAttempt(a){if(a.status==='active')a.pendingViolation=false;}
  function restoreAttempt(a,now=Date.now()) {
    if(!validAttempt(a))return null;
    tick(a,now);
    if(a.status==='active'&&!a.pendingViolation)violate(a,'Sesi dimuat ulang atau dipulihkan',now);
    return a;
  }
  function result(a) {
    let correct=0,wrong=0,blank=0;
    a.questions.forEach((q,i)=>{if(!a.answers[i].trim())blank++;else if(isCorrect(q,a.answers[i]))correct++;else wrong++;});
    return {correct,wrong,blank,total:100,score:correct};
  }
  function validAttempt(a) {
    return !!a && a.version===VERSION && typeof a.id==='string' && ['active','finished'].includes(a.status)
      && Number.isFinite(a.startedAt)&&Number.isFinite(a.deadline)&&a.deadline>a.startedAt
      && Array.isArray(a.questions)&&a.questions.length===100
      && a.questions.every(q=>/^\d{5}$/.test(q.code)&&typeof q.name==='string'&&['code','name'].includes(q.kind))
      && new Set(a.questions.map(q=>q.code)).size===100
      && Array.isArray(a.answers)&&a.answers.length===100&&a.answers.every(v=>typeof v==='string')
      && Array.isArray(a.flags)&&a.flags.length===100
      && Number.isInteger(a.current)&&a.current>=0&&a.current<100
      && a.maxViolations===3&&typeof a.pendingViolation==='boolean'
      && Array.isArray(a.violations)&&a.violations.every(v=>typeof v.reason==='string'&&Number.isFinite(v.at));
  }
  function matchesBank(a,bank) {
    if(!validAttempt(a)||!Array.isArray(bank)||bank.length!==100)return false;
    const current=new Map(bank.map(p=>[p.code,p]));
    return current.size===100&&a.questions.every(q=>{
      const p=current.get(q.code);
      return p&&q.name===p.name&&!!q.ambiguousName===!!p.ambiguousName;
    });
  }
  return {VERSION,shuffle,createAttempt,normalize,isCorrect,setAnswer,finishAttempt,remaining,tick,violate,resumeAttempt,restoreAttempt,result,validAttempt,matchesBank};
});
