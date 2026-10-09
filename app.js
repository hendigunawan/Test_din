(() => {
  'use strict';
  const C=window.QuizCore, H=window.QuizHistory, STORE='latihan-kode-produk:v1', LOCK=STORE+':lock';
  const BANK_UPDATED_MESSAGE='Data produk sudah diperbarui. Mulai latihan baru untuk memakai kode dan nama terbaru. Jawaban sebelumnya tetap tersimpan sampai latihan baru dimulai.';
  const app=document.getElementById('app'), warning=document.getElementById('warning-dialog'), submit=document.getElementById('submit-dialog');
  let products=[], attempt=null, armed=false, ownsLock=false, releaseLock=null, blurTimer=null, suppression=0, lastSaved='', storageError=false, fallbackLock=false;
  const $=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=ms=>`${Math.floor(Math.ceil(ms/1000)/60).toString().padStart(2,'0')}:${(Math.ceil(ms/1000)%60).toString().padStart(2,'0')}`;
  const answered=()=>attempt.answers.filter(v=>v.trim()).length;
  const active=()=>attempt?.status==='active';

  function readSaved(){try{const raw=localStorage.getItem(STORE);return raw?JSON.parse(raw):null;}catch{return null;}}
  function save(){
    if(!attempt)return true;
    try{lastSaved=JSON.stringify(attempt);localStorage.setItem(STORE,lastSaved);return true;}
    catch{storageError=true;return false;}
  }
  function storageAvailable(){try{localStorage.setItem(STORE+':check','1');localStorage.removeItem(STORE+':check');return true;}catch{return false;}}
  async function claimLock(){
    if(ownsLock)return true;
    if(!navigator.locks){fallbackLock=true;ownsLock=true;return true;}
    return new Promise(resolve=>{
      navigator.locks.request(LOCK,{ifAvailable:true},async lock=>{
        if(!lock){resolve(false);return;}
        ownsLock=true;resolve(true);
        await new Promise(done=>{releaseLock=done;});
        ownsLock=false;
      }).catch(()=>{resolve(false);});
    });
  }
  function freeLock(){if(releaseLock){releaseLock();releaseLock=null;}else ownsLock=false;}
  function sourceNote(){return `<section class="source-note"><strong>Data produk diperbarui 9 Oktober 2026</strong><p>Kode dan nama mengikuti Excel terbaru. 100 produk dipilih berdasarkan total pengiriman laporan 1–3 September 2026, sebagai pendekatan produk yang sering dibeli. Kemasan dan bahan per kg dikecualikan.</p></section>`;}
  function showWelcome(message=''){
    armed=false;app.classList.remove('masked');
    app.innerHTML=`${message?`<div class="notice" role="status">${escape(message)}</div>`:''}<section class="hero"><div class="hero-copy"><span class="eyebrow">PERSIAPAN TES PRODUK</span><h1>Kenali produknya.<br><span class="emphasis">Ingat kodenya.</span></h1><p class="lead">Latih hafalanmu lewat soal kode dan nama produk. Kerjakan dengan fokus, lalu lihat bagian yang perlu diulang.</p><div class="specimen"><div><strong>100</strong><span>produk pilihan</span></div><div><strong>50 : 50</strong><span>kode & nama</span></div><div><strong>3×</strong><span>batas pelanggaran</span></div></div></div><section class="setup" aria-labelledby="setup-title"><h2 id="setup-title">Siap latihan?</h2><p class="muted" style="font-size:13px">Soal dan jenis pertanyaan diacak setiap sesi baru.</p><label for="duration">Durasi latihan</label><div class="select-wrap"><select id="duration"><option value="10">10 menit — latihan singkat</option><option value="30">30 menit — latihan cepat</option><option value="45" selected>45 menit — waktu yang cukup</option><option value="60">60 menit — lebih santai</option></select></div><ol class="rules"><li><span class="rule-number">01</span><div><strong>Tetap di halaman ujian</strong><span>Pindah tab, aplikasi, kehilangan fokus jendela, atau keluar layar penuh dihitung sebagai pelanggaran.</span></div></li><li><span class="rule-number">02</span><div><strong>3 pelanggaran, ujian selesai</strong><span>Setiap kejadian diberi peringatan. Waktu tetap berjalan saat kamu meninggalkan halaman.</span></div></li><li><span class="rule-number">03</span><div><strong>Refresh tidak mengulang sesi</strong><span>Jawaban dan waktu tersimpan. Memuat ulang halaman juga tercatat sebagai pelanggaran.</span></div></li></ol><label class="agreement"><input id="agreement" type="checkbox"><span>Aku memahami aturan dan siap mengerjakan tanpa membuka halaman lain.</span></label><button id="start-button" class="button primary wide" disabled>Mulai latihan <span aria-hidden="true">→</span></button><p class="start-hint">Layar penuh akan aktif jika browser mendukung.</p><p id="start-error" class="error" role="status"></p></section></section><div class="notice">Mode fokus mencatat perpindahan halaman, tetapi tidak dapat mengunci perangkat sepenuhnya. Hasil latihan hanya disimpan di browser ini.</div>${sourceNote()}`;
    $('agreement').addEventListener('change',()=>$('start-button').disabled=!$('agreement').checked);
    $('start-button').addEventListener('click',start);
  }
  function showBlocked(){
    armed=false;
    app.innerHTML=`<section class="blocked"><span class="eyebrow">SATU SESI, SATU TAB</span><h1>Latihan sedang terbuka<br>di tab lain.</h1><p class="muted">Kembali ke tab tersebut untuk melanjutkan. Menutup tab saat ujian berlangsung akan tercatat sebagai pelanggaran.</p><button class="button primary" id="check-tab">Periksa lagi</button></section>`;
    $('check-tab').addEventListener('click',restore);
  }
  async function requestFullscreen(){
    if(document.fullscreenElement)return true;
    if(!document.fullscreenEnabled||!document.documentElement.requestFullscreen)return false;
    try{await document.documentElement.requestFullscreen();return !!document.fullscreenElement;}catch{return false;}
  }
  async function start(){
    if(!$('agreement').checked)return;
    if(!storageAvailable()){$('start-error').textContent='Penyimpanan browser tidak tersedia. Aktifkan penyimpanan situs sebelum mulai.';return;}
    const minutes=Number($('duration').value);
    $('start-button').disabled=true;
    if(!await claimLock()){showBlocked();return;}
    const newer=readSaved();
    if(newer?.status==='finished')archiveCompleted(newer);
    if(C.matchesBank(newer,products)&&newer.status==='active'){await restore();return;}
    const fullscreen=await requestFullscreen();
    attempt=C.createAttempt(products,{minutes,id:crypto.randomUUID?crypto.randomUUID():String(Date.now())});
    attempt.requiresFullscreen=fullscreen;
    if(!save()){freeLock();showWelcome('Jawaban belum dapat disimpan. Periksa ruang penyimpanan browser.');return;}
    armed=true;renderExam();
    if(document.visibilityState==='hidden')handleViolation('Halaman ditinggalkan');
  }
  async function restore(){
    const saved=readSaved();
    if(!C.validAttempt(saved)){attempt=null;showWelcome(saved?'Sesi tersimpan tidak dapat dipulihkan. Mulai latihan baru.':'');return;}
    if(!C.matchesBank(saved,products)){if(saved.status==='finished')archiveCompleted(saved);attempt=null;freeLock();showWelcome(BANK_UPDATED_MESSAGE);return;}
    if(saved.status==='finished'){attempt=saved;renderResult();return;}
    if(!await claimLock()){showBlocked();return;}
    // Read again after taking the lock: another tab may have just finished.
    const latest=readSaved();
    if(!C.validAttempt(latest)){freeLock();showWelcome('Sesi berubah. Silakan mulai kembali.');return;}
    if(!C.matchesBank(latest,products)){attempt=null;freeLock();showWelcome(BANK_UPDATED_MESSAGE);return;}
    attempt=C.restoreAttempt(latest);
    save();
    if(attempt.status==='finished'){renderResult();return;}
    armed=true;renderExam();presentWarning();
  }
  function questionText(q){return q.kind==='code'?`Apa kode produk untuk ${q.name}?`:`Apa nama produk dengan kode ${q.code}?`;}
  function renderExam(){
    if(!active()){renderResult();return;}
    const q=attempt.questions[attempt.current];
    app.innerHTML=`${!attempt.requiresFullscreen?'<div class="notice">Layar penuh tidak tersedia atau tidak diizinkan. Perpindahan tab/aplikasi dan fokus jendela tetap dipantau.</div>':''}${fallbackLock?'<div class="notice">Browser ini belum mendukung penguncian satu tab. Gunakan satu tab selama latihan.</div>':''}<div class="exam-head"><div><h1 class="exam-title">Latihan kode & nama</h1><p class="exam-sub">Jawab dengan ingatanmu. Satu jawaban benar, satu poin.</p></div><div class="indicators"><div class="indicator" id="time-indicator"><small>Sisa waktu</small><strong id="timer">${clock(C.remaining(attempt))}</strong></div><div class="indicator ${attempt.violations.length?'warn':''}"><small>Pelanggaran</small><strong id="violation-count">${attempt.violations.length} <span class="muted">/ 3</span></strong></div></div></div><div class="exam-layout"><section aria-label="Soal ujian"><div class="question-card"><div class="question-meta"><span class="question-index">Soal <b>${String(attempt.current+1).padStart(2,'0')}</b> dari 100</span><span class="type-badge">${q.kind==='code'?'TEBAK KODE':'TEBAK NAMA'}</span></div><p class="question-caption">${q.kind==='code'?'Apa kode untuk produk ini?':'Apa nama produk dengan kode ini?'}</p><h2 class="question-value ${q.kind==='name'?'code':''}" id="question-value">${escape(q.kind==='code'?q.name:q.code)}</h2><label class="answer-label" for="answer">${q.kind==='code'?'Kode produk':'Nama produk'}</label><input class="answer-input ${q.kind==='code'?'code':''}" id="answer" type="text" ${q.kind==='code'?'inputmode="numeric" maxlength="5"':'maxlength="160"'} autocomplete="off" spellcheck="false" autocapitalize="characters" aria-describedby="answer-note" placeholder="${q.kind==='code'?'Contoh: 01001':'Tulis nama produk'}" value="${escape(attempt.answers[attempt.current])}"><p class="answer-note" id="answer-note">${q.kind==='code'?'Tulis lengkap 5 digit, termasuk nol di depan.':'Huruf besar/kecil, spasi, dan tanda baca tidak memengaruhi nilai.'}</p></div><div class="question-actions"><button class="button secondary" id="previous" ${attempt.current===0?'disabled':''}>← Sebelumnya</button><button class="button ghost flag-button ${attempt.flags[attempt.current]?'active':''}" id="flag" aria-pressed="${attempt.flags[attempt.current]}">${attempt.flags[attempt.current]?'Ditandai':'Ragu-ragu'}</button><button class="button primary" id="next">${attempt.current===99?'Selesaikan':'Berikutnya →'}</button></div><p class="save-state" id="save-state" role="status">Jawaban tersimpan otomatis</p></section><aside><details class="navigation-panel" ${window.innerWidth>650?'open':''}><summary>Navigasi soal</summary><div class="progress-label"><span>Terjawab</span><span id="answered-count">${answered()} / 100</span></div><div class="progress-track" role="progressbar" id="progress" aria-label="Soal terjawab" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${answered()}"><div id="progress-fill" style="width:${answered()}%"></div></div><div class="number-grid" id="number-grid">${attempt.questions.map((_,i)=>`<button data-index="${i}" class="${attempt.answers[i].trim()?'answered ':''}${attempt.flags[i]?'flagged ':''}${i===attempt.current?'current':''}" aria-label="Soal ${i+1}${attempt.answers[i].trim()?', terjawab':''}${attempt.flags[i]?', ditandai':''}" ${i===attempt.current?'aria-current="step"':''}>${i+1}</button>`).join('')}</div><div class="grid-legend"><span><i class="dot"></i>Terjawab</span><span><i class="dot flag"></i>Ragu-ragu</span></div><button class="button secondary wide" id="finish">Selesaikan latihan</button></details><p class="exam-note">Hindari pindah tab, aplikasi, atau keluar layar penuh. Waktu tetap berjalan di latar belakang.</p></aside></div>`;
    $('answer').addEventListener('input',()=>{
      C.setAnswer(attempt,attempt.current,$('answer').value);
      if(!save()){end('storage');return;}
      $('answered-count').textContent=`${answered()} / 100`;
      $('progress-fill').style.width=answered()+'%';$('progress').setAttribute('aria-valuenow',String(answered()));
      const cell=$('number-grid').querySelector(`[data-index="${attempt.current}"]`);
      cell.classList.toggle('answered',!!attempt.answers[attempt.current].trim());
    });
    $('answer').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();next();}});
    $('previous').addEventListener('click',()=>go(attempt.current-1));
    $('next').addEventListener('click',next);
    $('flag').addEventListener('click',()=>{if(attempt.pendingViolation)return;attempt.flags[attempt.current]=!attempt.flags[attempt.current];save();renderExam();});
    $('number-grid').addEventListener('click',e=>{const button=e.target.closest('button[data-index]');if(button)go(Number(button.dataset.index));});
    $('finish').addEventListener('click',confirmFinish);
    app.classList.toggle('masked',attempt.pendingViolation);
    if(attempt.pendingViolation)presentWarning();
  }
  function go(index){if(!active()||attempt.pendingViolation||index<0||index>=100)return;attempt.current=index;save();renderExam();$('question-value').setAttribute('tabindex','-1');$('question-value').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  function next(){if(attempt.current===99)confirmFinish();else go(attempt.current+1);}
  function confirmFinish(){if(!active()||attempt.pendingViolation)return;$('submit-description').textContent=answered()===100?'Seluruh soal sudah terjawab. Setelah dikirim, jawaban tidak bisa diubah.':`${100-answered()} soal masih kosong dan akan mendapat 0 poin. Kirim jawaban dan lihat hasilnya?`;submit.showModal();}
  function closeDialogs(){if(warning.open)warning.close();if(submit.open)submit.close();}
  function end(reason){if(!active())return;C.finishAttempt(attempt,reason);save();renderResult();}
  function handleViolation(reason){
    if(!armed||!active())return;
    const changed=C.violate(attempt,reason);
    if(!changed&&active())return;
    if(submit.open)submit.close();
    save();
    if(!active()){renderResult();return;}
    app.classList.add('masked');
    if($('violation-count'))$('violation-count').textContent=`${attempt.violations.length} / 3`;
    presentWarning();
  }
  function presentWarning(){
    if(!active()||!attempt.pendingViolation||document.visibilityState==='hidden')return;
    const last=attempt.violations.at(-1);
    $('warning-description').textContent=`${last.reason}. Pelanggaran ${attempt.violations.length} dari 3 telah dicatat.`;
    $('resume-error').textContent='';
    if(!warning.open)warning.showModal();
  }
  $('resume-button').addEventListener('click',async()=>{
    if(!active())return;
    if(document.visibilityState==='hidden')return;
    $('resume-button').disabled=true;armed=false;
    if(attempt.requiresFullscreen&&!await requestFullscreen()){
      $('resume-error').textContent='Layar penuh belum aktif. Tekan tombol sekali lagi untuk kembali ke ujian.';
      armed=true;$('resume-button').disabled=false;return;
    }
    C.tick(attempt);
    if(!active()){save();renderResult();$('resume-button').disabled=false;return;}
    C.resumeAttempt(attempt);save();warning.close();armed=true;renderExam();$('resume-button').disabled=false;
  });
  warning.addEventListener('cancel',e=>e.preventDefault());
  $('cancel-submit').addEventListener('click',()=>submit.close());
  $('confirm-submit').addEventListener('click',()=>end('submitted'));

  function archiveCompleted(saved){
    const current=H.summarize(saved);
    let sessions;
    try{sessions=H.parse(localStorage.getItem(H.STORE));}
    catch{return {sessions:current?[current]:[],error:'Riwayat sebelumnya tidak dapat dibaca. Riwayat sesi ini belum dapat disimpan. Data lama tetap dipertahankan; unduh hasil sesi ini.'};}
    const updated=current?H.add(sessions,current):sessions;
    if(updated!==sessions){
      try{localStorage.setItem(H.STORE,JSON.stringify({version:1,sessions:updated}));}
      catch{return {sessions:updated,error:'Riwayat sesi ini belum dapat disimpan. Periksa ruang penyimpanan browser dan unduh hasil sesi ini.'};}
    }
    return {sessions:updated,error:''};
  }
  const reasonLabel=reason=>({submitted:'Dikirim',timeout:'Waktu habis',violations:'3 pelanggaran',parallel:'Tab lain',storage:'Gagal simpan'}[reason]||'Selesai');
  const shortDate=ms=>new Date(ms).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const decimal=value=>value.toLocaleString('id-ID',{maximumFractionDigits:1});
  const perAnswer=s=>s?.answered?`${decimal(s.durationMs/s.answered/1000)} dtk`:'—';
  function historyChart(sessions,metric){
    const points=sessions.slice(-20),score=metric==='score',title=score?'Nilai per sesi':'Durasi per sesi';
    const offset=sessions.length-points.length,left=44,right=460,top=26,bottom=184;
    const max=score?100:Math.max(1,Math.ceil(Math.max(...points.map(s=>s.durationMs))/60000));
    const value=s=>score?s.score:s.durationMs/60000;
    const x=i=>points.length===1?(left+right)/2:left+(right-left)*i/(points.length-1);
    const y=s=>bottom-value(s)/max*(bottom-top);
    const ticks=[0,max/2,max];
    const grid=ticks.map(v=>{const py=bottom-v/max*(bottom-top);return `<line x1="${left}" x2="${right}" y1="${py}" y2="${py}" class="chart-grid"/><text x="${left-9}" y="${py+5}" text-anchor="end">${decimal(v)}</text>`;}).join('');
    const line=score&&points.length>1?`<polyline points="${points.map((s,i)=>`${x(i)},${y(s)}`).join(' ')}" class="chart-line"/>`:'';
    const marks=points.map((s,i)=>{
      const stopped=['violations','parallel','storage'].includes(s.reason),label=`Sesi ${offset+i+1}, ${shortDate(s.finishedAt)}: ${score?s.score+' dari 100':clock(s.durationMs)+', menit:detik'}, ${reasonLabel(s.reason)}`;
      const width=Math.min(28,(right-left)/Math.max(points.length,1)*.55);
      const shape=score?`<circle cx="${x(i)}" cy="${y(s)}" r="5" class="chart-point ${stopped?'is-stopped':''}"/>`:`<rect x="${x(i)-width/2}" y="${y(s)}" width="${width}" height="${Math.max(1,bottom-y(s))}" rx="3" class="chart-bar ${stopped?'is-stopped':''}"/>`;
      const tick=points.length<=10||i===0||i===points.length-1||i%4===0?`<text x="${x(i)}" y="209" text-anchor="middle">${offset+i+1}</text>`:'';
      return `<g tabindex="0" role="img" aria-label="${escape(label)}"><title>${escape(label)}</title>${shape}</g>${tick}`;
    }).join('');
    return `<figure class="history-chart"><figcaption><h3>${title}</h3><span>${score?'Skala 0–100':'Durasi dalam menit'}</span></figcaption><svg viewBox="0 0 492 230" role="img" aria-labelledby="${metric}-chart-title ${metric}-chart-desc"><title id="${metric}-chart-title">${title}</title><desc id="${metric}-chart-desc">${points.length} sesi terakhir, dari yang paling lama. Angka lengkap ada pada tabel riwayat.</desc>${grid}${line}${marks}</svg><p class="chart-caption">Nomor sesi · urutan dari yang paling lama</p></figure>`;
  }
  function renderHistory(state){
    const sessions=state.sessions,current=H.summarize(attempt),stats=H.stats(sessions);
    const rows=sessions.map((s,i)=>({s,n:i+1})).reverse().map(({s,n})=>`<tr${s.id===attempt.id?' class="current-session"':''}><th scope="row">${n}${s.id===attempt.id?'<small>Sesi ini</small>':''}</th><td>${escape(shortDate(s.finishedAt))}</td><td><b>${s.score}</b> / 100</td><td>${s.answered} / 100</td><td>${clock(s.durationMs)}</td><td>${s.minutes} menit</td><td><span class="history-status ${['violations','parallel','storage'].includes(s.reason)?'is-stopped':''}">${reasonLabel(s.reason)}</span></td></tr>`).join('');
    $('session-history').innerHTML=`<section class="history-panel" aria-labelledby="history-title"><div class="history-heading"><div><span class="eyebrow">PERKEMBANGAN LATIHAN</span><h2 id="history-title">Riwayat & waktu pengerjaan</h2></div><span class="history-local">${state.error?'Penyimpanan perlu diperiksa':'Tersimpan di browser ini'}</span></div>${state.error?`<div class="notice" role="status">${escape(state.error)}</div>`:''}<div class="history-stats"><div class="history-stat"><span>Sesi tercatat${state.error?' / tampil':''}</span><strong>${stats.count}</strong><small>Maksimal 100 sesi terakhir</small></div><div class="history-stat"><span>Rata-rata nilai</span><strong>${stats.averageScore===null?'—':decimal(stats.averageScore)}<em> / 100</em></strong><small>Semua sesi tercatat</small></div><div class="history-stat"><span>Rata-rata durasi</span><strong>${stats.averageDurationMs===null?'—':clock(stats.averageDurationMs)}</strong><small>Menit:detik per sesi</small></div><div class="history-stat"><span>Waktu per soal terjawab</span><strong>${perAnswer(current)}</strong><small>${current?.answered?'Sesi ini · '+current.answered+' soal terjawab':'Belum ada jawaban'}</small></div></div><p class="history-explanation">Rata-rata durasi mencakup semua sesi di riwayat, termasuk yang dihentikan. Waktu di luar halaman tetap dihitung. Waktu per soal adalah perkiraan: durasi sesi ini ÷ jumlah soal terjawab.</p>${sessions.length?`<div class="history-charts">${historyChart(sessions,'score')}${historyChart(sessions,'duration')}</div><p class="history-chart-note">Grafik menampilkan hingga 20 sesi terakhir. Warna jingga menandai sesi yang dihentikan.${sessions.length===1?' Selesaikan sesi berikutnya untuk melihat perbandingan.':''}</p><details class="history-details"><summary>Lihat tabel riwayat (${sessions.length} sesi)</summary><div class="history-table-wrap" role="region" aria-label="Tabel riwayat latihan" tabindex="0"><table class="history-table"><caption>Riwayat sesi dari yang paling baru. Durasi ditulis dalam menit:detik.</caption><thead><tr><th scope="col">Sesi</th><th scope="col">Selesai</th><th scope="col">Nilai</th><th scope="col">Terjawab</th><th scope="col">Durasi</th><th scope="col">Batas waktu</th><th scope="col">Status</th></tr></thead><tbody>${rows}</tbody></table></div></details>`:'<p class="empty">Belum ada sesi yang dapat ditampilkan.</p>'}<p class="history-footnote">Riwayat mulai dikumpulkan sejak fitur ini tersedia, termasuk hasil terakhir yang masih tersimpan. Riwayat akan hilang jika data situs di browser dihapus.</p></section>`;
  }

  function renderResult(){
    armed=false;clearTimeout(blurTimer);closeDialogs();app.classList.remove('masked');
    const historyState=archiveCompleted(attempt);
    freeLock();
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    const r=C.result(attempt),reason=attempt.finishReason;
    const stopped=reason==='violations'||reason==='parallel'||reason==='storage';
    const heading=stopped?'Latihan dihentikan.':reason==='timeout'?'Waktu latihan selesai.':'Latihan selesai.';
    const detail=reason==='violations'?'Batas 3 pelanggaran tercapai. Jawaban terakhir dinilai otomatis.':reason==='timeout'?'Waktu habis. Semua jawaban yang tersimpan sudah dinilai.':reason==='parallel'?'Perubahan dari tab lain terdeteksi. Percobaan ini dihentikan.':reason==='storage'?'Penyimpanan browser gagal. Hasil yang masih ada di halaman ini dapat diunduh.':'Lihat hasilmu dan ulangi produk yang masih tertukar.';
    app.innerHTML=`<section class="result-top"><div><span class="eyebrow">HASIL LATIHAN</span><h1>${heading}</h1><p class="lead">${detail}</p><p class="exam-sub">Durasi terpakai ${clock(Math.max(0,(attempt.finishedAt??Date.now())-attempt.startedAt))} · ${attempt.violations.length} pelanggaran</p></div><div class="score-ring" style="--score:${r.score}%" aria-label="Nilai ${r.score} dari 100"><div><strong>${r.score}</strong><span>dari 100 poin</span></div></div></section><div class="result-stats"><div class="stat"><strong>${r.correct}</strong><span>Jawaban benar</span></div><div class="stat"><strong>${r.wrong}</strong><span>Jawaban salah</span></div><div class="stat"><strong>${r.blank}</strong><span>Belum dijawab</span></div><div class="stat"><strong>${attempt.violations.length} / 3</strong><span>Pelanggaran fokus</span></div></div><div class="result-actions"><button class="button primary" id="new-attempt">Latihan baru, soal diacak</button><button class="button secondary" id="download-result">Unduh hasil</button></div>${storageError?'<div class="notice">Hasil belum berhasil disimpan ke browser. Unduh hasil sebelum menutup halaman.</div>':''}<div id="session-history"></div><details class="log"><summary>Riwayat perpindahan halaman (${attempt.violations.length})</summary>${attempt.violations.length?`<ol>${attempt.violations.map(v=>`<li>${escape(new Date(v.at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))} — ${escape(v.reason)}</li>`).join('')}</ol>`:'<p>Tidak ada perpindahan halaman yang terdeteksi.</p>'}</details><div class="review-head"><h2>Periksa jawaban</h2><label><input type="checkbox" id="only-wrong" checked> Tampilkan salah & kosong saja</label></div><div id="review"></div>${sourceNote()}`;
    $('only-wrong').addEventListener('change',renderReview);
    $('download-result').addEventListener('click',downloadResult);
    $('new-attempt').addEventListener('click',()=>{attempt=null;showWelcome(historyState.error?'Riwayat sesi ini belum tersimpan. Hasil terakhir masih tersedia sampai latihan baru dimulai.':'Riwayat sesi sebelumnya tersimpan di browser ini. Pilih durasi untuk latihan berikutnya.');});
    renderHistory(historyState);renderReview();window.scrollTo({top:0,behavior:'instant'});
  }
  function renderReview(){
    const rows=attempt.questions.map((q,i)=>({q,i,correct:C.isCorrect(q,attempt.answers[i])})).filter(x=>!$('only-wrong').checked||!x.correct);
    $('review').innerHTML=rows.length?rows.map(({q,i,correct})=>`<article class="review-row"><span class="review-number">${String(i+1).padStart(2,'0')}</span><div><h3>${escape(questionText(q))}</h3><p class="review-answer">Jawabanmu: ${escape(attempt.answers[i].trim()||'Belum dijawab')}</p><p class="review-answer">Kunci: <b>${escape(q.kind==='code'?q.code:q.name)}</b></p><span class="review-status ${correct?'':'wrong'}">${correct?'Benar':attempt.answers[i].trim()?'Perlu diulang':'Belum dijawab'}</span></div></article>`).join(''):'<div class="empty">Semua jawaban benar. Tidak ada soal yang perlu diulang.</div>';
  }
  function downloadResult(){
    const r=C.result(attempt);
    const lines=['HASIL LATIHAN KODE PRODUK',`Mulai: ${new Date(attempt.startedAt).toLocaleString('id-ID')}`,`Nilai: ${r.score}/100`,`Durasi: ${clock(H.summarize(attempt)?.durationMs??0)} (menit:detik)`,`Perkiraan waktu per soal terjawab: ${perAnswer(H.summarize(attempt))}`,`Benar: ${r.correct} | Salah: ${r.wrong} | Kosong: ${r.blank}`,`Selesai karena: ${attempt.finishReason}`,`Pelanggaran: ${attempt.violations.length}/3`,'','RIWAYAT PERPINDAHAN',...attempt.violations.map(v=>`${new Date(v.at).toLocaleString('id-ID')} - ${v.reason}`),'','JAWABAN'];
    attempt.questions.forEach((q,i)=>lines.push(`${i+1}. ${questionText(q)}`,`Jawaban: ${attempt.answers[i]||'(kosong)'}`,`Kunci: ${q.kind==='code'?q.code:q.name}`,''));
    const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='hasil-latihan-produk.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  document.addEventListener('visibilitychange',()=>{
    clearTimeout(blurTimer);
    if(document.visibilityState==='hidden')handleViolation('Pindah tab, aplikasi, atau layar dikunci');
    else if(active()){C.tick(attempt);if(!active()){save();renderResult();}else presentWarning();}
  });
  window.addEventListener('blur',()=>{
    if(Date.now()<suppression)return;
    clearTimeout(blurTimer);blurTimer=setTimeout(()=>{
      if(!document.hasFocus())handleViolation('Jendela ujian kehilangan fokus');
    },500);
  });
  window.addEventListener('focus',()=>{clearTimeout(blurTimer);presentWarning();});
  document.addEventListener('fullscreenchange',()=>{if(armed&&active()&&attempt.requiresFullscreen&&!document.fullscreenElement)handleViolation('Keluar dari layar penuh');});
  window.addEventListener('beforeunload',e=>{if(active()&&ownsLock){save();suppression=Date.now()+2000;e.preventDefault();e.returnValue='';}});
  window.addEventListener('pagehide',()=>{if(active()&&ownsLock){handleViolation('Halaman ditutup atau dimuat ulang');save();}freeLock();});
  window.addEventListener('pageshow',e=>{if(e.persisted)restore();});
  window.addEventListener('storage',e=>{
    if(e.key===STORE&&active()&&ownsLock&&e.newValue!==lastSaved){
      // A second context changed/removed the attempt. Stop rather than silently
      // discarding locally held answers or allowing two writers to race.
      end('parallel');
    }
  });
  setInterval(()=>{
    if(!active()||!ownsLock)return;
    C.tick(attempt);
    if(!active()){save();renderResult();return;}
    if($('timer'))$('timer').textContent=clock(C.remaining(attempt));
    if($('time-indicator'))$('time-indicator').classList.toggle('urgent',C.remaining(attempt)<300000);
  },500);

  async function boot(){
    try{
      products=window.PRODUCT_BANK;
      if(!Array.isArray(products)||products.length!==100)throw new Error('Bank soal belum lengkap.');
      await restore();
    }catch(error){app.innerHTML=`<section class="blocked"><h1>Soal belum bisa dimuat.</h1><p class="muted">${escape(error.message)} Periksa koneksi dan muat ulang halaman.</p><button id="retry" class="button primary">Coba lagi</button></section>`;$('retry').addEventListener('click',boot);}
  }
  boot();
})();
